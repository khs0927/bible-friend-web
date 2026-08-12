# 성경 친구 CosyVoice TTS 통합 TODO

- [x] CosyVoice 공식 저장소(QwenAudio/CosyVoice)의 아키텍처 및 API 요구사항 분석 (FastAPI 서버 및 HTTP/Streaming API 구조 확인)
- [x] 영구 호스팅 환경(Autoscale serverless)과 CosyVoice(GPU/대형 모델 파이프라인)의 제약 조건 검토
- [x] CosyVoice REST API 클라이언트 모듈 설계 및 프록시 설정 (`server/_core/cosyvoice.ts`)
- [x] tRPC 라우터에 TTS 변환 엔드포인트 추가 및 감정 표현 프롬프트 연결 (`server/routers.ts`)
- [x] 프론트엔드 채팅/스토리 오디오 재생에 CosyVoice 오디오 스트림/URL 연동 (`Home.tsx`)
- [x] CosyVoice 통합 테스트 추가 및 전체 Vitest 검증 (`server/cosyvoice.test.ts`)
- [x] 체크포인트 저장 및 사용자 최종 안내
- [x] QwenAudio/CosyVoice 공식 문서/예제를 열어 읽고 FastAPI 엔드포인트와 스트리밍 구조를 분석해 cosyvoice_research.md에 기록
- [x] 영구 웹사이트 환경(Autoscale serverless)과 CosyVoice(대형 모델/GPU/상시 실행)의 제약 조건을 검토하고 대체 아키텍처(클라이언트 Web Speech API + 서버 CosyVoice Fallback 또는 외부 API 프록시) 확정
- [x] mock 기반 CosyVoice 성공/실패 tRPC 라우터 테스트 추가 및 pnpm check && pnpm test 실행
- [x] 프론트엔드에서 CosyVoice TTS 오디오 재생 또는 브라우저 기본 TTS 폴백 연동 검증
- [x] mock axios 기반 CosyVoice 성공/실패 tRPC 라우터 테스트 추가
- [x] Home.tsx의 CosyVoice 호출을 tRPC mutation 훅(`mutateAsync`) 패턴으로 정밀하게 정돈하고 Vitest 통과 확인
- [x] axios 성공 목업을 포함한 CosyVoice tRPC 라우터 성공 테스트 추가
