# 성경 친구 영구 프로젝트 QA 메모

## 2026-08-12

영구 WebDev 미리보기 `https://3000-i47mrn7noomyhycbk0nld-b641ebb5.sg1.manus.computer/`에서 성경 친구의 한국어 제목, 모바일 퍼스트 히어로, 음성 채팅 패널, 하단 네비게이션, 말씀 보물찾기, Gemini Orchestrator 카드가 렌더링되었다.

스토리 API 응답으로 고정된 5개 제목이 표시되었고, 업로드된 WebDev Storage 경로가 노아·다윗·예수님·천지창조·요셉 카드 이미지의 src로 연결되었다. 브라우저 페이지의 추출 콘텐츠에도 5개 이미지 경로와 점수 `0점`이 확인되었다. 점수 영역은 비로그인 상태에서도 안전하게 0점으로 표시되며, 코드상 로딩 시 `점수 불러오는 중`, 오류 시 `점수 저장 전` 상태를 표시한다.

경량 채팅 패널에는 한국어 질문 textarea, 제안 질문 버튼, 마이크 버튼, 전송 버튼, 답변 음성 버튼이 표시되었다. 개발 서버 미리보기는 정상적으로 실행되었으며, 프로덕션 `pnpm build`와 TypeScript 검사가 성공했다.

노아의 방주 카드 클릭을 재시도한 뒤 상세 모달이 열렸다. 모달의 상단 이미지가 `/manus-storage/story_noah_a1e0e2bf.png`에서 실제로 렌더링되었고, 제목·본문·오늘의 마음 보물·창세기 9:13·이야기 들려줘 버튼이 함께 표시되었다. 배경은 블러 처리되어 몰입형 상세 경험이 확인되었다.

모달 닫기 후 말씀 보물찾기 모험 시작을 눌렀다. 페이지가 퀴즈 영역으로 스크롤되고 게임 카드가 정상 반응했다. 개발 미리보기 하단 고정 안내가 보이지만 사이트 본문 기능을 가리지 않으며, 스토리 카드 5종의 실제 일러스트도 모두 확인되었다.

영구 사이트의 질문 입력창에 `노아의 방주에서 배울 수 있는 마음은 무엇인가요?`를 입력하고 전송했다. 사용자 메시지와 `성경 친구가 생각하고 있어요…` 로딩 상태가 표시되어 서버 사이드 에이전트 호출 흐름이 시작되는 것을 확인했다.

서버 사이드 Gemini 답변 테스트가 완료되었다. 노아의 방주 질문에 대해 한국어 공감·설명·실천 질문이 포함된 답변이 채팅 버블에 표시되었고, 콘솔에는 오류가 없었다. 답변 버블의 음성 듣기 버튼도 함께 표시되었다.

브라우저 DOM에서 `모험 시작` 버튼을 찾아 클릭하는 검증을 수행했다. 버튼이 존재하고 이벤트 핸들러가 연결되어 있음을 확인했다. 관리형 Preview 모드의 하단 안내 오버레이 때문에 좌표 클릭 시 화면 전환이 시각적으로 즉시 드러나지 않을 수 있으나, 코드에는 `quizStarted` 상태와 quiz query loading/error/정답 피드백 분기가 포함되어 있다.

퀴즈 화면에서 다윗과 골리앗 문제와 4개 선택지가 표시되었다. 정답 `A 물매돌`을 선택하자 버튼이 비활성화되고 `정답이야! 정말 멋져요!` 피드백과 설명, `다시 도전하기` 버튼이 나타났다. 말씀 보물찾기 핵심 상호작용이 실제 브라우저에서 확인되었다.

음성 검증에서 마이크 버튼을 실제로 눌렀고, 브라우저 콘솔에서 `SpeechRecognition`/`webkitSpeechRecognition` 지원 여부와 `speechSynthesis` 호출을 확인했다. 한국어 TTS utterance(`ko-KR`)를 호출했으며, 실제 STT 입력은 Preview 브라우저의 마이크 권한·오디오 장치 상태에 따라 자동화 환경에서 음성 문장까지 수집되지 않을 수 있다. 앱은 지원 브라우저에서 `ko-KR` 인식과 감정 표현 TTS를 사용하도록 구현되어 있다.

`getScoreLabel`을 별도 헬퍼로 분리해 로딩·오류·null·저장 점수 4개 상태를 테스트 가능하게 만들었다. `pnpm check` 통과, Vitest 3개 파일·9개 테스트 전부 통과.

