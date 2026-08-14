
초기 390×844 Playwright mock 검증은 페이지 reload 전에 mock SpeechRecognition을 주입하지 않아 `isListening=false`로 관찰되었다. 같은 문제를 addInitScript 선주입 방식으로 재시도했으나 브라우저 컨텍스트의 SpeechRecognition mock 노출 여부를 추가 확인해야 한다. 실제 코드는 iPhone에서 SpeechRecognition이 없거나 오류일 때 MediaRecorder→내장 Whisper 전사 fallback으로 이어지도록 보강했으며, 다음 검증에서는 `window.SpeechRecognition` 존재와 pointer/touch 이벤트를 별도로 확인한다.

최신 DOM 기반 390×844 검증에서는 touch pointerdown 직후 `.bf-mic-button`이 `listening pressed` 상태가 되고, 안내 문구가 `지금 듣고 있어요`로 바뀌며, 확대된 그림자 값이 적용됐다. 실제 좌표 mouse 검증은 미리보기 오버레이 영향으로 상태를 읽지 못했지만, DOM 이벤트 경로는 정상 동작했다. 브라우저에서 SpeechRecognition·webkitSpeechRecognition·MediaRecorder·getUserMedia API가 모두 노출되는 것도 확인했다.

390×844 touch lifecycle 재검증에서는 Firefox mock에 `TouchEvent` 생성자가 없어 첫 시나리오는 실행되지 않았고, 일반 `touchstart`/`touchend` 이벤트로 재실행했다. touchstart 직후 `.bf-mic-button`은 `listening pressed`, 안내는 `지금 듣고 있어요`로 바뀌었고, touchend 뒤에는 pressed만 해제되고 listening 상태는 유지되어 한 번 눌러 듣기 시작→다시 눌러 중지하는 UX가 정상적으로 보존됐다. 콘솔 오류는 없었다.

실제 390×844 Home live flow에서 글 질문 `하나님은 나를 사랑하시나요?`를 전송했고, 답변 텍스트가 도착한 뒤 `tts.synthesize`가 자동 호출됐다. 응답은 HTTP 200이지만 `provider: gemini`, `success: false`, `errorCode: rate_limit`이었다. 현재 `allowBrowserFallback: false` 정책 때문에 이 상태에서 Web Speech 기계음으로 자동 전환하지 않고, 글 답변은 계속 표시된다. 이는 자동 호출 경로는 정상이며 현재 실제 Gemini 음성이 들리지 않는 직접 원인이 free-tier quota 제한임을 확인한다.

MediaRecorder mock·SpeechRecognition 비활성화 상태의 390×844 Home 통합 시나리오에서 touch pointerdown 직후 `listening pressed`와 `지금 듣고 있어요`가 표시됐다. 이후 DOM click으로 녹음을 중지하자 실제 호출 순서가 `transcribe → ask → tts`로 기록됐고, tts mock 응답은 `success: true`, `provider: gemini`, 유효한 최소 WAV였다. 답변 텍스트도 채팅에 표시됐다. 미리보기 전환 과정에서 `InvalidStateError: Navigated away from page` 콘솔 이벤트가 3개 있었으나, 앱의 tRPC 호출 순서와 Gemini 성공 응답 처리는 완료됐다. 실제 iPhone Safari에서는 mock이 아닌 실제 권한·Gemini quota 상태를 별도로 확인해야 한다.


