# 무료 GPU·감정형 TTS 운영 검토

조사 기준일: 2026-08-13 (사용자 시간대 기준)

## 핵심 판단
CosyVoice는 공식 저장소에서 한국어·감정/지시문·스트리밍을 지원하지만, 실제 서비스로 운영하려면 모델과 FastAPI/gRPC 추론 서버가 별도로 실행되어야 한다. WebDev Autoscale는 1 vCPU/512MB 수준이므로 CosyVoice 모델을 직접 상시 로드하는 방식에는 적합하지 않다.

## 무료 GPU 후보

| 후보 | 확인된 공식 조건 | 영구 TTS API 적합성 | 판단 |
|---|---|---:|---|
| Hugging Face ZeroGPU Spaces | 무료 개인 계정은 조건을 충족할 때 최대 2개 Space를 호스팅하며, 무료 계정 일일 GPU quota는 5분이고 대기 우선순위가 제한된다. 함수 기본 실행시간과 quota가 있어 상시 API 서버에 부적합하다. | 낮음 | 데모·짧은 테스트용 |
| Google Colab Free | 대화형 노트북 세션 방식이며 세션·유휴 종료가 있다. 외부에서 안정적으로 호출할 고정 API 주소와 상시 프로세스를 보장하지 않는다. | 낮음 | 개발·모델 실험용 |
| Kaggle Notebook | 무료 GPU 노트북은 세션형 실행으로, 고정 엔드포인트·상시 프로세스·콜드 스타트 없는 운영 API를 보장하지 않는다. | 낮음 | 배치 실험용 |
| 무료 GPU VM/크레딧 | 무료 크레딧은 계정·기간·지역별 조건이 달라 지속성을 보장하지 않으며, 카드 등록이나 자동 과금 위험을 확인해야 한다. | 중간 이하 | 개인 테스트 외 운영 비추천 |

## 권장 결론
1. **무료·안정적 운영 우선**: CosyVoice를 메인 실시간 TTS로 강제하지 말고, 현재 Web Speech API를 기본 음성으로 유지한다. 한국어 `ko-KR`, rate/pitch, 문장부호·감정 프롬프트 기반 문장 분리로 어린이 친화적인 표현을 조정한다.
2. **고품질 음성 실험**: Hugging Face ZeroGPU 또는 Colab에서 CosyVoice 데모를 만들어 테스트하되, 운영 사이트에서는 실험 서버가 살아 있을 때만 선택적으로 호출한다. 서버가 없으면 자동 폴백한다.
3. **실제 CosyVoice 운영**: 지속적인 외부 GPU 인스턴스 또는 사용량 기반 GPU API가 필요하다. 이는 무료 범위를 넘어갈 가능성이 높으므로 `COSYVOICE_API_URL`을 비밀 환경변수로 연결하는 구조만 유지하고, 운영 예산과 함께 결정한다.

## 출처
- Hugging Face ZeroGPU 공식 문서: https://huggingface.co/docs/hub/en/spaces-zerogpu
- CosyVoice 공식 저장소: https://github.com/QwenAudio/CosyVoice

## 추가 확인: Gemini TTS
Google AI 공식 TTS 문서에는 Single-speaker TTS, Multi-speaker TTS, 프롬프트를 통한 말투/스타일 제어 섹션이 별도로 제공된다. 브라우저 추출에서는 페이지가 동적으로 렌더링되어 본문 키워드 검색이 제한되었으므로, 실제 API 적용 전 모델명·무료 사용량·결제 조건은 [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)에서 계정 기준으로 확인해야 한다.

## 공식 문서 확인: GPU 없는 대안
Google AI 공식 TTS 문서는 Gemini API가 텍스트를 단일·다중 화자 오디오로 변환하고, 자연어 프롬프트로 스타일·억양·속도·톤을 제어한다고 설명한다. 문서 예시는 `gemini-3.1-flash-tts-preview`와 `response_format: audio`, 음성 `Kore`/`Puck`, Base64 오디오를 사용하며, 3.1 계열은 TTS 스트리밍을 지원한다고 안내한다. TTS 모델은 Preview이며, 사용 모델과 계정의 무료 한도는 가격 페이지에서 확인해야 한다.

Google Gemini API 가격 페이지는 무료 계층에서 일부 모델에 제한적 접근과 무료 입출력 토큰을 제공한다고 설명하지만, 모든 TTS 모델이 무료라고 보장하지는 않는다. 따라서 현재 저장된 `GEMINI_API_KEY`로 소량 테스트 후 실제 무료 한도를 확인하고, 생산 트래픽은 예산·레이트 리밋을 별도 확인해야 한다.

Piper 공식 저장소는 빠른 로컬 신경망 TTS 시스템이며 현재 개발이 `OHF-Voice/piper1-gpl`로 이동했다고 안내한다. CPU 기반·로컬 실행 대안으로는 적합하지만, 한국어 음성 모델과 감정 제어 품질은 사용하는 voice model별로 별도 검증해야 한다.

출처:
- Gemini TTS: https://ai.google.dev/gemini-api/docs/speech-generation
- Gemini API 가격: https://ai.google.dev/gemini-api/docs/pricing
- Piper: https://github.com/rhasspy/piper

Gemini TTS 공식 문서의 지원 언어 표에서 Korean(`ko`)이 명시되어 있다. 따라서 한국어 음성 생성 후보로는 기술적으로 적합하며, 실제 어린이 음성의 자연스러움과 감정 표현은 선택 voice와 프롬프트로 샘플 검증이 필요하다.
