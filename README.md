
## Gemini TTS 음성 대화

성경 친구의 음성 출력은 서버 전용 `TTSProvider` 추상화 뒤에서 동작합니다. 기본 Provider는 Google Gemini TTS이며, Gemini 호출 실패 또는 설정 부재 시 CosyVoice를 시도하고, 두 서버 Provider가 모두 실패하면 브라우저의 한국어 Web Speech API로 안전하게 전환합니다. 브라우저 번들에는 `GEMINI_API_KEY`가 포함되지 않습니다.

기본 모델은 `gemini-2.5-flash-preview-tts`이고, Google Gemini Interactions API의 `response_format: audio`를 사용합니다. Gemini가 반환한 24kHz PCM 오디오에는 서버에서 WAV 헤더를 추가해 모바일 브라우저에서 재생 가능한 `audio/wav`로 변환합니다. 한국어 문장 경계에서 요청을 나누어 프론트엔드 `AudioPlaybackQueue`에 넣으므로 전체 답변이 끝난 뒤 한 덩어리로 재생하지 않고 앞 문장부터 재생할 수 있습니다.

저지연 경로에서는 서버 TTS가 약 1.2초 안에 준비되지 않으면 브라우저 Web Speech를 먼저 시작합니다. 서버 요청은 취소하지 않고 계속 실행해 성공한 오디오를 서버 캐시에 남기므로, 아이는 기다리지 않고 듣기 시작하면서 다음 동일 문장은 고품질 서버 음성을 사용할 수 있습니다. 서버 TTS가 1.2초 안에 완료되면 Gemini 음성을 우선 사용합니다.

### 환경변수

`.env.example`를 복사해 서버 실행 환경에 설정합니다. 실제 API 키는 커밋하거나 프론트엔드 코드에 작성하지 말고 WebDev Secrets에서 관리합니다.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | 없음 | Gemini Developer API 인증 키. 서버에서만 사용 |
| `GEMINI_TTS_MODEL` | `gemini-2.5-flash-preview-tts` | 사용할 Gemini TTS 모델 |
| `GEMINI_TTS_TIMEOUT_MS` | `30000` | 음성 요청 타임아웃 |
| `GEMINI_TTS_MAX_CHARS` | `900` | 한 문장·요청의 최대 문자 수 |
| `GEMINI_TTS_DAILY_REQUESTS` | `80` | 서버 인스턴스별 일일 Gemini 요청 보호 한도 |
| `GEMINI_TTS_DAILY_CHARS` | `20000` | 서버 인스턴스별 일일 Gemini 문자 보호 한도 |
| `COSYVOICE_API_URL` | 없음 | 선택형 CosyVoice `/tts` 폴백 엔드포인트 |

현재 비용 보호는 요청 중복 제거, 완료된 오디오의 24시간 메모리 캐시, 최대 문자 수, 일일 요청·문자 수, 타임아웃, 제한 오류 분류를 포함합니다. 저지연 브라우저 선행 폴백은 서버 호출을 중복하지 않으며, 늦게 도착한 서버 결과는 캐시 워밍에만 사용합니다. 캐시는 인스턴스 메모리 기반이므로 배포 인스턴스가 교체되면 초기화됩니다. 성경 구절과 대표 안내 음성을 장기적으로 재사용하려면 S3 오디오 자산 라이브러리를 별도 구축하는 것이 적합합니다.

### 화자 프로필

`BibleVoiceDirector` 역할은 `server/_core/tts.ts`의 `resolveVoice`가 담당합니다. `NARRATOR`는 `Sulafat`(Warm), `JESUS`는 `Vindemiatrix`(Gentle), `DAVID`는 `Puck`(Upbeat), `PETER`는 `Fenrir`(Excitable), `MARY`는 `Achernar`(Soft), `CHILD_FRIEND`는 `Leda`(Youthful)를 기본 음성으로 사용합니다. 실제 인물의 목소리를 복제하지 않으며, 캐릭터의 분위기만 자연어 지시문으로 설명합니다.

### 검증

```bash
pnpm check
pnpm test
```

테스트는 WAV 변환, 한국어 화자 지시문, 캐시 재사용, 동시 요청 deduplication, 첫 오디오 latency 측정값, Gemini rate-limit 안전 응답, Gemini 실패 후 CosyVoice 폴백, 두 서버 Provider 실패 후 안전 오류를 검증합니다. `server/geminiKey.test.ts`는 설정된 키로 가벼운 Gemini 모델 목록 엔드포인트를 확인합니다.

### 현재 제한사항

Gemini TTS 공식 스트리밍 API와 Gemini Live API는 더 낮은 지연을 위한 차선책입니다. 다만 현재 프로젝트의 `ai.ask` 계약은 완성된 LLM 답변을 반환하는 비스트리밍 mutation이므로, 먼저 1.2초 브라우저 선행 폴백을 적용했습니다. 이후 완전한 end-to-end streaming이 필요하면 LLM 토큰을 SSE로 전달하거나 Gemini Live API/WebSocket 세션으로 전환해야 하며, 이는 음성 입력·중단·세션 수명 관리까지 포함하는 별도 API 계약 변경입니다. Google 무료 계층과 TTS Preview 사용량은 계정·모델·시점에 따라 달라질 수 있으므로 실제 운영 전 Google AI Studio와 Gemini API 가격 페이지에서 확인해야 합니다.