2026-08-14 Gemini TTS 제한 원인 조사:
- 프로젝트의 자동 답변 경로는 `askAndSpeak`에서 답변당 `speak()` 1회만 호출하고, AudioPlaybackQueue가 해당 항목당 `tts.synthesize` 1회만 실행한다. 동일한 요청은 서버 in-flight deduplication과 24시간 캐시로 중복 호출을 줄인다.
- 실제 390×844 live flow에서 텍스트 답변 후 `tts.synthesize`가 HTTP 200으로 호출되었지만 `provider: gemini`, `success: false`, `errorCode: rate_limit`을 반환했다. `allowBrowserFallback: false` 정책 때문에 이때 기계음 Web Speech를 자동 재생하지 않고 제한 안내를 표시한다.
- 서버에는 별도의 보호 한도도 있다: 동일 프로세스 기준 기본 일일 80건·20,000자, Gemini 429 이후 기본 15초 회로 차단. 이는 Google의 프로젝트별 한도와 별개인 안전장치이며, 429를 만든 원인을 해소하지는 않는다.
- Google 공식 문서는 Gemini 한도가 프로젝트 단위 RPM(분당 요청), TPM(분당 입력 토큰), RPD(일일 요청) 중 하나라도 초과하면 429가 발생하고, preview 모델은 더 제한적일 수 있다고 설명한다. RPD는 태평양 시간 자정에 초기화된다. `gemini-3.1-flash-tts-preview`는 음성 생성 preview 모델이며 입력 토큰 8,192·출력 토큰 16,384 한도를 갖는다.
- 결론: 질문 직후 자동 호출 자체가 잘못된 것은 아니다. 다만 자동 답변, 다시 듣기, 새로고침 후 반복, 여러 질문을 짧은 시간에 연속 전송하면 TTS 요청 수·입력 토큰이 빠르게 누적되어 RPM/TPM/RPD 또는 preview 모델 용량 제한에 걸릴 수 있다. 이번 직접 증거는 무한 재시도가 아니라 Gemini의 실제 `429 rate_limit` 응답이다.


2026-08-14 Gemini TTS 제한 해제 조사:
Google 공식 문서 기준으로 rate limit은 API 키가 아니라 프로젝트 단위로 적용되며 RPM(분당 요청), TPM(분당 입력 토큰), RPD(일일 요청) 중 하나만 초과해도 429가 발생할 수 있다. RPD는 태평양 시간 자정에 재설정되며 Preview 모델은 더 제한적일 수 있다. 실제 계정별 수치는 로그인된 AI Studio의 Rate limits 화면에서만 확인 가능하다.

현재 브라우저는 Google 로그인 화면으로 이동했으므로 사용자의 프로젝트별 수치·초기화 시각·billing tier는 확인하지 못했다. 프로젝트 로그와 화면에 남은 직접 증거는 `gemini-3.1-flash-tts-preview` 요청의 `HTTP 200` 래퍼 응답 내부 `success: false`, `errorCode: rate_limit`이며, 애플리케이션의 자동 답변·텍스트 표시는 정상이다.

공식적으로 한도를 즉시 무료 해제하는 코드 방법은 없다. 무료 상태에서는 기다려 RPD/단기 rate limit이 풀리는지 확인하고, AI Studio Rate limits/Usage에서 해당 모델을 확인해야 한다. 더 높은 한도는 Google AI Studio에서 billing account를 연결해 Paid Tier로 전환하는 방식이며, Google 문서에는 Free→Tier 1에 billing account 연결이 필요하고 2026년 정책상 최소 선불 충전 등이 안내되어 있다. 이는 무료가 아니며 사용자가 결제·예산·청구 조건을 직접 판단해야 한다.

무료로 가능한 프로젝트 측 대책은 동일 답변 캐시 재사용, 자동 TTS와 수동 다시 듣기의 중복 요청 차단, 답변을 짧게 유지하는 것, 연속 질문·반복 재생을 잠시 줄이는 것, 제한 중에는 글 답변을 계속 제공하는 것이다. 다른 무료 음성 엔진으로 전환하는 것은 Gemini 음성 품질을 유지하는 ‘제한 해제’가 아니라 별도 fallback 선택이다.


## Gemini API 호출 제한 최적화 전략 (2026-08-14)

### 1. 목표와 제한 범위

이 문서의 목적은 Google Gemini API의 프로젝트 단위 quota를 비공식적으로 우회하는 것이 아니라, 정상적인 API 사용 범위에서 불필요한 요청·토큰·재시도를 줄여 429 발생 가능성과 음성 지연을 낮추는 것이다. API 키를 여러 개 만들거나 키를 교대로 사용해 동일 프로젝트의 제한을 우회하는 방식은 quota를 근본적으로 늘리지 않으며, 서비스 정책·남용 방지 체계와 충돌할 수 있으므로 사용하지 않는다.

### 2. 현재 Bible Friend 호출 흐름과 병목

