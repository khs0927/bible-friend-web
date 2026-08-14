# Gemini TTS 조사 기록

확인일: 2026-08-14

## 공식 확인

Google Gemini TTS 공식 문서는 `POST https://generativelanguage.googleapis.com/v1beta/interactions`에 `x-goog-api-key`와 JSON body를 사용하고, `response_format: { type: "audio" }`, `generation_config.speech_config`의 `voice`를 설정하도록 안내한다. 응답 오디오는 `interaction.output_audio.data`의 base64 PCM이며, 공식 WAV 예제는 **24,000Hz·mono·16-bit PCM**으로 저장한다.

현재 프로젝트의 `GeminiTTSProvider` 요청 endpoint, header, `output_audio.data` 추출, 24kHz PCM WAV 변환은 공식 구조와 일치한다.

공식 모델 문서에서 현재 모델 ID `gemini-2.5-flash-preview-tts`가 유효하고, TTS는 텍스트 입력/오디오 출력 모델로 명시되어 있다. 공식 TTS 가이드는 최신 상호작용 예제에 `gemini-3.1-flash-tts-preview`도 보여 주므로, 운영 환경에서는 환경변수 모델을 사용하되 실제 키의 모델 접근 가능성을 응답 로그로 확인해야 한다.

공식 rate-limit 문서에 따르면 제한은 프로젝트 단위로 적용되고 RPM·TPM·RPD를 포함하며, Preview 모델은 더 제한적일 수 있다. RPD는 Pacific 자정에 초기화된다. 429/RESOURCE_EXHAUSTED가 발생하면 Web Speech fallback이 선택되어 iPhone에서 기계음이 들리는 것이 현재 증상과 일치한다.

## 현재 코드와 원인

현재 `synthesizeSpeechInternal`은 Gemini 성공이면 `provider: "gemini"`인 WAV를 반환하지만, Gemini가 rate-limit/circuit-breaker/quota/timeout으로 실패하면 CosyVoice를 시도하고, 둘 다 실패하면 `{ success: false, fallbackSuggested: true }`를 반환한다. 프론트 `AudioPlaybackQueue`는 이 응답을 Web Speech로 처리하므로 iPhone에서 기계음이 들린다.

따라서 기계음의 직접 원인은 iPhone 음성 엔진 자체가 아니라 **Gemini TTS 실패 후 클라이언트가 Web Speech fallback을 자동 선택한 것**이다. Gemini 사용량 제한이 해소되지 않는 한 코드만으로 Gemini 오디오를 새로 생성할 수는 없으므로, 구현에서는 (1) Gemini 성공 응답을 절대 Web Speech로 대체하지 않음, (2) provider/model/응답 크기/오류를 노출해 실제 경로를 확인함, (3) Gemini 실패 시 자동 기계음 대신 명확한 재시도 안내를 우선하는 정책이 안전하다.

## 실제 API 재현 결과

2026-08-14 직접 Gemini 호출에서 짧은 문장은 HTTP 200과 `output_audio`를 반환했지만, 서버와 동일한 CHILD_FRIEND/Leda 스타일 프롬프트를 반복 호출하자 HTTP 429가 재현되었다. 응답 본문은 `You exceeded your current quota` 및 `generativelanguage.googleapis.com/generate_content_free_tier_requests`, `limit: 10`, `model: gemini-2.5-flash-tts`를 명시했고 약 45.8초 후 재시도하라고 안내했다.

로컬 tRPC 호출도 동일하게 `success:false`, `provider:"gemini"`, `errorCode:"rate_limit"`을 반환했다. 즉 현재 기계음은 모델·WAV 파싱 문제가 아니라 Gemini free-tier TTS 요청 quota 초과로 서버 오디오가 생성되지 않아 기존 클라이언트가 Web Speech를 자동 실행한 결과다. 이 세션에서는 quota를 코드로 늘릴 수 없으므로, 구현은 Gemini 성공 전에는 Web Speech를 재생하지 않고, 429이면 기계음 대신 명확한 재시도 상태를 보여 주도록 변경한다. 실제 Gemini WAV 성공은 quota가 재개된 뒤 동일한 tRPC 호출로 재검증한다.

## 최신 미리보기 검증

