# Bible Friend Qwen3-TTS fallback

This service is the self-hosted, open-source fallback for Bible Friend speech.

- Model: `Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice`
- Korean voice: `Sohee`
- API: `POST /tts` -> `audio/wav`
- Health: `GET /health`

The web app keeps Gemini as the preferred provider. When Gemini is unavailable,
rate-limited, or the app-level Gemini quota is exhausted, it falls through to
this service and then to the existing CosyVoice adapter.

## Run

```bash
docker build -t bible-friend-qwen3-tts services/qwen3-tts

docker run --gpus all --rm -p 8000:8000 \
  -e QWEN3_TTS_API_TOKEN=change-me \
  bible-friend-qwen3-tts
```

Set these variables on the Bible Friend web/server deployment:

```bash
QWEN3_TTS_API_URL=https://your-qwen3-tts-host
QWEN3_TTS_API_TOKEN=change-me
QWEN3_TTS_SPEAKER=Sohee
QWEN3_TTS_TIMEOUT_MS=20000
```

For a private LAN/Tailscale/Cloudflare Tunnel deployment, keep the TTS endpoint
authenticated and do not expose the GPU service directly to the public Internet.