현재 흐름은 음성 입력 → `voice.transcribe` → `ai.ask` → 답변 표시 → `tts.synthesize` → Gemini WAV 재생 순서다. TTS 모델은 환경변수 `GEMINI_TTS_MODEL`로 선택하며 기본값은 `gemini-3.1-flash-tts-preview`다. 서버에는 24시간 메모리 캐시, in-flight deduplication, rate-limit circuit breaker, 일일 내부 quota가 이미 있다. 자동 답변과 수동 다시 듣기의 emotion/style 차이로 같은 텍스트를 다시 호출하지 않도록 TTS 캐시 키는 답변 텍스트·화자·모델 중심으로 안정화했고, 관련 회귀 테스트를 추가했다.

가장 큰 quota 위험은 (a) 짧은 시간에 여러 질문을 보내는 경우의 RPM, (b) 긴 대화 기록과 긴 답변이 만드는 TPM/입력 토큰, (c) 하나의 답변을 문장별 여러 TTS 요청으로 쪼개는 경우의 요청 수, (d) 429를 즉시 반복 재시도하는 경우의 요청 폭증이다. 현재는 한 답변을 단일 WAV 요청으로 처리하는 방향을 유지해야 한다.

### 3. 우선 적용 순서

| 우선순위 | 대책 | 기대 효과 | 주의점 |
| --- | --- | --- | --- |
| P0 | 동일 답변 exact-text 캐시와 in-flight deduplication 유지 | 자동 재생·다시 듣기 중복 요청 제거 | 감정 지시문만 바꾸어 캐시를 분리하지 않음 |
| P0 | 429에는 즉시 재시도하지 않고 `Retry-After` 또는 지수 백오프 적용 | RPM 폭주와 회로 반복 진입 방지 | 429가 quota 소진이면 긴 재시도 대신 글 답변 유지 |
| P0 | TTS는 답변 전체를 단일 요청으로 생성 | 문장 수만큼의 요청 증가 방지 | 너무 긴 답변은 먼저 LLM 단계에서 짧게 제한 |
| P1 | 어린이 답변 길이를 300~500자 수준으로 제한하고 대화 이력은 요약 | 입력·출력 토큰 및 오디오 길이 절감 | 성경 근거와 안전 문맥은 요약에서 보존 |
| P1 | 클라이언트에서 동일 답변 재생 요청을 1~2초 debounce하고 답변 ID로 중복 제거 | 빠른 터치·React 재렌더 중복 방지 | 사용자가 실제로 다른 답변을 요청하는 흐름은 막지 않음 |
| P1 | 429 응답에 `retryAfterMs`, `model`, `requestId`를 포함 | 사용자 안내와 운영 진단 개선 | API 키·프롬프트·개인정보는 로그에 남기지 않음 |
| P2 | 인기 있는 고정 인사·짧은 성경 설명을 사전 생성해 저장소에 보관 | 반복 질문의 Gemini TTS 호출 감소 | 성경 콘텐츠 버전과 음성 모델 버전을 캐시 키에 포함 |
| P2 | 메모리 캐시를 S3/DB 메타데이터 기반 영속 캐시로 확장 | 서버 재시작 후에도 오디오 재사용 | 오디오 원본은 DB BLOB가 아니라 S3에 저장 |
| P3 | 모델별 독립 circuit breaker와 provider health metric 추가 | TTS 모델 장애와 전체 대화 기능 분리 | fallback은 정책적으로 명시하고 자동 무한 전환하지 않음 |

### 4. 토큰과 프롬프트 최적화

LLM 답변에는 `어린이 눈높이`, `한국어`, `한 가지 핵심 설명`, `성경 근거`, `짧은 마무리 질문`을 유지하되, 매 요청마다 반복되는 긴 시스템 지시문과 이미 답변된 대화 이력을 그대로 보내지 않는다. 서버에서 최근 대화 일부를 제한하고 이전 대화는 요약된 짧은 상태로 축약한다. 답변 생성 단계에서 최대 출력 토큰을 제한하고, TTS 직전에 마크다운·URL·중복 인사·불필요한 괄호를 제거한 `speechText`를 만든다. TTS에는 `speechText`만 보내며, 화면 표시용 원문과 음성용 텍스트를 구분한다.

답변을 여러 문장으로 나누어 여러 Gemini TTS 호출을 만드는 방식은 사용하지 않는다. 문장별 재생 UX가 필요해도 서버에는 한 번만 합성 요청을 보내고, WAV 전체를 한 번 재생한다. 문장 단위 큐는 네트워크 요청 큐가 아니라 이미 받은 오디오의 재생 큐여야 한다.

