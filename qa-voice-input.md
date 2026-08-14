
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
