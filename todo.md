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
- [x] 음성 미재생 버그 재현 및 서버 오디오·브라우저 Audio·Web Speech 폴백 원인 진단
- [x] 사용자 제스처·재생 Promise·오디오 오류 처리와 Web Speech 폴백 수정
- [x] 음성 미재생 회귀 테스트와 브라우저 검증 완료
- [x] Web Speech synthesis-failed/onerror 시 사용자에게 상태를 표시하고 재시도 또는 명시적 무음 오류 처리 추가
- [x] AudioPlaybackQueue의 서버 오디오 실패→Web Speech 폴백과 Web Speech 오류 경로 테스트 추가
- [x] Home.tsx 상호작용 기준 음성 시작·오류 콜백을 UI에 연결하고 무음 원인 표시 검증
- [x] Home.tsx 실제 상호작용에서 voiceStatus가 speaking 또는 error로 바뀌는 브라우저 검증 근거와 무음 원인 문구 표시 확인
- [x] Home/Chat 레벨 테스트에서 AudioPlaybackQueue 콜백에 따른 상태 배지 텍스트 변경 검증
- [x] 실제 Home 상호작용에서 서버 음성 성공 시 상태 배지가 `성경 친구가 말하고 있어요…`로 바뀌는 브라우저 검증 근거 남기기
- [x] Home 또는 ChatPanel 렌더 테스트에서 음성 시작·오류 콜백에 따른 상태 배지 텍스트 변경 검증
- [x] Home 또는 ChatPanel 렌더 테스트를 추가해 AudioPlaybackQueue의 onPlaybackStarted/onPlaybackError 콜백에 따른 상태 배지 변경을 통합 검증

- [x] Gemini TTS 호출·서버 생성·첫 재생 구간별 지연 측정값 수집
- [x] 공식 문서와 연결 가능한 커넥터를 바탕으로 저지연 TTS 대안 비교
- [x] 사용자 체감 지연을 줄이는 즉시 브라우저 음성·문장 분할·캐시 전략 적용
- [x] 저지연 전략의 Vitest·TypeScript·브라우저 회귀 검증 및 운영 선택지 문서화
- [x] 실제 브라우저에서 저지연 경로를 재현해 질문 후 1.2초 내 브라우저 음성이 먼저 시작되는지 확인하고 first-playable 시점 기록
- [x] 서버 생성 완료 시점과 브라우저 첫 재생 시점을 함께 로깅하거나 노출해 구간별 실측값 남기기
- [x] fast fallback 적용 후 Home UI에서 상태 배지·오디오 시작 흐름을 브라우저 회귀 검증으로 남기기
- [x] 서버 TTS 응답 완료 시각(`serverResponseAt`)과 브라우저 첫 재생 시각을 함께 기록/노출해 구간별 실측값을 남기기
- [x] fast fallback 성공 경로에서 Home UI 상태 배지(`성경 친구가 말하고 있어요…`)가 실제 브라우저에서 표시되는지 재현·기록하기
- [x] 브라우저 회귀 검증에 성공·오류 두 경로의 상태 배지 변화와 오디오 시작 흐름 근거를 남기기
- [x] 실제 브라우저 또는 테스트에서 `serverResponseAt`와 `onPlaybackStarted` 시각이 함께 기록된 로그/증거를 남기고 구간별(ms) 값을 QA 메모에 고정
- [x] AudioPlaybackQueue 또는 Home 레벨 테스트에 `serverResponseAt` 전달 및 `serverToFirstPlayableMs` 계산 검증 추가

- [x] error1 실제 코드·서버 TTS 응답·브라우저 음성 엔진 상태 재현 및 원인 확정
- [x] TTS 로딩 중 음성 시작과 error1 사용자 표시를 안정적으로 수정
- [x] error1·지연·성공 재생 회귀 테스트와 실제 브라우저 재검증
- [x] Gemini rate-limit 재시도 폭주를 막는 서버 회로 차단과 짧은 요청 종료시간 추가
- [x] 브라우저 음성 엔진 실패 시 늦은 서버 WAV를 무기한 기다리지 않고 제한시간 내 복구
- [x] 내부 브라우저 오류 코드를 어린이에게 보이는 단순 안내 문구로 매핑하고 error1 노출 제거
- [x] Android Chrome 및 iOS Safari 등 실제 모바일 기기에서의 한국어 Web Speech 음성 엔진 지원 및 사용자 제스처 재생 가이드라인 마련
- [x] 오디오 큐 단위 테스트와 mock 브라우저 환경을 통한 음성 성공·실패 end-to-end 흐름 검증 완료
- [x] fast fallback 및 늦은 서버 WAV 복구 로직에 대한 오디오 큐 큐잉·타임아웃 단위 검증 완료
- [x] error1 수정 후 상태 배지 및 아동 친화적 오류 메시지 매핑 검증 완료
- [x] Gemini rate-limit 회로 차단과 별도로 TTS 요청을 더 빨리 종료하는 짧은 timeout/abort 정책을 코드에 추가하고 테스트로 검증
- [x] rate-limit 상태에서 첫 실패 이후 후속 요청이 짧은 종료시간으로 즉시 안전 응답되는지 회귀 테스트 추가

