# Bible Friend — Hostinger VPS TTS framework

This directory turns the persistent Hostinger VPS into the **TTS control plane** for Bible Friend.

## Target fallback chain

```text
Bible Friend / Vercel
  1. Gemini 3.1 TTS
  2. Hostinger VPS Gateway -> Qwen3-TTS 1.7B CustomVoice (Sohee)
  3. Gemini 2.5 TTS
  4. Device / browser speech
```

Only one provider is called at a time. A successful provider stops the chain, preventing overlapping voices.

## Why the VPS is the gateway, not the 1.7B inference host

Standard Hostinger VPS plans are CPU-based KVM machines. They are excellent for persistent API, Redis, Nginx, monitoring, and cache. Qwen3-TTS 1.7B is designed for accelerated inference and should normally run on an NVIDIA GPU host.

Hostinger now offers separate GPU instances. The same repository supports both roles:

- **Normal KVM VPS:** `redis + gateway`
- **GPU instance:** optional `qwen3-tts` Compose profile
- **One GPU machine for testing:** all three services can run together with `--profile gpu`

## Layout

```text
infra/vps-tts/
  docker-compose.yml
  .env.example
  nginx/bible-friend-tts.conf

services/
  tts-gateway/      # lightweight FastAPI gateway + Redis cache
  qwen3-tts/        # existing Qwen3-TTS inference service
```

## KVM VPS deployment

1. Point a DNS A record such as `tts.example.com` to the VPS public IP.
2. Clone the repository on the VPS.
3. Create the environment file:

```bash
cd infra/vps-tts
cp .env.example .env
chmod 600 .env
```

4. Set:
   - `VPS_TTS_API_TOKEN`
   - `QWEN3_TTS_UPSTREAM_URL` (the GPU service)
   - `QWEN3_TTS_UPSTREAM_TOKEN`

5. Start the persistent control plane:

```bash
docker compose up -d --build redis gateway
docker compose ps
curl http://127.0.0.1:8787/health
```

6. Install the Nginx site template, replace the domain, obtain a Let's Encrypt certificate, then reload Nginx.

7. Configure Vercel:

```text
QWEN3_TTS_API_URL=https://tts.example.com
QWEN3_TTS_API_TOKEN=<same VPS_TTS_API_TOKEN>
QWEN3_TTS_SPEAKER=Sohee
QWEN3_TTS_TIMEOUT_MS=10000
```

## Hostinger GPU deployment

On a Hostinger GPU instance:

```bash
cd infra/vps-tts
cp .env.example .env
# For a single-machine GPU deployment:
# QWEN3_TTS_UPSTREAM_URL=http://qwen3-tts:8000

docker compose --profile gpu up -d --build
```

The Qwen model cache is persisted in the `qwen-models` Docker volume.

## Security rules

- Do not expose the raw Qwen container directly unless it is authenticated.
- Keep Redis private; it has no public port.
- Gateway binds to `127.0.0.1:8787`; only Nginx is internet-facing.
- Use a long random Bearer token.
- Restrict SSH with keys and Hostinger firewall rules.
- Keep `.env` outside Git.

## Health endpoints

- `GET /health`: gateway and upstream status
- `GET /ready`: 200 only when Redis and Qwen upstream are ready
- `POST /v1/tts`: primary gateway TTS endpoint
- `POST /tts`: compatibility alias used by existing Bible Friend code

## Cache behavior

The gateway hashes text + language + speaker + instruction and stores the resulting WAV in Redis. Default TTL is 24 hours. This prevents repeated GPU inference for identical Bible Friend replies and reduces both latency and GPU cost.

## Next extension points

The gateway intentionally hides the inference implementation behind one API. Later engines can be added without changing the mobile app:

```text
VPS Gateway
  -> Qwen3-TTS
  -> MeloTTS (CPU emergency fallback)
  -> CosyVoice (optional A/B engine)
```

Gemini remains in the Vercel layer so Google quota failure and self-hosted failures stay independent.
