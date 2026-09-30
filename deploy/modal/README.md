# Modal Qwen3-TTS

Modal is the preferred first GPU endpoint for the free-pool architecture because its Starter plan currently advertises recurring monthly compute credit and serverless scale-to-zero.

## Setup

```bash
pip install modal
modal setup
modal secret create bible-friend-tts QWEN3_TTS_API_TOKEN=<LONG_RANDOM_TOKEN>
modal deploy deploy/modal/qwen3_tts.py
```

Use the generated Modal web endpoint in the Cloudflare Worker's `GPU_ENDPOINTS_JSON`.

The service uses:

- Qwen3-TTS 1.7B CustomVoice
- Korean speaker `Sohee`
- T4 GPU
- `min_containers=0` so idle GPU time is not consumed
- one concurrent input per model container to avoid memory spikes

The first uncached request may be slow because the serverless GPU container/model can cold-start. Cloudflare KV removes this cost for repeated text/voice/style combinations.
