# Bible Friend Comic Adventure

성경 친구의 `게임` 영역을 퀴즈 카드 중심 UI에서 **이미지 중심의 성경 코믹 어드벤처**로 확장하기 위한 작업 문서입니다.

## 제품 원칙

- 플레이 화면의 주인공은 UI 카드가 아니라 **성경 장면 이미지**입니다.
- 권장 화면 비율은 `Artwork 65–75% / UI 25–35%`입니다.
- 성경의 핵심 사건과 결론은 분기시키지 않습니다. 선택지는 아이가 느끼는 **반응, 태도, 탐색 순서, 보조 장면**에 영향을 줍니다.
- 생성 이미지 안에는 한국어 문장, 말풍선, 로고를 넣지 않습니다. 텍스트는 React UI 레이어에서 렌더링합니다.
- 보상은 별, 말씀 보물, 인물 카드, 장소 카드, 배지처럼 수집형으로 구성하되 확률형/카지노형 연출은 사용하지 않습니다.
- 캐릭터 얼굴, 나이, 의상, 색 팔레트는 Character Bible을 기준으로 고정합니다.

## 플레이 루프

`Comic → Explore → Choice → Reaction → Mini Game → Reward → Next Scene`

첫 vertical slice는 **노아와 방주: 비가 오기 전의 마지막 준비**입니다.

1. 만화 장면으로 상황 이해
2. 그림 안에서 망치·밧줄·나무 등 단서 찾기
3. 믿음/지혜/격려 행동 선택
4. 선택에 맞는 짧은 반응 제공
5. 동물 짝맞추기 미니게임
6. `믿음의 망치` 보물 획득
7. 다음 장면 또는 에피소드 지도로 이동

## 코드 구조

```text
client/src/
├── game/
│   └── comicAdventure.ts       # Episode/Stage/Hotspot/Choice/Reward 데이터 모델
└── pages/
    ├── ComicAdventure.tsx      # 독립 플레이어 vertical slice
    └── comic-adventure.css     # 모바일 우선 게임 레이아웃
```

프로토타입은 `/comic-adventure` 경로에서 기존 Home/Game 상태와 분리해 검증합니다. 안정화 후 기존 `게임` 탭에서 이 경로 또는 공용 컴포넌트로 진입시킵니다.

## 아트 파이프라인

```text
ChatGPT-controlled generation
  → visual QA / character consistency
  → approved master image
  → resize & compression
  → optional Figma/Canva layout edit
  → repository-owned asset
  → React game scene
```

### 역할 분리

- **ChatGPT/이미지 생성**: 캐릭터 시트, 배경, 장면, 보물 아트의 원본 제작
- **Figma**: UI 프레임, 게임 HUD, 컴포넌트, 프로토타입 편집
- **Canva**: 필요할 때만 캠페인/소개 이미지나 간단한 편집
- **ComicEditorial MCP 후보**: 에피소드/챕터/패널 출판 구조 관리
- **Pictomancer MCP 후보**: 최종 이미지 resize/convert/compress 자동화
- **Playfrog/Cinevva 후보**: 독립 HTML5 게임 vertical slice의 외부 플레이 검증용

원본 이미지 생성 권한을 외부 디자인 툴에 위임하지 않고, 디자인 툴은 후처리와 레이아웃에 사용합니다.

## 자산 규칙

프로덕션 승인 이미지의 목표 경로:

```text
client/public/comic-assets/
└── noah-last-preparation/
    ├── characters/
    │   └── noah-reference.webp
    ├── scene-01-ark-building.webp
    ├── scene-02-find-supplies.webp
    ├── scene-03-choice.webp
    ├── scene-04-animals.webp
    └── rewards/
        └── faith-hammer.webp
```

파일명은 영문 kebab-case, UI 문구는 코드/콘텐츠 데이터에 둡니다. 생성 서비스의 임시 URL은 프로토타입에서만 허용합니다.

## 이미지 QA 체크

각 장면은 아래를 통과해야 합니다.

- 동일 인물의 얼굴/머리/수염/의상 일관성
- 시대에 맞지 않는 현대 물체 없음
- 손/팔/동물 중복 등 생성 오류 없음
- 중요한 터치 대상이 서로 겹치지 않음
- 모바일 390px 폭에서도 핵심 실루엣이 읽힘
- 하단 또는 상단 UI 오버레이용 여백 존재
- 이미지 자체에 글자/워터마크 없음
- 장면이 공포스럽거나 과도하게 자극적이지 않음

## 현재 vertical slice

`client/src/game/comicAdventure.ts`의 `NOAH_EPISODE`가 최초 구현입니다. 현재 첫 장면 이미지는 생성 서비스의 프로토타입 URL을 사용하며, 프로덕션 병합 전 저장소 자산으로 교체합니다.

## 다음 구현 순서

1. Noah Character Bible 생성 및 승인
2. 장면 01 master art 저장소 동기화
3. 장면 02–04 전용 이미지 생성
4. 보물 카드 아트 생성
5. `pnpm check` + `pnpm test` + 모바일 브라우저 검증
6. 기존 Home 게임 탭에 `코믹 어드벤처 시작` 진입점 추가
7. 진행도/보상 저장을 기존 tRPC/DB 게임 상태와 연결
8. 노아 에피소드 완성 후 다윗/다니엘/에스더 에피소드로 데이터만 확장
