# 다윗과 골리앗 스토리 통합 계획

## 목표

`스토리` 탭의 **다윗과 골리앗** 항목에 30장의 독립 생성 원본 페이지를 연결한다. 다른 UI 작업과 충돌하지 않도록 현재 PR은 asset/source staging으로 유지하고, 런타임 reader 연결은 별도 후속 PR에서 진행한다.

## 2026-08-22 현재 상태

- 작업 브랜치: `assets/david-goliath-story-pages`
- 기준 브랜치: `main`
- 로컬 GitHub 에셋 경로: `client/public/assets/story/david-goliath/`
- 30개 독립 생성 PNG 원본을 영구 자산 라이브러리에 보관 완료
- `source-assets.json`에 30개 원본의 durable URL, SHA-256, 원본 폭/높이를 기록 완료
- `manifest.json`을 30페이지 기준으로 확장 완료
- GitHub에는 기존 page-01 ~ page-10 원본이 materialized 되어 있음
- page-11 ~ page-30의 GitHub binary materialization은 Actions runner가 작업 step 시작 전에 실패하여 아직 완료되지 않음
- 실패한 임시/브랜치 sync workflow는 제거하여 main과 asset PR에 불필요한 CI 변경을 남기지 않음
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

리더는 단일 전역 aspect ratio를 강제하지 않고 `manifest.json`의 페이지별 `width` / `height`를 사용한다. 서로 다른 원본 비율을 맞추기 위해 crop/resize하지 않는다.

## 다음 과정 판단

### 1. 자산 전달 방식

30개 원본은 이미 durable asset URL로 안전하게 보관되어 있으므로 GitHub Actions materialization 실패 때문에 제품 개발을 멈추지 않는다. Reader PR에서는 `source-assets.json`의 durable URL을 우선 소스로 사용할 수 있게 하고, GitHub 로컬 PNG가 존재하는 경우 로컬 경로를 우선 사용할 수 있는 asset resolver를 둔다.

이렇게 하면:
- 현재 원본 화질을 그대로 유지한다.
- page-11 ~ page-30을 크롭/재생성하지 않아도 된다.
- GitHub Actions runner 상태와 무관하게 Story reader 개발/배포를 진행할 수 있다.
- 나중에 runner가 정상화되면 같은 SHA 원본을 로컬 public assets로 materialize할 수 있다.

### 2. 별도 David Story Reader PR

최신 `main`에서 새 reader 브랜치를 만들고 다음만 최소 변경한다.

1. 30페이지 manifest/source loader
2. Story 카탈로그의 기존 `id: "david"` 카드 연결
3. 전용 reader 화면
4. 좌/우 swipe + 이전/다음
5. 현재 페이지 `n / 30`
6. 뒤로가기/홈
7. 첫 장 우선 로딩, 앞뒤 1~2장 prefetch, 나머지 lazy loading
8. 이미지에 이미 포함된 제목/나레이션/성경친구는 HTML로 중복 표시하지 않음

### 3. 모바일 QA

- iPhone: 390×844
- Android: 360×800, 412×915
- page 10→11, 20→21처럼 원본 비율이 바뀌는 경계 전환을 별도 확인
- 이미지 잘림 없음
- swipe와 하단 navigation 충돌 없음
- 첫 진입에서 30장을 전부 다운로드하지 않음

### 4. 그 다음 선택 기능

Reader가 안정화된 뒤에만 TTS 자동 읽기, 이어보기, 즐겨찾기, 읽기 완료 기록을 추가한다.

## 병합 순서

### PR A — 현재 Asset/Source staging

- 기존 page-01 ~ page-10 원본
- 30개 durable source registry
- 30페이지 manifest + SHA/원본 크기
- 통합 계획
- 런타임 변경 없음

### PR B — David Story Reader

- 최신 main 기준
- Story 카드 `david` 연결
- 30페이지 reader
- local asset / durable source resolver
- swipe / navigation / progress / prefetch / lazy loading
- 모바일 QA

### PR C — 선택 기능

- TTS 자동 읽기
- 이어보기
- 즐겨찾기/완료 기록

## 완료 조건

- [x] 30개 독립 생성 PNG 원본 확보
- [x] 30개 원본을 영구 자산 라이브러리에 보관
- [x] 30페이지 durable source registry 및 SHA 기록
- [x] manifest를 30페이지/페이지별 크기로 갱신
- [x] 기존 page-01 ~ page-10 GitHub 원본 보존
- [ ] page-11 ~ page-30 GitHub binary materialization — runner 정상화 시 후속 처리
- [ ] 최신 main과 Story UI 충돌 여부 재확인
- [ ] David 전용 reader 연결
- [ ] iPhone/Android 모바일 QA 통과
- [ ] 선택적으로 TTS/이어보기 추가
