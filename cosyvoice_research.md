# CosyVoice TTS 통합 및 아키텍처 분석 보고서

## 1. 개요
- **저장소**: [QwenAudio/CosyVoice](https://github.com/QwenAudio/CosyVoice) (알리바바 대형 다국어 음성 생성 모델)
- **주요 특징**: 한국어 등 9개 언어 지원, Instruct(감정·속도·톤 조절) 기능, 고품질 제로샷 음성 합성 및 FastAPI/gRPC 기반 서비스 배포 지원.

## 2. 영구 웹사이트 환경(Autoscale Serverless)과의 통합 제약
- **하드웨어 요구사항**: CosyVoice는 대규모 딥러닝 모델(0.5B / 300M)과 CUDA/GPU 연산이 필요하며, 표준 Serverless 컨테이너(1 vCPU, 512MB RAM, GPU 미지원)에서는 모델 로딩 및 실시간 추론이 불가능합니다.
- **아키텍처 전략**: 
  1. **클라이언트단 브라우저 Web Speech API (기본 폴백 및 즉시 응답)**: 서버리스 환경에서 지연 없이 즉각적인 한국어 TTS를 제공하기 위해 브라우저 내장 합성 엔진을 우선 사용합니다.
  2. **서버단 CosyVoice 통합 클라이언트 (`server/_core/cosyvoice.ts`)**: 사용자가 별도의 외부 CosyVoice 추론 서버(예: Docker GPU 인스턴스) 주소를 제공하거나 연동할 경우, 해당 엔드포인트(`http://<cosyvoice-server>:50000/tts`)로 텍스트와 감정 프롬프트를 전송해 오디오 스트림을 받아오는 프록시/클라이언트 구조를 구현합니다.

## 3. 구현 계획
- `server/_core/cosyvoice.ts`: 외부 CosyVoice FastAPI 서버와의 HTTP 통신 헬퍼 작성.
- `server/routers.ts`: tRPC 엔드포인트에 CosyVoice 음성 변환 프로시저 추가.
- `client/src/pages/Home.tsx`: 브라우저 TTS와 서버 CosyVoice 음성 출력을 유연하게 전환할 수 있는 오디오 플레이어 연동.
