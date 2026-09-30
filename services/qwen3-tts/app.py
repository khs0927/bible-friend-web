import io
import os

import soundfile as sf
import torch
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field
from qwen_tts import Qwen3TTSModel

MODEL_ID = os.getenv("QWEN3_TTS_MODEL", "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice")
DEVICE = os.getenv("QWEN3_TTS_DEVICE", "cuda:0" if torch.cuda.is_available() else "cpu")
API_TOKEN = os.getenv("QWEN3_TTS_API_TOKEN", "").strip()

load_kwargs = {"device_map": DEVICE}
if DEVICE.startswith("cuda"):
    load_kwargs["dtype"] = torch.bfloat16
    if os.getenv("QWEN3_TTS_FLASH_ATTENTION", "1") == "1":
        load_kwargs["attn_implementation"] = "flash_attention_2"
else:
    load_kwargs["dtype"] = torch.float32

model = Qwen3TTSModel.from_pretrained(MODEL_ID, **load_kwargs)
app = FastAPI(title="Bible Friend Qwen3-TTS", version="1.0.0")


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    language: str = "Korean"
    speaker: str = "Sohee"
    instruct: str = Field(default="", max_length=1200)


def authorize(authorization: str | None) -> None:
    if not API_TOKEN:
        return
    if authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
def health():
    return {"ok": True, "model": MODEL_ID, "device": DEVICE}


@app.post("/tts")
def tts(request: TTSRequest, authorization: str | None = Header(default=None)):
    authorize(authorization)
    try:
        wavs, sample_rate = model.generate_custom_voice(
            text=request.text,
            language=request.language,
            speaker=request.speaker,
            instruct=request.instruct or None,
        )
        output = io.BytesIO()
        sf.write(output, wavs[0], sample_rate, format="WAV")
        return Response(
            content=output.getvalue(),
            media_type="audio/wav",
            headers={"Cache-Control": "no-store"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="TTS synthesis failed") from exc