최신 미리보기는 `Gemini 한국어 음성 준비됨` 배지를 표시했다. 답변 우측 스피커 버튼을 클릭한 뒤 브라우저 화면의 상태가 `성경 친구가 말하고 있어요…`로 바뀌었고, 이전처럼 `브라우저 음성으로 이어서 재생해요`가 나타나지 않았다.

별도 로컬 tRPC 검증에서는 `success:true`, `provider:"gemini"`, `model:"gemini-3.1-flash-tts-preview"`, `mimeType:"audio/wav"`, `latencyMs:6117`, `fallback:false`, base64 prefix `UklGRiQ`(RIFF/WAV)를 확인했다. 따라서 새 모델로 서버가 실제 Gemini WAV를 반환하고, 클라이언트가 서버 WAV 경로를 우선 재생하는 것을 검증했다.

## 모바일 브라우저 검증

Playwright Firefox를 390×844px iPhone 크기로 맞춘 뒤 최신 미리보기를 열었다. 모바일 화면에서 `Gemini 한국어 음성 준비됨` 상태와 답변 다시 듣기 버튼이 존재했으며, 해당 버튼 클릭이 정상 처리됐다. 클릭 직후 Playwright 콘솔은 오류 0건·경고 0건으로 보고했다. 이 검증은 실제 물리 iPhone의 청취를 대신하지 않으며, 실제 iPhone Safari에서 최종 음량/스피커 출력은 사용자가 확인해야 한다.

## 최종 서버 재검증

환경변수 반영 후 서버를 재시작하고 동일한 CHILD_FRIEND 요청을 다시 호출했다. 결과는 `success:true`, `provider:"gemini"`, `model:"gemini-3.1-flash-tts-preview"`, `mimeType:"audio/wav"`, `latencyMs:23097`, `fallback:false`, base64 prefix `UklGRiT`로 확인됐다. 23초가 걸렸지만 30초 hard timeout 안에서 실제 WAV가 반환됐다.

모바일 Playwright의 첫 다시 듣기 요청은 200 HTTP이지만 `success:false`, `provider:"gemini"`, `errorCode:"timeout"`으로 종료된 케이스도 확인했다. 이 경우 새 문구는 기기 음성으로 전환한다고 거짓 안내하지 않고 `Gemini 음성을 준비하는 데 시간이 걸리고 있어요. 잠시 후 다시 눌러 주세요.`를 표시하도록 수정했다. 즉 느린 upstream은 기계음 자동 fallback 없이 명확한 재시도로 처리한다.

최종 모바일 재검증을 위해 최신 서버를 Playwright Firefox에서 다시 열었고, 390×844px viewport 적용이 정상 완료됐다. 페이지 제목과 앱 화면이 정상 로드되어 새 모델 번들 접근에는 문제가 없었다.

최신 서버 재시작 후 모바일 다시 듣기 버튼을 다시 눌렀고, Playwright 네트워크에서 `/api/trpc/tts.synthesize?batch=1` POST가 HTTP 200으로 확인됐다. 응답 본문 상세는 다음 단계에서 provider와 성공 여부를 확인한다.

최종 390×844 모바일 다시 듣기 검증은 성공했다. `/api/trpc/tts.synthesize?batch=1`가 HTTP 200을 반환했고 응답 본문에 `success:true`, `audioBase64`가 `UklGRiR0...`(RIFF/WAV)로 시작하며, 이후 로컬·서버 검증과 같은 Gemini 3.1 WAV 경로로 재생된다. 이전 timeout 케이스와 달리 최신 서버 재시작 후 실제 모바일 크기 페이지에서 성공 응답을 확보했다. Playwright는 오디오 하드웨어 청취 자체는 측정하지 못하므로 실제 iPhone 스피커 청취만 사용자 확인 사항으로 남는다.

자동 질문 경로도 최종 확인했다. 모바일 390×844 화면에서 질문을 입력·전송했고 답변이 화면에 표시됐다. 그 뒤 생성된 `/api/trpc/tts.synthesize?batch=1`가 HTTP 200이며 응답 `success:true`, `audioBase64` prefix `UklGRiR0...`(RIFF/WAV)로 확인됐다. 따라서 자동 응답 재생과 다시 듣기 모두 기계음 Web Speech를 선행하지 않고 Gemini 서버 WAV를 요청한다.