최종 체크포인트 후 실제 브라우저에서 `SpeechRecognition`/`webkitSpeechRecognition` 인스턴스를 만들고 `lang = ko-KR`, `start()`를 호출했다. 콘솔에는 실행 코드가 남았고, Preview 자동화 환경에서는 음성 입력 권한/장치가 노출되지 않아 실제 전사 결과 콜백까지 수집되지 않았다. 따라서 앱 구현은 지원 브라우저·실제 모바일 기기에서 마이크 권한을 허용한 뒤 검증해야 한다. TTS는 `speechSynthesis.speak()` 호출을 앞서 수행했다.

## 2026-08-12 Gemini TTS 무음 재현

미리보기에서 `Gemini 한국어 음성 준비됨` 상태가 보였다. 질문 `하나님은 나를 사랑하시나요?`를 입력하고 전송했을 때 사용자 메시지는 화면에 추가되었지만 잠시 동안 `성경 친구가 생각하고 있어요…` 로딩 상태가 유지되었다. 자동화 환경의 청각 채널만으로 실제 소리 유무를 판정할 수 없으므로 서버 응답·브라우저 콘솔·Audio.play 실패 상태를 별도로 확인해야 한다.

브라우저 점검에서 질문 답변은 정상적으로 채팅 버블에 표시되었고 콘솔에는 오류가 없었다. 직접 확인한 `GET /api/trpc/tts.synthesize`는 mutation을 GET으로 호출해 405를 반환했으므로, 실제 음성 API 확인은 POST로 해야 한다. 현재 무음 원인을 오디오 재생 Promise 및 POST 응답 데이터까지 추가 확인할 필요가 있다.

POST `/api/trpc/tts.synthesize`를 올바른 배치 형식으로 직접 호출한 결과 HTTP 200이지만 `success: false`, `errorCode: rate_limit`, `audioBase64Length: 0`이 반환되었다. 따라서 현재 미재생의 1차 원인은 Gemini TTS가 무료/API rate limit에 걸려 서버 오디오를 생성하지 못하는 것이다. 클라이언트는 이 경우 Web Speech 폴백을 실행해야 하므로 브라우저 `speechSynthesis` 존재·호출·권한을 추가 확인하고, rate-limit 상태를 UI에 명확히 표시할 필요가 있다.

Gemini 기본 모델을 `gemini-2.5-flash-preview-tts`로 바꾸고 steps 오디오 추출을 수정한 뒤, 브라우저 tRPC POST에서 `success: true`, `provider: gemini`, WAV Base64 약 226KB, `latencyMs: 14039`를 확인했다. 즉 서버 오디오 자체는 생성된다. 이후 새 문장 테스트에서는 TTS 요청이 기본 18초 timeout에 걸려 `errorCode: timeout`이 반환되었다. AudioContext 테스트는 오디오 디코드·재생을 시작했지만 긴 음성의 종료 이벤트가 3초 안에 오지 않아 테스트 타임아웃으로 끝났으므로, 재생 데이터의 유효성과 재생 종료 시간을 분리해 판정해야 한다.

최종 브라우저 디코드 점검에서 Gemini 2.5 WAV는 `bytes: 175290`, `channels: 1`, `duration: 3.65095초`, `sampleRate: 44100`, AudioContext `running` 상태로 디코드되었다. 즉 서버 오디오와 브라우저 디코더는 정상이며, 사용자 제스처에서 AudioContext를 prime한 뒤 Web Audio로 재생하는 수정이 적용되었다.

수정된 미리보기에서 채팅 제목 아래 `Gemini 한국어 음성 준비됨` 상태 배지가 표시되었다. 실제 질문 전송 시 사용자 메시지와 `성경 친구가 생각하고 있어요…` 로딩이 정상 시작되었으며, 답변이 완료되면 큐의 `onPlaybackStarted`/`onPlaybackError`에 따라 `성경 친구가 말하고 있어요…`, `브라우저 음성으로 이어서 재생해요`, 또는 오류 원인이 표시되도록 연결되어 있다. 자동화 브라우저의 청각 출력 자체는 도구가 판정하지 못하지만, Home 상호작용·tRPC·WAV·AudioContext 디코드 경로는 확인했다.

실제 Home 상호작용 검증을 위해 TTS 응답을 rate-limit으로 모의하고 초기 답변의 `이 답변 듣기` 버튼을 눌렀다. 미리보기 채팅 영역에 실제로 `브라우저 음성 엔진이 재생을 시작하지 못했어요.`가 표시되었다. 따라서 `AudioPlaybackQueue.onPlaybackError` → Home `voiceStatus = error` → 오류 상태 배지 렌더링 경로가 브라우저에서 확인되었다.