- [x] iPhone 화면의 Gemini TTS 사용량 제한·rate-limit·서버 오디오 응답 상태를 재현해 무음 원인 확정
- [x] Gemini TTS 제한 시에도 모바일에서 재생 가능한 서버 오디오 또는 명확한 대체 경로 구현
- [x] iPhone Safari 오디오 재생·상태 문구·rate-limit fallback 회귀 테스트 및 검증
- [x] 사용자 iPhone에서 답변 우측 스피커 버튼을 눌러 실제 한국어 음성이 들리는지 확인하고 결과 기록 (서버·390×844 모바일 브라우저 검증 완료; 실제 iPhone 청취는 사용자 기기에서 최종 확인)
- [x] iPhone Safari 또는 실제 모바일 브라우저에서 Gemini 제한 상태의 질문 응답·다시 듣기 각각의 실제 음성 재생 성공 여부를 QA 근거로 남기기 (390×844 모바일 브라우저에서 자동 응답·다시 듣기 rate-limit 및 Web Speech 0회 검증; 실제 Safari는 사용자 기기 확인)
- [x] Gemini 제한 시 자동 응답 재생과 다시 듣기 경로의 fallback provider를 브라우저 로그와 함께 검증하기
- [x] 서버 오디오 fallback 또는 브라우저 대체 경로가 모바일 실환경에서 실패할 때 최종 안내·재시도 UX를 보강하고 검증하기

- [x] Gemini TTS 성공/실패·기계음 fallback 선택 경로를 실제 로그로 재현해 현재 재생 provider 확정
- [x] Gemini 성공 응답이 있을 때 Web Speech를 절대 먼저 재생하지 않고 서버 Gemini WAV만 재생하도록 정책 수정
- [x] Gemini TTS 모델·API 응답 오디오·WAV 재생·모바일 사용자 제스처 회귀 테스트 추가
- [x] 실제 미리보기에서 Gemini provider와 서버 WAV 재생을 확인하고 체크포인트 저장

- [x] 어린이 대화 메시지 글씨·줄간격·입력 글씨를 모바일에서 더 크게 조정
- [x] 답변 등장·말하는 상태·음성 버튼에 어린이 친화 애니메이션과 prefers-reduced-motion 대응 추가
- [x] 무료 음성 호출 지연 원인과 즉시 호출 가능한 사용자 제스처·Web Speech·Gemini WAV 조합을 조사
- [x] 음성 호출 UX를 무료 범위에서 빠르게 시작하도록 개선하고 Gemini 고품질 음성 우선 정책 유지
- [x] 새 UI·음성 호출 변경에 대한 Vitest·TypeScript·빌드·모바일 미리보기 검증 및 체크포인트 저장

- [x] 모바일 홈 첫 화면을 대화방 중심으로 채우고 스토리·퀴즈·생성 콘텐츠를 홈 본문에서 탭 화면으로 이동
- [x] 하단 네비게이션의 스토리 탭에서 스토리방을 열고 홈에는 대화·음성 입력 중심 UX만 노출
- [x] 친구 아이콘을 대화방 배경 장식으로 이동하고 대화방에 은은한 애니메이션 배경 효과 추가
- [x] 우측 상단 카피를 `궁금한 마음 그대로 하나님께 물어봐요`로 이동하고 `Mus. Relax` 표기 삭제
- [x] 음성 토글을 켜짐/꺼짐 의미가 직관적으로 보이도록 아이콘·aria-label·문구 수정
- [x] 제한 상태 문구와 가독성 전반을 점검하고 음성 제한 원인 및 무료 사용 범위 안내 반영
- [x] 새 홈·네비게이션·음성 변경에 대한 Vitest·TypeScript·빌드·모바일 검증 및 체크포인트 저장

- [x] 음성 버튼을 다시 누르지 않아도 새 답변 도착 시 자동으로 Gemini 음성 재생
- [x] 자동 음성 재생의 사용자 제스처·iPhone autoplay 제한·음성 끄기 설정을 안전하게 처리
- [x] 대화방을 모바일 홈의 가시 영역에 꽉 차게 확장하고 불필요한 상단 여백·요소 축소
- [x] 상단 문구를 `궁금한 건 뭐든 성경친구에게 물어봐요` 하나로 최소화하고 우측 상단 불필요한 글 제거
- [x] 주황·보라색 친구 아이콘/일러스트를 대화방 배경으로 배치하고 아이콘 효과 추가
- [x] 기록을 하단 네비게이션 탭으로 이동하고 탭 화면에서 기록 저장·새 대화 기능 제공
- [x] 답변 등장·글자 출력·입력·아이콘 상호작용 애니메이션을 깔끔하고 직관적으로 업그레이드
- [x] 새 자동 음성·전체화면 홈·기록 탭·디자인 변경 테스트·빌드·모바일 검증 및 체크포인트 저장

- [x] Gemini 연결상태 표시와 `성경 친구와 이야기해요` 문구 제거
- [x] 우측 상단 `궁금한 건 뭐든 성경친구에게 물어봐요`를 더 크고 둥근 글씨체로 조정
- [x] 성경친구 브랜드·대화 말풍선 글씨체와 크기·줄간격 개선
- [x] 전체 흰색 대화방 면적을 최소화하고 말풍선·입력창만 은은한 그림자로 분리
- [x] 하단 네비게이션 아이콘을 예쁜 색상·배경·활성 상태·애니메이션으로 업그레이드
- [x] 새 디자인의 Vitest·TypeScript·빌드·모바일 미리보기 검증 및 체크포인트 저장
