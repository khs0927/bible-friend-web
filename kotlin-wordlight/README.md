# WordLight · Kotlin Full-Stack Bible Web

성경 말씀을 읽고 검색하고 저장하며 묵상 노트를 남길 수 있는 Kotlin 풀스택 웹앱입니다.

## 기술 구성

- Frontend: Kotlin 2.4.10 + Kotlin/JS (IR, browser)
- Backend: Kotlin/JVM 2.4.10 + Ktor 3.5.2 + Netty
- Shared models: Kotlin Multiplatform + kotlinx.serialization
- Runtime: JDK 21
- Build: Gradle 9.5.1 권장

## 주요 기능

- 오늘의 말씀과 짧은 묵상/기도문
- 주제별 말씀 탐색
- 키워드/성경책 검색
- 브라우저 localStorage 기반 즐겨찾기
- 브라우저 localStorage 기반 묵상 노트
- 모바일/태블릿/데스크톱 반응형 UI
- Ktor REST API (`/api/health`, `/api/bootstrap`, `/api/today`, `/api/topics`, `/api/verses`)

> 현재 말씀 본문은 UI/기능 검증용 요약형 데모 데이터입니다. 실제 공개 서비스에서는 사용권을 확보한 정식 성경 번역 데이터/API를 연결하세요.

## 로컬 실행

```bash
gradle :server:run
```

브라우저: `http://localhost:8080`

## 배포용 빌드

```bash
gradle clean :server:installDist
PORT=8080 ./server/build/install/server/bin/server
```

`server:processResources`가 `web:jsBrowserDistribution`을 먼저 실행해 Kotlin/JS 산출물을 Ktor 정적 리소스에 포함합니다.

## Docker

```bash
docker build -t wordlight .
docker run --rm -p 8080:8080 wordlight
```

## GitHub 관리형 미리보기

저장소 루트의 `.github/workflows/kotlin-wordlight-preview.yml`은 이 프로젝트를 GitHub Actions에서 실제 빌드/실행하고 Cloudflare Quick Tunnel을 통해 임시 외부 미리보기 URL을 발급합니다. 같은 워크플로에서 API 헬스체크와 데스크톱/모바일 헤드리스 Chrome 스크린샷도 생성합니다.
