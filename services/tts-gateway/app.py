import hashlib
import json
import os
import time
from typing import Optional

import httpx
import redis.asyncio as redis
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import BaseModel, Field

API_TOKEN = os.getenv("VPS_TTS_API_TOKEN", "").strip()
REDIS_URL = os.getenv("VPS_TTS_REDIS_URL", "redis://redis:6379/0").strip()
UPSTREAM_URL = os.getenv("QWEN3_TTS_UPSTREAM_URL", "").strip().rstrip("/")
UPSTREAM_TOKEN = os.getenv("QWEN3_TTS_UPSTREAM_TOKEN", "").strip()
CACHE_TTL_SECONDS = max(60, int(os.getenv("VPS_TTS_CACHE_TTL_SECONDS", "86400")))
UPSTREAM_TIMEOUT_SECONDS = max(2.0, min(float(os.getenv("QWEN3_TTS_UPSTREAM_TIMEOUT_SECONDS", "18")), 60.0))
MAX_TEXT_CHARS = max(80, min(int(os.getenv("VPS_TTS_MAX_TEXT_CHARS", "1200")), 4000))

app = FastAPI(title="Bible Friend VPS TTS Gateway", version="1.0.0")
cache = redis.from_url(REDIS_URL, encoding=None, decode_responses=False)


class TTSRequest(BaseModel):
    text: str = Field(min_length=1)
    language: str = "Korean"
    speaker: str = "Sohee"
    instruct: str = Field(default="", max_length=1800)


def authorize(authorization: Optional[str]) -> None:
    if not API_TOKEN:
        return
    if authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def normalized_request(request: TTSRequest) -> dict:
    text = request.text.strip()
    if len(text) > MAX_TEXT_CHARS:
        raise HTTPException(status_code=400, detail=f"Text exceeds {MAX_TEXT_CHARS} characters")
    return {
        "text": text,
        "language": request.language.strip() or "Korean",
        "speaker": request.speaker.strip() or "Sohee",
        "instruct": request.instruct.strip(),
    }


def cache_key(payload: dict) -> str:
    digest = hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return f"bible-friend:tts:qwen3:{digest}"


async def upstream_health() -> dict:
    if not UPSTREAM_URL:
        return {"configured": False, "ok": False}
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{UPSTREAM_URL}/health")
            return {"configured": True, "ok": response.is_success, "status": response.status_code}
    except Exception:
        return {"configured": True, "ok": False}


@app.get("/health")
async def health():
    redis_ok = False
    try:
        redis_ok = bool(await cache.ping())
    except Exception:
        redis_ok = False
    return {
        "ok": True,
        "service": "bible-friend-tts-gateway",
        "redis": redis_ok,
        "qwen3": await upstream_health(),
        "cacheTtlSeconds": CACHE_TTL_SECONDS,
    }


@app.get("/ready")
async def ready():
    status = await health()
    qwen = status["qwen3"]
    ready_now = bool(status["redis"] and qwen.get("configured") and qwen.get("ok"))
    if not ready_now:
        raise HTTPException(status_code=503, detail=status)
    return {**status, "ready": True}


async def synthesize(request: TTSRequest, authorization: Optional[str]) -> Response:
    authorize(authorization)
    payload = normalized_request(request)
    if not UPSTREAM_URL:
        raise HTTPException(status_code=503, detail="QWEN3_TTS_UPSTREAM_URL is not configured")

    key = cache_key(payload)
    try:
        cached = await cache.get(key)
    except Exception:
        cached = None

    if cached:
        return Response(
            content=cached,
            media_type="audio/wav",
            headers={
                "Cache-Control": "private, max-age=0",
                "X-Bible-Friend-TTS-Provider": "qwen3",
                "X-Bible-Friend-TTS-Cache": "HIT",
            },
        )

    headers = {
        "content-type": "application/json",
        "accept": "audio/wav",
    }
    if UPSTREAM_TOKEN:
        headers["authorization"] = f"Bearer {UPSTREAM_TOKEN}"

    started = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=UPSTREAM_TIMEOUT_SECONDS) as client:
            upstream = await client.post(f"{UPSTREAM_URL}/tts", json=payload, headers=headers)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Qwen3-TTS upstream timed out") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Qwen3-TTS upstream unavailable") from exc

    if not upstream.is_success:
        raise HTTPException(status_code=502, detail=f"Qwen3-TTS upstream returned {upstream.status_code}")

    audio = upstream.content
    if len(audio) < 44:
        raise HTTPException(status_code=502, detail="Qwen3-TTS upstream returned invalid audio")

    try:
        await cache.set(key, audio, ex=CACHE_TTL_SECONDS)
    except Exception:
        pass

    return Response(
        content=audio,
        media_type=upstream.headers.get("content-type", "audio/wav"),
        headers={
            "Cache-Control": "private, max-age=0",
            "X-Bible-Friend-TTS-Provider": "qwen3",
            "X-Bible-Friend-TTS-Cache": "MISS",
            "X-Bible-Friend-TTS-Latency-Ms": str(round((time.monotonic() - started) * 1000)),
        },
    )


@app.post("/v1/tts")
async def tts_v1(request: TTSRequest, authorization: Optional[str] = Header(default=None)):
    return await synthesize(request, authorization)


@app.post("/tts")
async def tts_compat(request: TTSRequest, authorization: Optional[str] = Header(default=None)):
    # Compatibility endpoint for the existing Bible Friend Qwen client.
    return await synthesize(request, authorization)