### 5. 캐시 키와 중복 방지 예시

캐시 키는 다음처럼 모델 버전과 음성 프로필을 포함한 정규화 텍스트 기반으로 만든다.

```ts
const speechText = normalizeForSpeech(answer.text);
const cacheKey = sha256([
  "tts-v2",
  env.geminiTtsModel,
  speakerProfile,
  speechText,
].join("\n"));
```

자동 재생과 다시 듣기의 UI 문구나 호출 시점은 캐시 키에 포함하지 않는다. 같은 `speechText`에 대해 이미 생성 중이면 기존 Promise를 반환하고, 완료 후에는 TTL 캐시에서 재사용한다. 단, 실제 음색·화자·모델이 달라지면 캐시를 분리해야 한다.

### 6. 429 재시도와 escalation 정책

429를 받았을 때는 최대 1~2회의 제한된 재시도만 허용하고, 지수 백오프와 jitter를 사용한다. 예시는 `delay = min(30_000, base * 2 ** attempt) + random(0, 500)`이며, 서버가 `Retry-After`를 제공하면 그 값을 우선한다. 429가 반복되면 circuit을 열고 일정 시간 동안 TTS API를 호출하지 않는다. 이 동안 `ai.ask`와 텍스트 채팅은 계속 허용하고, UI에는 “글로는 계속 이야기할 수 있어요. 음성은 잠시 쉬고 있어요.”를 표시한다. 사용자가 누르는 수동 재생 버튼도 circuit이 열린 동안에는 요청을 만들지 않고 동일한 안내를 보여야 한다.

여러 API 키를 교대로 사용해 한도를 우회하는 것은 권장하지 않는다. 정상적인 확장 경로는 Google AI Studio의 Rate limits/Usage에서 프로젝트별 상태를 확인하고, 필요한 경우 billing account 연결을 통해 Paid Tier 또는 공식 rate-limit increase 요청을 검토하는 것이다. 이는 무료 우회가 아니며 비용·청구 한도·결제 잔액을 별도로 관리해야 한다.

### 7. 관측성과 검증 지표

각 TTS 시도에는 개인정보가 아닌 `requestId`, `model`, `cacheHit`, `inFlightHit`, `provider`, `upstreamStatus`, `errorCode`, `audioDurationMs`, `retryCount`만 기록한다. 매일 다음 지표를 확인한다.

| 지표 | 해석 | 경보 기준 예시 |
| --- | --- | --- |
| `tts_requests_total` | 실제 합성 요청 수 | 예상 질문 수보다 급증 |
| `tts_cache_hit_ratio` | 캐시 재사용률 | 70% 미만이면 키·정규화 점검 |
| `tts_429_ratio` | Google 429 비율 | 5분 연속 상승 |
| `tts_inflight_dedup_ratio` | 동시 중복 제거율 | 빠른 중복 터치 탐지 |
| `tts_upstream_latency_ms` | Google 응답 지연 | p95 급증 시 circuit 고려 |
| `tts_audio_playback_error` | 기기 재생 실패 | iPhone/Safari 별도 분류 |

### 8. 무료 운영 기준의 권장 동작

무료 운영에서는 Gemini TTS를 모든 답변에 무조건 호출하지 않고, 답변이 짧고 사용자가 음성을 켠 경우에만 호출하는 것이 안전하다. 이미 캐시된 답변은 즉시 재생하고, 새로운 답변의 Gemini 요청이 제한되면 텍스트 답변을 지연시키지 않는다. 현재 프로젝트처럼 기계적인 Web Speech 자동 fallback을 차단하는 정책을 유지하면 음질은 보호되지만, 음성이 꼭 필요하다면 사용자가 직접 누른 “다시 듣기”에서만 브라우저 fallback을 선택적으로 허용하는 별도 UX를 둘 수 있다. 이 fallback은 Gemini 제한을 해제하는 방법이 아니라 서비스 가용성을 높이는 대체 경로다.

### 공식 근거

[1]: https://ai.google.dev/gemini-api/docs/rate-limits "Gemini API Rate limits"
[2]: https://ai.google.dev/gemini-api/docs/pricing "Gemini Developer API pricing"
[3]: https://ai.google.dev/gemini-api/docs/billing "Gemini API Billing"
[4]: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-tts-preview "Gemini 3.1 Flash TTS Preview"
