
초기 390×844 Playwright mock 검증은 페이지 reload 전에 mock SpeechRecognition을 주입하지 않아 `isListening=false`로 관찰되었다. 같은 문제를 addInitScript 선주입 방식으로 재시도했으나 브라우저 컨텍스트의 SpeechRecognition mock 노출 여부를 추가 확인해야 한다. 실제 코드는 iPhone에서 SpeechRecognition이 없거나 오류일 때 MediaRecorder→내장 Whisper 전사 fallback으로 이어지도록 보강했으며, 다음 검증에서는 `window.SpeechRecognition` 존재와 pointer/touch 이벤트를 별도로 확인한다.

최신 DOM 기반 390×844 검증에서는 touch pointerdown 직후 `.bf-mic-button`이 `listening pressed` 상태가 되고, 안내 문구가 `지금 듣고 있어요`로 바뀌며, 확대된 그림자 값이 적용됐다. 실제 좌표 mouse 검증은 미리보기 오버레이 영향으로 상태를 읽지 못했지만, DOM 이벤트 경로는 정상 동작했다. 브라우저에서 SpeechRecognition·webkitSpeechRecognition·MediaRecorder·getUserMedia API가 모두 노출되는 것도 확인했다.

390×844 touch lifecycle 재검증에서는 Firefox mock에 `TouchEvent` 생성자가 없어 첫 시나리오는 실행되지 않았고, 일반 `touchstart`/`touchend` 이벤트로 재실행했다. touchstart 직후 `.bf-mic-button`은 `listening pressed`, 안내는 `지금 듣고 있어요`로 바뀌었고, touchend 뒤에는 pressed만 해제되고 listening 상태는 유지되어 한 번 눌러 듣기 시작→다시 눌러 중지하는 UX가 정상적으로 보존됐다. 콘솔 오류는 없었다.
