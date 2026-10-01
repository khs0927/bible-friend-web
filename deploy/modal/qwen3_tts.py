import io
import math
import os
import re

import modal

APP_NAME = "bible-friend-qwen3-tts"
MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
MODEL_CACHE = "/root/.cache/huggingface"

image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04",
        add_python="3.12",
    )
    .apt_install("git", "libsndfile1", "sox", "build-essential")
    .uv_pip_install(
        "fastapi>=0.115,<1",
        "soundfile>=0.13,<1",
        "qwen-tts",
        "torch",
    )
)

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("bible-friend-qwen-models", create_if_missing=True)


@app.cls(
    image=image,
    gpu="T4",
    volumes={MODEL_CACHE: volume},
    scaledown_window=300,
    min_containers=0,
    max_containers=1,
    secrets=[modal.Secret.from_name("bible-friend-tts")],
)
@modal.concurrent(max_inputs=1)
class Qwen3TTS:
    @modal.enter()
    def load(self):
        import torch
        from qwen_tts import Qwen3TTSModel

        self.model = Qwen3TTSModel.from_pretrained(
            MODEL_ID,
            device_map="cuda:0",
            dtype=torch.float16,
        )

    @modal.asgi_app()
    def web(self):
        import soundfile as sf
        from fastapi import FastAPI, Header, HTTPException, Response
        from pydantic import BaseModel, Field

        service = self
        api = FastAPI(title="Bible Friend Qwen3-TTS")

        class TTSRequest(BaseModel):
            text: str = Field(min_length=1, max_length=1200)
            language: str = "Korean"
            speaker: str = "Sohee"
            instruct: str = Field(default="", max_length=1800)
            speed: float = Field(default=1.0, ge=0.7, le=1.3)
            format: str = "wav"

        def authorize(authorization: str | None):
            token = os.environ.get("QWEN3_TTS_API_TOKEN", "").strip()
            if token and authorization != f"Bearer {token}":
                raise HTTPException(status_code=401, detail="Unauthorized")

        @api.get("/health")
        def health():
            return {"ok": True, "model": MODEL_ID, "gpu": "T4"}

        def split_for_batch(text: str) -> list[str]:
            text = text.strip()
            if len(text) <= 180:
                return [text]

            sentences = [
                part.strip()
                for part in re.split(r"(?<=[.!?。！？])\\s+|\\n+", text)
                if part.strip()
            ]
            if not sentences:
                sentences = [text]

            target = max(120, min(260, math.ceil(len(text) / 4)))
            chunks: list[str] = []
            current = ""
            for sentence in sentences:
                candidate = f"{current} {sentence}".strip() if current else sentence
                if current and len(candidate) > target:
                    chunks.append(current)
                    current = sentence
                else:
                    current = candidate
            if current:
                chunks.append(current)

            while len(chunks) > 4:
                chunks[-2] = f"{chunks[-2]} {chunks[-1]}".strip()
                chunks.pop()
            return chunks

        @api.post("/tts")
        def tts(request: TTSRequest, authorization: str | None = Header(default=None)):
            authorize(authorization)
            import numpy as np

            chunks = split_for_batch(request.text)
            if len(chunks) == 1:
                wavs, sample_rate = service.model.generate_custom_voice(
                    text=chunks[0],
                    language=request.language,
                    speaker=request.speaker,
                    instruct=request.instruct or None,
                )
                audio = wavs[0]
            else:
                wavs, sample_rate = service.model.generate_custom_voice(
                    text=chunks,
                    language=[request.language] * len(chunks),
                    speaker=[request.speaker] * len(chunks),
                    instruct=[request.instruct or ""] * len(chunks),
                )
                pause = np.zeros(max(1, int(sample_rate * 0.055)), dtype=wavs[0].dtype)
                pieces = []
                for index, wav in enumerate(wavs):
                    if index:
                        pieces.append(pause)
                    pieces.append(wav)
                audio = np.concatenate(pieces)

            output = io.BytesIO()
            sf.write(output, audio, sample_rate, format="WAV")
            return Response(
                content=output.getvalue(),
                media_type="audio/wav",
                headers={
                    "Cache-Control": "no-store",
                    "X-Bible-Friend-TTS-Provider": "qwen3",
                    "X-Bible-Friend-TTS-Model": MODEL_ID,
                    "X-Bible-Friend-TTS-Batch-Chunks": str(len(chunks)),
                },
            )

        return api
