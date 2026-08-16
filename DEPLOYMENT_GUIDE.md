# 성경 친구 (Bible Friend) 외부 플랫폼 배포 가이드

본 프로젝트는 React 19, Express, tRPC, Drizzle ORM(MySQL/TiDB), 그리고 Gemini LLM/TTS 연동이 포함된 풀스택 웹 애플리케이션입니다. GitHub(`khs0927/bible-friend-web`)에 성공적으로 푸시되어 있으며, Vercel 또는 Netlify와 같은 외부 플랫폼에 연동하여 실시간 배포 환경을 구축할 수 있습니다.

---

## 1. 플랫폼별 배포 권장 사항

### ① Vercel (권장)
- **특징:** 프론트엔드와 서버리스 API(Serverless Functions)를 동시에 지원하는 풀스택 배포에 가장 적합합니다.
- **빌드 설정:**
  - Build Command: `pnpm build` (또는 `npm run build`)
  - Output Directory: `dist/public` (또는 Vite 기본 출력 경로)
  - Install Command: `pnpm install`

### ② Netlify
- **특징:** 정적 자산 및 리다이렉트 설정이 간편합니다. 단, Express 백엔드 라우터(tRPC)를 운용하려면 Netlify Functions 또는 서버리스 어댑터 설정이 필요합니다.
- **빌드 설정:**
  - Build Command: `pnpm build`
  - Publish Directory: `dist/public`

---

## 2. 필수 환경 변수 (Environment Variables)

배포 플랫폼의 프로젝트 설정(Settings > Environment Variables)에 다음 환경 변수를 반드시 등록해야 합니다.

| 변수명 | 설명 | 필수 여부 |
|---|---|---|
| `DATABASE_URL` | MySQL / TiDB 데이터베이스 접속 문자열 | 필수 (서버 기능 연동 시) |
| `GEMINI_API_KEY` | Gemini LLM 및 TTS API 키 | 필수 (음성 대화 및 AI 추천 시) |
| `JWT_SECRET` | 세션 및 인증 쿠키 서명 비밀키 | 필수 |
| `VITE_APP_ID` | Manus OAuth 앱 ID | 선택 (OAuth 연동 시) |

---

## 3. GitHub 연동 및 실시간 배포 순서

1. **Vercel 또는 Netlify 대시보드 접속** (기존 GitHub 계정으로 로그인)
2. **New Project** 생성 및 GitHub 저장소 `khs0927/bible-friend-web` 선택
3. 위 **2번 항목**의 환경 변수 입력
4. **Deploy** 버튼 클릭하여 자동 빌드 및 실시간 배포 완료
