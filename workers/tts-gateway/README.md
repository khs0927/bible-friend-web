# Bible Friend Cloudflare TTS Gateway

This Worker is the always-available control plane for Bible Friend's open-source TTS fallback.

## Runtime chain

```text
Bible Friend / Vercel
  -> Gemini 3.1
  -> Cloudflare Worker
       -> Workers KV audio cache
       -> Modal Qwen3-TTS
       -> Inferless Qwen3-TTS (optional bootstrap credit)
       -> Lightning / other HTTP endpoint (optional)
  -> Gemini 2.5
  -> device speech
```

The GPU pool is sequential. A successful endpoint stops the chain, so two voices are never played at the same time.

## Why KV is the default cache

For the strict **no-card / zero-additional-cost** path, Workers KV is the default:

- binary values up to 25 MiB
- 1 GB storage on Workers Free
- 100,000 reads/day
- 1,000 writes/day

Cloudflare R2 has a much larger free allowance, but enabling R2 requires an R2 subscription/checkout flow and can require a payment method. R2 can be added later as an optional high-capacity cache without changing the public API.

## Routes

- `GET /health` — public gateway health
- `GET /api/voice/status` — authenticated GPU pool status
- `GET /api/voice/voices` — authenticated voice catalog
- `POST /api/voice/speech` — authenticated TTS request
- `POST /tts` — compatibility alias

## Deploy

```bash
cd workers/tts-gateway
npm install
cp wrangler.example.toml wrangler.toml

npx wrangler kv namespace create AUDIO_CACHE
npx wrangler kv namespace create CIRCUIT_STATE
# Paste the IDs into wrangler.toml.

npx wrangler secret put API_TOKEN
npx wrangler secret put GPU_ENDPOINTS_JSON

npm run typecheck
npm run deploy
```

Example `GPU_ENDPOINTS_JSON`:

```json
[
  {
    "name": "modal-qwen3",
    "url": "https://YOUR-MODAL-APP.modal.run/tts",
    "healthUrl": "https://YOUR-MODAL-APP.modal.run/health",
    "token": "UPSTREAM_SECRET",
    "timeoutMs": 25000,
    "cooldownSeconds": 90
  },
  {
    "name": "inferless-qwen3",
    "url": "https://YOUR-INFERLESS-ENDPOINT/tts",
    "token": "UPSTREAM_SECRET",
    "timeoutMs": 30000,
    "cooldownSeconds": 180
  }
]
```

Keep provider tokens inside the Worker secret. The browser never sees them.

## Cache key

The gateway hashes normalized:

```text
text + language + speaker + instruction + speed + output format + CACHE_VERSION
```

Changing `CACHE_VERSION` invalidates old audio without deleting KV data immediately.

## Circuit breaker

When a GPU endpoint fails, the Worker writes a short-lived `cb:<endpoint>` key to `CIRCUIT_STATE`. During the cooldown it skips that endpoint and immediately tries the next one. Writes occur only on endpoint failures, preserving the 1,000-write/day KV free allowance.

## Provider notes

### Modal

Modal Starter currently includes recurring monthly compute credit and is the best primary serverless GPU candidate for this architecture. Set minimum containers to zero so idle time does not consume GPU credit.

### Inferless

Inferless advertises free onboarding credit with no card required. Treat this as a secondary/bootstrap pool, not guaranteed perpetual monthly capacity.

### Lightning AI

Lightning's Free tier can be useful for development/emergency capacity, but GPU credits are promotional and free Studios restart periodically. Do not treat it as an always-on production endpoint.

### Google Colab

Keep Colab out of the automatic production pool. Sessions and tunnel URLs are ephemeral; use it only as a manual emergency/dev endpoint.

## Vercel variables

After deployment, configure Bible Friend:

```text
OPEN_TTS_GATEWAY_URL=https://<worker>.workers.dev
OPEN_TTS_GATEWAY_TOKEN=<same API_TOKEN>
OPEN_TTS_GATEWAY_TIMEOUT_MS=12000
```

The app then uses:

```text
Gemini 3.1 -> Worker/Qwen3 -> Gemini 2.5 -> device speech
```
