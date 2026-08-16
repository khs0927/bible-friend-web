export type ComicStageKind = "comic" | "explore" | "choice" | "minigame" | "reward";

export type ComicHotspot = {
  id: string;
  label: string;
  hint: string;
  x: number;
  y: number;
};

export type ComicChoice = {
  id: string;
  label: string;
  description: string;
  response: string;
  tone: "faith" | "wisdom" | "kindness";
};

export type ComicReward = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  rarity: "story" | "character" | "verse";
  verse: string;
  content: string;
  points: number;
};

export type ComicStage = {
  id: string;
  kind: ComicStageKind;
  title: string;
  narration: string;
  objective?: string;
  imageUrl?: string;
  imageAlt?: string;
  hotspots?: ComicHotspot[];
  choices?: ComicChoice[];
  reward?: ComicReward;
};

export type ComicEpisode = {
  id: string;
  title: string;
  subtitle: string;
  bibleReference: string;
  theme: string;
  coverImage: string;
  stages: ComicStage[];
};

export const NOAH_SCENE_01_ART = "/api/comic-assets/scene1";
export const NOAH_SCENE_02_ART = "/api/comic-assets/scene2";

export const NOAH_EPISODE: ComicEpisode = {
  id: "noah-last-preparation",
  title: "노아와 방주",
  subtitle: "비가 오기 전의 마지막 준비",
  bibleReference: "창세기 6–9장",
  theme: "믿음으로 순종하기",
  coverImage: NOAH_SCENE_01_ART,
  stages: [
    {
      id: "scene-arrival",
      kind: "comic",
      title: "마지막 준비의 날",
      narration: "하나님이 말씀하신 대로 노아는 오랫동안 방주를 만들었어요. 이제 하늘의 빛이 조금씩 달라지고, 멀리서 동물들이 두 마리씩 다가오기 시작했어요.",
      objective: "그림을 살펴보고 방주 주변에서 무슨 일이 일어나고 있는지 찾아보세요.",
      imageUrl: NOAH_SCENE_01_ART,
      imageAlt: "노아와 가족이 큰 나무 방주를 완성하고 동물들이 다가오는 장면",
    },
    {
      id: "scene-find-supplies",
      kind: "explore",
      title: "준비물 세 가지를 찾아요",
      narration: "방주에 들어가기 전에 꼭 필요한 준비물을 찾아 노아를 도와주세요.",
      objective: "그림 속에서 망치, 밧줄, 나무를 모두 찾아 터치하세요.",
      imageUrl: NOAH_SCENE_02_ART,
      imageAlt: "노아가 방주 앞에서 망치와 밧줄과 나무를 준비하는 탐색 게임 장면",
      hotspots: [
        { id: "hammer", label: "망치", hint: "노아가 높이 들고 있는 도구를 살펴봐요.", x: 68, y: 17 },
        { id: "rope", label: "밧줄", hint: "왼쪽 아래 가족이 두 손으로 들고 있어요.", x: 22, y: 72 },
        { id: "timber", label: "나무", hint: "화면 가운데보다 조금 아래, 오른쪽에 긴 나무가 보여요.", x: 65, y: 61 },
      ],
    },
    {
      id: "scene-choice",
      kind: "choice",
      title: "사람들이 비웃어도 계속할까요?",
      narration: "오랫동안 비가 오지 않았기 때문에 어떤 사람들은 노아를 이해하지 못했어요. 하지만 노아는 하나님의 말씀을 기억했어요.",
      objective: "노아가 다음에 할 행동을 선택해 보세요.",
      imageUrl: NOAH_SCENE_01_ART,
      imageAlt: "방주 앞에 서 있는 노아가 믿음의 선택을 하는 장면",
      choices: [
        { id: "keep-obeying", label: "하나님의 말씀대로 계속 준비해요", description: "눈앞의 상황보다 하나님의 말씀을 믿어요.", response: "좋은 선택이에요. 노아는 보이지 않는 상황 속에서도 하나님을 믿고 끝까지 순종했어요.", tone: "faith" },
        { id: "listen-people", label: "사람들이 웃으니 잠깐 멈춰요", description: "주변 사람들의 반응을 먼저 살펴봐요.", response: "사람들의 말이 마음을 흔들 수 있어요. 노아의 이야기는 하나님의 말씀을 신뢰하는 믿음을 다시 생각하게 해줘요.", tone: "wisdom" },
        { id: "encourage-family", label: "가족을 격려하며 함께 준비해요", description: "혼자 하지 않고 서로 힘을 줘요.", response: "따뜻한 선택이에요. 믿음의 길에서 서로 격려하는 것도 아주 소중해요.", tone: "kindness" },
      ],
    },
    {
      id: "scene-animal-pairs",
      kind: "minigame",
      title: "동물 친구들을 짝지어요",
      narration: "동물들이 방주를 향해 오고 있어요. 같은 동물끼리 한 쌍을 만들어 주세요.",
      objective: "기린, 양, 사자를 각각 같은 짝과 연결하세요.",
    },
    {
      id: "scene-reward",
      kind: "reward",
      title: "믿음의 망치 카드 획득!",
      narration: "오늘의 모험에서 노아처럼 끝까지 믿고 준비하는 마음을 배웠어요.",
      objective: "보물을 받고 다음 장면을 열어 보세요.",
      reward: {
        id: "faith-hammer",
        title: "믿음의 망치",
        subtitle: "보이지 않아도 말씀을 믿고 한 걸음씩",
        icon: "🔨",
        rarity: "story",
        verse: "창세기 6:22",
        content: "노아가 하나님이 명하신 대로 행한 것처럼, 믿음은 말씀을 듣고 한 걸음씩 순종하는 마음이에요.",
        points: 20,
      },
    },
  ],
};
