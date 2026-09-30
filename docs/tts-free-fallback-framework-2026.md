# Bible Friend 무료 TTS 폴백 프레임워크 (2026-09-30)

## 목표

추가 비용 없이 시작하고, Gemini 3.1 TTS의 무료 할당량/장애가 발생해도 음성이 끊기지 않도록 한다.

## 최종 체인

```text
Bible Friend / Vercel
  1. Gemini 3.1 TTS
  2. Cloudflare Worker
       2-1. Workers KV audio cache
       2-2. Modal Qwen3-TTS
       2-3. Inferless Qwen3-TTS
       2-4. Lightning/기타 수동 endpoint
  3. Gemini 2.5 TTS
  4. Device speech
```

모든 단계는 순차 호출한다. 한 공급자가 성공하면 뒤 공급자는 호출하지 않는다.

## Cloudflare

### Worker
- Free plan: 100,000 requests/day
- CPU time: 10 ms/request
- External fetch waiting time는 GPU inference 자체와 별개이며, Worker는 control-plane 역할만 수행한다.
- 15분 idle sleep 유형의 무료 PaaS가 아니라 요청 시 edge Worker가 실행된다.

### KV
- 100,000 reads/day
- 1,000 writes/day
- 1 GB stored data
- maximum value size 25 MiB

오디오 캐시는 기본적으로 KV를 사용한다. strict no-card 경로를 우선하기 위해 R2는 기본 의존성에서 제외한다.

### R2
R2는 10 GB/month free storage와 큰 operation allowance가 있지만 usage-based subscription 제품이다.
향후 결제수단 등록을 허용할 경우 KV 대신 R2 audio cache로 교체할 수 있다.

## GPU pool

### Modal — primary
- Starter $0 plan
- 공식 가격표 기준 monthly $30 included compute
- serverless scale-to-zero
- Qwen3-TTS T4 deployment adapter 제공
- 사용량 초과 시 과금 가능성이 있으므로 account usage limits를 반드시 설정/확인한다.

### Inferless — secondary
- 공식 가격 페이지 기준 10 hours free credit / no credit card required
- $30 onboarding credit 안내
- minimum replicas = 0으로 두면 idle compute charge 없음
- perpetual monthly free tier로 가정하지 않고 bootstrap/emergency capacity로 취급한다.

### Lightning AI — emergency/dev
- Free tier에서 초기 GPU credits 제공
- 무료 Studio는 4시간마다 restart 필요
- production auto pool의 상시 endpoint로 간주하지 않는다.

### Google Colab — manual emergency only
- 세션 및 tunnel URL이 영구 endpoint가 아니다.
- 자동 production pool에는 넣지 않는다.

## Cache strategy

key:

```text
SHA256(
  CACHE_VERSION +
  text +
  language +
  speaker +
  instruction +
  speed +
  format
)
```

성경 구절처럼 동일한 문장이 반복되면 첫 GPU 생성 후 KV에서 즉시 재사용한다.

기본 TTL은 30일이다. 유명 구절/고정 콘텐츠는 별도 prewarm script를 추가해 캐시를 미리 생성할 수 있다.

## Circuit breaker

GPU endpoint가 실패하면 `CIRCUIT_STATE` KV에 짧은 TTL의 open-state를 기록한다.

예:

```text
Modal fail
  -> Modal 90 sec skip
  -> Inferless immediately
```

KV write는 endpoint failure에서만 발생하므로 1,000 writes/day free limit을 보호한다.

## Security

- Browser는 GPU provider token을 알 수 없다.
- Vercel -> Worker는 `OPEN_TTS_GATEWAY_TOKEN`
- Worker -> GPU는 `GPU_ENDPOINTS_JSON` secret 내부 token
- Worker public TTS route는 bearer authentication 필수
- health만 public
- text length / speed validation
- endpoint timeout
- max cache object size 제한

## Repository implementation

```text
workers/tts-gateway/
  src/index.ts
  wrangler.example.toml
  package.json
  README.md

deploy/modal/
  qwen3_tts.py
  README.md

services/qwen3-tts/
  existing FastAPI Qwen3-TTS service

api/voice-tts31.js
  Gemini 3.1 -> Worker/Qwen3 -> Gemini 2.5 -> Device
```

## Activation

Cloudflare Worker가 아직 배포되지 않았을 때는 `OPEN_TTS_GATEWAY_URL`이 비어 있으므로 기존 Gemini 3.1 -> 2.5 -> Device 체인을 유지한다.

Worker 배포 후 Vercel 환경변수를 넣으면 코드 변경 없이 open-source fallback이 활성화된다.

```text
OPEN_TTS_GATEWAY_URL=https://<worker>.workers.dev
OPEN_TTS_GATEWAY_TOKEN=<worker API token>
OPEN_TTS_GATEWAY_TIMEOUT_MS=12000
```

## 다음 단계

1. Cloudflare Worker account에서 KV namespace 2개 생성
2. Worker secret 생성
3. Modal Qwen3 endpoint 배포
4. `GPU_ENDPOINTS_JSON`에 Modal endpoint 추가
5. Worker `/health`, `/api/voice/status`, `/api/voice/speech` smoke test
6. Vercel environment variables 설정
7. production `/api/voice-probe?probe=1`에서 provider chain 검증
8. Inferless endpoint를 second provider로 추가
9. 고정 성경 구절 cache prewarm 추가
