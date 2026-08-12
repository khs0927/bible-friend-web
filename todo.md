# 성경 친구 (Bible Friend) 프로젝트 TODO

- [x] 영구 프로젝트 요구사항과 기존 scaffold 점검
- [x] 데이터 모델·Gemini·음성·스토리지 통합 설계 (Drizzle 스키마 및 DB 헬퍼)
- [x] 모바일 퍼스트 성경 친구 UI와 상호작용 구현 (Home.tsx, 스토리 모달, 퀴즈, 음성 STT/TTS)
- [x] 서버 기능·Gemini 에이전트·오케스트레이터·대화 저장 구현 (tRPC 라우터)
- [x] 이미지 자산 업로드·통합 테스트·빌드 검증
- [x] 체크포인트 저장 및 영구 사이트 이용 안내
- [x] 성경 친구 UI에 스토리·점수·퀴즈 loading/error/empty 상태와 퀴즈 초기 로딩 흐름 추가
- [x] bible-friend-web에서 pnpm build 및 브라우저 상호작용(스토리 모달, 음성 STT/TTS, 퀴즈 정답 피드백) 검증 및 결과 기록
- [x] Streamdown 의존성으로 인한 프로덕션 빌드 메모리 문제를 경량 채팅 UI로 해결하고 재빌드
- [x] bible-friend-web에서 업로드된 스토리 이미지가 카드와 상세 모달에 실제 렌더링되는지 브라우저로 검증하고 결과 기록
- [x] scoreQuery에 loading/error/empty 상태 UI를 추가하고 비로그인·로딩·오류 동작을 검증
- [x] 브라우저에서 실제 Web Speech STT 시작·중지와 답변 TTS 재생을 검증하고 결과 기록
- [x] 말씀 보물찾기에서 문제 표시·정답 선택·정답/오답 피드백 화면까지 실제 브라우저 검증하고 기록
- [x] scoreQuery의 로딩·오류·빈 상태를 재현 또는 목업 방식으로 검증하고 각 상태 UI 동작을 기록
- [ ] webdev_save_checkpoint를 실제 실행하고 영구 사이트 URL·이용 안내를 사용자에게 전달한 뒤 기록
- [ ] 브라우저에서 Web Speech API의 STT 시작·듣기 상태·중지/전사와 TTS 재생 버튼을 검증 가능한 환경에서 확인하고 기록
- [ ] scoreQuery 로딩·오류·null 상태를 테스트용 제어 분기로 재현해 각 UI 문구가 실제 표시되는지 확인하고 기록
