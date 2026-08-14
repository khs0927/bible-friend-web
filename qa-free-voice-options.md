# 무료 음성 호출 조사

## 브라우저 내장 Web Speech

MDN은 Web Speech API가 음성 인식(`SpeechRecognition`)과 음성 합성(`SpeechSynthesis`) 두 부분으로 구성된다고 설명한다. 인식은 플랫폼이 제공하는 서비스 또는 일부 브라우저의 로컬 처리에 의존하고, 합성은 기기의 기본 음성 합성기를 사용한다. 따라서 별도 API 키·서버 GPU 없이 즉시 음성 입력과 기본 TTS를 시작할 수 있지만, 음질·한국어 voice·브라우저 지원은 기기와 브라우저에 좌우된다.

Can I Use의 SpeechRecognition 자료는 모바일 Safari가 부분 지원 및 prefix 제약이 있음을 보여 주므로, iPhone Safari에서는 `webkitSpeechRecognition`을 계속 지원하고 반드시 마이크 권한·실패·미지원 상태를 안내해야 한다. 무료이며 즉시 시작할 수 있지만, 고품질 Gemini 음성 출력 자체를 대체하지는 않는다.

출처: [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API), [Can I Use SpeechRecognition](https://caniuse.com/mdn-api_speechrecognition)

## Gemini Live API

Gemini 공식 가격 페이지는 개발자 무료 티어를 제공하지만 모델별 접근·입출력 토큰과 rate limit이 제한된다고 명시한다. 즉 무료로 시작할 수는 있으나 무제한·항상 보장되는 무료 음성 호출은 아니다. 현재 프로젝트에서 이미 확인한 것처럼 TTS quota가 소진되면 Gemini 요청이 지연되거나 제한될 수 있다.

공식 Live API 문서는 저지연 양방향 음성 대화에 WebSocket을 사용하며, 입력은 16-bit PCM 16kHz, 출력은 16-bit PCM 24kHz라고 설명한다. 클라이언트가 Live API에 직접 연결하면 서버 왕복을 줄일 수 있어 가장 빠르지만, 일반 API key를 브라우저에 노출하면 안 되므로 운영에서는 ephemeral token이 권장된다. 무료 범위에서 가능한 선택은 짧은 세션·명확한 사용량 제한을 둔 Live API 실험 또는 현재처럼 브라우저 음성 인식 + 서버 Gemini TTS 조합이다.

출처: [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing), [Gemini Live API overview](https://ai.google.dev/gemini-api/docs/live-api)

## UI 구현 검증

최신 미리보기 DOM 계산값에서 답변 글씨는 `15px`, 줄간격 `27px`, 입력 글씨는 `15px`, 마이크 버튼은 `46×46px`로 확인됐다. 답변 말풍선 부모에는 `bfChatPop` 애니메이션이 적용됐고, `prefers-reduced-motion` 미디어 규칙도 유지된다. 음성 상태 배지는 speaking 상태에서 점 애니메이션을 사용하도록 status class를 연결했다.

## 모바일 터치 음성 호출 검증

Playwright에서 viewport를 390×844px로 설정하고 SpeechRecognition을 mock한 뒤 `.bf-mic-button`에 `pointerdown(pointerType:"touch")`를 보냈다. 50ms 뒤 상태가 `듣고 있어요… 천천히 말해 주세요`로 바뀌었으며, 이어지는 합성 click 이후에도 같은 상태가 유지됐다. 이는 터치 제스처에서 `recognition.start()`가 즉시 호출되고, click 이벤트가 녹음을 곧바로 중지시키지 않도록 중복 방지 로직이 작동함을 의미한다. 실제 마이크 권한·음성 인식 서버는 mock 범위 밖이다.