실제 Home 성공 경로도 검증했다. 서버가 반환한 실제 Gemini WAV 샘플을 TTS 응답으로 연결한 뒤 초기 답변의 `이 답변 듣기`를 클릭하자 채팅 영역에 `성경 친구가 말하고 있어요…`가 실제로 표시되었다. 즉 `onPlaybackStarted` → Home `voiceStatus = speaking` → 상태 배지 렌더링이 브라우저에서 확인되었다.

저지연 조사 및 측정 결과: 로컬 tRPC `ai.ask`는 짧은 한국어 질문에서 HTTP 200, 총 약 2.23초, 답변 225자였다. 같은 경로의 `tts.synthesize`는 현재 Gemini 계정 rate-limit 응답을 약 0.80초에 반환했으며, 이전 성공 호출은 첫 오디오까지 긴 대기를 보였다. 공식 문서 확인 결과 Gemini 2.5/3.1 TTS는 저지연 모델이지만 Interactions API의 unary 응답은 완성 오디오를 기다린다. 따라서 `AudioPlaybackQueue`에 1.2초 선행 Web Speech 폴백을 추가하고 늦은 서버 결과는 캐시 워밍에 사용하도록 결정했다. Google Cloud Gemini-TTS bidirectional streaming과 Gemini Live API는 후속 완전 스트리밍 전환 후보이며, Cloud TTS streaming은 GCP 프로젝트·billing·Chirp 3 HD 조건이 필요하다.

저지연 브라우저 검증을 위해 최신 미리보기에서 `tts.synthesize` 응답을 1.6초 지연시키는 trace와 Web Speech `start/error` 시각 기록을 설치했다. 다음 상호작용에서 1.2초 선행 폴백과 Home 상태 배지 전환을 측정한다.

저지연 브라우저 회귀에서 질문 전송 직후 Home에 `성경 친구가 생각하고 있어요…` 로딩 상태가 실제 표시되었다. TTS trace는 답변 생성 완료 뒤 호출되므로 다음 페이지 관찰에서 1.2초 브라우저 선행 재생 시각을 확인한다.

실제 브라우저 지연 폴백 회귀 결과: 질문 응답 후 TTS 요청 시각 `55304.2ms`, Web Speech 오류 시각 `56488.6ms`로 측정되어 서버 TTS 응답을 기다리지 않고 약 `1184.4ms` 후 브라우저 음성 경로에 진입했다. 브라우저 엔진 자체는 미리보기 환경에서 `synthesis-failed`를 발생시켰고 Home에는 `브라우저 음성 엔진이 재생을 시작하지 못했어요.`가 표시되었다. 즉 1.2초 선행 폴백 트리거는 실제 브라우저에서 확인되었지만, 미리보기의 Web Speech 엔진은 소리를 재생하지 못했다.

추가 확인: 미리보기 Chromium의 `speechSynthesis.getVoices()`가 음성 0개를 반환했다. 따라서 현재 미리보기의 Web Speech 무음은 앱 코드만의 문제가 아니라 브라우저 샌드박스에 한국어 음성 엔진이 없는 환경 제약으로 판단한다. 실제 Android Chrome/iOS Safari에서는 기기 음성 엔진 유무에 따라 동작하며, 음성 목록이 0개이면 명시적인 오류 배지를 유지한다.

성공 모드 브라우저 회귀를 위해 Web Speech `speak()`을 `onstart`·`onend` 콜백으로 즉시 실행하는 deterministic stub을 설치했고, 두 번째 질문 `오늘 용기를 내고 싶어요.`를 입력했다. 전송 후 trace에서 서버 TTS보다 브라우저 첫 재생이 먼저 시작되는지 확인한다.

성공 모드 두 번째 질문 전송 후 현재 미리보기는 페이지 하단에 머물렀고 새 답변·음성 배지는 아직 추출되지 않았다. 다음 단계에서 채팅 영역을 직접 확인하거나 trace를 읽어 전송 여부를 구분한다.

브라우저 재현 보정: 이전 시도는 textarea가 아닌 버튼 인덱스를 대상으로 해 전송되지 않았다. 현재 textarea index 6에 `오늘 용기를 내고 싶어요.`가 정상 입력되었고, 질문 보내기 버튼은 index 7이다.

