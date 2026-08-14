
초기 390×844 Playwright mock 검증은 페이지 reload 전에 mock SpeechRecognition을 주입하지 않아 `isListening=false`로 관찰되었다. 같은 문제를 addInitScript 선주입 방식으로 재시도했으나 브라우저 컨텍스트의 SpeechRecognition mock 노출 여부를 추가 확인해야 한다. 실제 코드는 iPhone에서 SpeechRecognition이 없거나 오류일 때 MediaRecorder→내장 Whisper 전사 fallback으로 이어지도록 보강했으며, 다음 검증에서는 `window.SpeechRecognition` 존재와 pointer/touch 이벤트를 별도로 확인한다.

최신 DOM 기반 390×844 검증에서는 touch pointerdown 직후 `.bf-mic-button`이 `listening pressed` 상태가 되고, 안내 문구가 `지금 듣고 있어요`로 바뀌며, 확대된 그림자 값이 적용됐다. 실제 좌표 mouse 검증은 미리보기 오버레이 영향으로 상태를 읽지 못했지만, DOM 이벤트 경로는 정상 동작했다. 브라우저에서 SpeechRecognition·webkitSpeechRecognition·MediaRecorder·getUserMedia API가 모두 노출되는 것도 확인했다.

390×844 touch lifecycle 재검증에서는 Firefox mock에 `TouchEvent` 생성자가 없어 첫 시나리오는 실행되지 않았고, 일반 `touchstart`/`touchend` 이벤트로 재실행했다. touchstart 직후 `.bf-mic-button`은 `listening pressed`, 안내는 `지금 듣고 있어요`로 바뀌었고, touchend 뒤에는 pressed만 해제되고 listening 상태는 유지되어 한 번 눌러 듣기 시작→다시 눌러 중지하는 UX가 정상적으로 보존됐다. 콘솔 오류는 없었다.

실제 390×844 Home live flow에서 글 질문 `하나님은 나를 사랑하시나요?`를 전송했고, 답변 텍스트가 도착한 뒤 `tts.synthesize`가 자동 호출됐다. 응답은 HTTP 200이지만 `provider: gemini`, `success: false`, `errorCode: rate_limit`이었다. 현재 `allowBrowserFallback: false` 정책 때문에 이 상태에서 Web Speech 기계음으로 자동 전환하지 않고, 글 답변은 계속 표시된다. 이는 자동 호출 경로는 정상이며 현재 실제 Gemini 음성이 들리지 않는 직접 원인이 free-tier quota 제한임을 확인한다.

MediaRecorder mock·SpeechRecognition 비활성화 상태의 390×844 Home 통합 시나리오에서 touch pointerdown 직후 `listening pressed`와 `지금 듣고 있어요`가 표시됐다. 이후 DOM click으로 녹음을 중지하자 실제 호출 순서가 `transcribe → ask → tts`로 기록됐고, tts mock 응답은 `success: true`, `provider: gemini`, 유효한 최소 WAV였다. 답변 텍스트도 채팅에 표시됐다. 미리보기 전환 과정에서 `InvalidStateError: Navigated away from page` 콘솔 이벤트가 3개 있었으나, 앱의 tRPC 호출 순서와 Gemini 성공 응답 처리는 완료됐다. 실제 iPhone Safari에서는 mock이 아닌 실제 권한·Gemini quota 상태를 별도로 확인해야 한다.
