# 다윗과 골리앗 스토리 통합 계획

## 목표

`스토리` 탭의 **다윗과 골리앗** 항목에 30장의 독립 생성 원본 페이지를 연결한다. 다른 UI 작업과 충돌하지 않도록 현재 PR은 asset-only staging으로 유지하고, 런타임 리더 연결은 별도 후속 PR에서 진행한다.

## 2026-08-22 현재 상태

- 작업 브랜치: `assets/david-goliath-story-pages`
- 기준 브랜치: `main`
- GitHub 에셋 위치: `client/public/assets/story/david-goliath/`
- 페이지 규칙: `page-01.png` ~ `page-30.png`
- 30개 독립 PNG 원본을 영구 자산 라이브러리에 보관 완료
- `source-assets.json`에 30개 원본의 durable URL, SHA-256, 원본 폭/높이를 기록
- `manifest.json`을 30페이지 기준으로 확장
- 원본을 GitHub 경로로 byte-for-byte 동기화하고 SHA/PNG 크기를 검증하는 Actions workflow를 추가
- 런타임 `client/src`, Story UI, 라우터, CSS는 아직 수정하지 않음

## 원본 품질 원칙

1. 스프라이트/목업을 크롭해서 페이지를 만들지 않는다.
2. 생성된 각 페이지 독립 PNG 원본만 사용한다.
3. 업로드 과정에서 resize, JPEG 변환, 재압축을 하지 않는다.
4. SHA-256을 기준으로 자산 바이트 일치 여부를 검증한다.
5. 앱 렌더링은 `object-fit: contain`을 사용하며 화면을 채우기 위해 이미지를 자르지 않는다.

## 페이지 크기

- page-01 ~ page-10: 1086 × 1448, authored 3:4
- page-11 ~ page-30: 941 × 1672, authored portrait

따라서 리더는 단일 전역 aspect ratio를 강제하지 않고 `manifest.json`의 페이지별 `width` / `height`를 사용해야 한다. 서로 다른 원본 비율을 맞추기 위해 crop/resize하지 않는다.

## 현재 Story 구조와 연결 지점

현재 Story 카탈로그에는 `id: "david"`, 제목 `다윗과 골리앗` 항목이 이미 존재한다. 30개 에셋 검증 후 다음 순서로 연결한다.

1. asset PR을 최신 `main` 기준으로 재검증한다.
2. 별도 reader 브랜치/PR을 만든다.
3. `manifest.json`을 읽는 David 전용 reader를 구현한다.
4. Story UI의 `david` 카드가 전용 reader로 이동하도록 연결한다.
5. 현재 main의 Story 라우팅 패턴을 확인해 `/story/david` 또는 기존 상세 라우팅 체계를 사용한다.

## 모바일 reader 요구사항

- 휴대폰 세로 화면을 최우선으로 한다.
- 페이지 원본 전체가 항상 보이도록 `object-fit: contain`.
- 좌/우 swipe + 이전/다음 버튼.
- 현재 페이지 `n / 30` 표시.
- 뒤로가기 및 홈 이동.
- 첫 페이지 우선 로딩, 앞뒤 1~2장만 prefetch, 나머지 lazy loading.
- 이미지에 이미 들어 있는 제목/나레이션/성경친구를 HTML로 중복 표시하지 않는다.
- 접근성 `alt`는 manifest의 장면 제목을 사용한다.

## 성능/QA

- 첫 진입 시 30장을 한꺼번에 다운로드하지 않는다.
- 원본 파일은 유지하고 필요할 경우 별도의 캐시/전송 최적화만 적용한다.
- iPhone Safari와 Android Chrome에서 이미지 잘림과 스와이프 충돌을 검사한다.
- 최소 확인 뷰포트: 390×844, 360×800, 412×915.
- page-01, page-10, page-11, page-20, page-21, page-30 경계 전환을 별도로 확인한다.

## 병합 순서

### PR A — Asset staging (현재)

- 30개 원본 source registry
- manifest
- 동기화/무결성 검증 workflow
- 통합 계획
- 런타임 변경 없음

### PR B — David Story Reader

- 최신 main에서 시작
- Story 카드 `david` 연결
- 30페이지 reader
- swipe / navigation / progress / prefetch / lazy loading
- 모바일 QA

### PR C — 선택 기능

- 페이지별 TTS 자동 읽기
- 재생/읽기 상태
- 이어보기
- 즐겨찾기/완료 기록

## 완료 조건

- [x] 30개 독립 생성 PNG 원본 확보
- [x] 30개 원본을 영구 자산 라이브러리에 보관
- [x] 30페이지 source registry 및 SHA 기록
- [x] manifest를 30페이지/페이지별 크기로 갱신
- [x] GitHub 원본 동기화 workflow 추가
- [ ] `page-01.png` ~ `page-30.png` GitHub materialization 및 SHA 최종 확인
- [ ] 최신 main과 충돌 여부 재확인
- [ ] David 전용 reader 연결
- [ ] iPhone/Android 모바일 QA 통과
- [ ] 선택적으로 TTS/이어보기 추가