성공 모드 브라우저 회귀에서 두 번째 질문 답변이 정상 생성되어 Home 채팅 버블에 표시되었다. 현재 성공 stub은 오디오 이벤트를 직접 발생시키므로 다음 trace 조회로 실제 1.2초 선행 재생 시각과 speaking 상태를 확인한다.

성공 모드 최종 trace: `ttsRequestAt=345225.0ms`, `browserStartAt=346409.5ms`, first-playable까지 `1184.5ms`로 측정됐다. `browserEndAt=346439.8ms`, 브라우저 오류는 없었다. Home 본문 텍스트에는 speaking 배지 문구가 없었지만 deterministic speech 이벤트와 audio queue callback은 실행되었고, 채팅 답변은 정상 표시됐다. 운영 브라우저에서는 동일 콜백에 연결된 VoiceStatusBadge 단위·HomeVoiceStatus 테스트로 상태 계약을 검증한다.

서버 완료시각·배지 계측 코드 반영 후 미리보기 화면을 확인했다. 현재 질문 textarea는 index 6, 전송 버튼은 index 7이며 채팅은 초기 상태로 재로드되어 성공 경로를 다시 재현할 수 있다. 브라우저 음성 stub은 onend를 3초 뒤에 호출하도록 설정했다.

업데이트된 Home 성공 경로에서 `용기를 주세요.` 질문이 실제 채팅 버블에 표시되고 `성경 친구가 생각하고 있어요…` 상태가 나타났다. 답변 완료 후 3초 음성 stub 동안 speaking 배지가 DOM에 유지되는지 다음 관찰에서 확인한다.

업데이트 후 성공 경로 답변이 정상 표시되었지만 browser_view 시점에는 3초 음성 stub이 이미 끝났거나 상태 배지가 기본 준비 상태로 돌아가 speaking 문구가 추출되지 않았다. 다음에는 TTS 요청·callback 직후 console에서 DOM을 즉시 읽어야 하며, 코드상 speaking 유지 시간을 800ms로 늘려 관찰 가능성을 확보했다.

브라우저 성공 모의 1차 시도에서 Home 상태는 `브라우저 음성으로 이어서 재생해요`로 나타났고 speaking 상태는 확인되지 않았다. 이는 TTS 응답 mock이 실제 tRPC fetch 경로를 가로채지 못했거나 HTMLAudio 전역 mock이 모듈 경로에 적용되지 않은 것으로 보여, 다음 시도에서 `globalThis.fetch`와 `globalThis.Audio`를 함께 대체해 서버 성공 재생 경로를 직접 검증한다.

성공 경로 최종 브라우저 검증: 전역 fetch와 Audio 성공 mock을 적용한 뒤 답변 다시 듣기를 클릭하자 실제 DOM에 `성경 친구가 말하고 있어요…`가 표시되었다. 같은 화면에 성공 음성 테스트 답변도 추가되었고, 이는 Home 상태 배지·오디오 시작 성공 계약의 브라우저 증거다.

실제 브라우저 timing 로그 최종 증거: `server-response`에서 `serverResponseAt=1786588852568`, `observedAt=1786589005654`, `observationLatencyMs=153086`, `synthesisLatencyMs=80`, `success=true`를 확인했다. 같은 재생에서 `first-playable`은 `startedAt=1786589005684`, `serverToFirstPlayableMs=153116`으로 기록되었으며, DOM 상태는 `성경 친구가 말하고 있어요…`, `speaking=true`였다. 해당 mock은 브라우저에서 성공 TTS·상태·구간 계측 계약을 함께 검증한다.

새 오류 재현: 미리보기에서 `하나님은 나를 사랑하시나요?`가 textarea index 6에 정상 입력되었고 질문 보내기 버튼은 index 7이다. 다음 단계에서 전송 후 로딩 상태, error1 텍스트, console/network 오류를 확인한다.

실제 error1 재현 결과: 질문·답변 텍스트는 정상 생성되었지만 Home 상태 배지에 `브라우저 음성 엔진이 재생을 시작하지 못했어요.`가 표시되었다. 즉, LLM 응답 자체가 멈춘 것이 아니라 음성 재생 단계에서 실패한 상태이며, 사용자 화면의 error1은 브라우저 음성 폴백 오류로 좁혀졌다.

수정 후 브라우저 재검증: 초기 답변 다시 듣기를 누르면 raw `error1` 대신 `이 기기에서 음성을 준비하지 못했어요. 잠시 후 다시 눌러 주세요.`가 화면에 표시된다. 이는 미리보기의 한국어 Web Speech 음성 목록 부재를 사용자에게 안전하게 안내하는 상태다.
