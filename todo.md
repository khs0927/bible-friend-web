# TTS 및 반응형 대화창 개선 TODO

- [x] CosyVoice 음성이 재생되지 않고 브라우저 TTS로 조용히 폴백되던 원인 진단 (`COSYVOICE_API_URL` 미설정 및 서버 응답 에러 핸들링 수정)
- [x] 서버리스 환경에서도 기본적으로 풍부한 감정 표현 오디오(또는 Web Audio API 기반 오디오 효과 및 Web Speech 향상 설정)가 확실히 작동하도록 헬퍼 개선 (`server/_core/cosyvoice.ts`)
- [x] 대화 시 답변 텍스트를 화면에 보여주면서 음성도 동시에 재생되도록 `askMutation` 및 스토리 듣기 흐름 정비 (`Home.tsx`)
- [x] 아동 친화적 글씨체(Google Fonts 'Gowun Dodum' / 'Jua') 적용 및 타이핑/축소 애니메이션 효과 추가 (`client/index.html`, `client/src/index.css`)
- [x] 반응형 대화창 애니메이션 및 미세 인터랙션 강화 (`Home.tsx`, `App.css`)
- [x] Vitest 단위 테스트 및 TypeScript 검증 실행 후 체크포인트 저장
- [x] CosyVoice 실패 시 응답 핸들링 테스트 추가 및 pnpm check && pnpm test 실행
- [x] TTS 수정 및 감정 음성/글씨체 개선 후 webdev_save_checkpoint 실행
