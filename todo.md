# TTS 및 반응형 대화창 개선 TODO

- [x] CosyVoice 음성이 재생되지 않고 브라우저 TTS로 조용히 폴백되던 원인 진단 (`COSYVOICE_API_URL` 미설정 및 서버 응답 에러 핸들링 수정)
- [x] 서버리스 환경에서도 기본적으로 풍부한 감정 표현 오디오(또는 Web Audio API 기반 오디오 효과 및 Web Speech 향상 설정)가 확실히 작동하도록 헬퍼 개선 (`server/_core/cosyvoice.ts`)
- [x] 대화 시 답변 텍스트를 화면에 보여주면서 음성도 동시에 재생되도록 `askMutation` 및 스토리 듣기 흐름 정비 (`Home.tsx`)
- [x] 아동 친화적 글씨체(Google Fonts 'Gowun Dodum' / 'Jua') 적용 및 타이핑/축소 애니메이션 효과 추가 (`client/index.html`, `client/src/index.css`)
- [x] 반응형 대화창 애니메이션 및 미세 인터랙션 강화 (`Home.tsx`, `App.css`)
- [x] Vitest 단위 테스트 및 TypeScript 검증 실행 후 체크포인트 저장
- [x] CosyVoice 실패 시 응답 핸들링 테스트 추가 및 pnpm check && pnpm test 실행
- [x] TTS 수정 및 감정 음성/글씨체 개선 후 webdev_save_checkpoint 실행

- [x] Gemini TTS 최신 API를 서버 전용 클라이언트로 연결하고 환경변수·모델·타임아웃을 중앙화
- [x] TTS Provider 공통 인터페이스와 BibleVoiceDirector(화자·감정·스타일·속도 프로필) 구현
- [x] Gemini → CosyVoice → Browser Web Speech 3단계 폴백과 오류/쿼터 분류 구현
- [x] TTS 요청 중복 제거 및 서버 메모리 기반 오디오 캐시·일일 호출/문자 제한 구현
- [x] 프론트엔드 AudioPlaybackQueue와 문장 경계 단위 순차 재생 구현
- [x] 한국어·화자별 Gemini TTS 샘플 생성 경로와 latency/fallback/cache Vitest 테스트 추가
- [x] README에 Gemini TTS 설정·운영 제한·폴백 구조 문서화
- [x] 동일 입력에 대한 in-flight TTS 요청 deduplication(Map of pending promises) 추가 및 동시 요청 테스트 작성
- [x] Gemini-first 라우터 계약에 맞게 기존 CosyVoice router tests를 갱신하고 전체 pnpm test 통과 증거 확보
- [x] latencyMs/first-audio 관련 측정값을 명시적으로 검증하는 Vitest 추가
- [x] AudioPlaybackQueue 또는 재생 시작 시점을 포함한 first-playable-audio 측정·검증 테스트를 추가하고 서버 synthesis latency와 구분
