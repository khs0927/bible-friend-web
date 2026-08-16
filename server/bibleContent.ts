export type BibleStory = {
  id: string;
  title: "노아의 방주" | "다윗과 골리앗" | "예수님의 사랑" | "천지창조" | "꿈꾸는 요셉";
  subtitle: string;
  body: string;
  lesson: string;
  verse: string;
  accent: "coral" | "mint" | "blue" | "violet" | "gold";
  imageUrl: string;
  illustrationPrompt: string;
};

export type BibleQuiz = {
  id: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};

export const BIBLE_STORIES: BibleStory[] = [
  {
    id: "noah",
    title: "노아의 방주",
    subtitle: "약속을 지키시는 하나님",
    body: "하나님은 노아에게 큰 배를 만들라고 말씀하셨어요. 노아는 믿음으로 순종했고, 동물 친구들과 가족을 방주에 태웠어요. 비가 그친 뒤 하나님은 다시는 물로 세상을 심판하지 않겠다는 약속의 무지개를 보여 주셨어요.",
    lesson: "하나님은 우리를 돌보시고, 약속을 소중히 지키세요.",
    verse: "창세기 9:13",
    accent: "coral",
    imageUrl: "/manus-storage/story_noah_a1e0e2bf.png",
    illustrationPrompt: "A joyful, child-friendly 3D animated illustration of Noah's ark on calm turquoise water, Noah smiling kindly on the deck, pairs of adorable animals peeking from the windows, a soft rainbow and warm golden clouds, biblical setting, colorful storybook composition, no text, gentle emotional expression.",
  },
  {
    id: "david",
    title: "다윗과 골리앗",
    subtitle: "작은 용기가 만드는 큰 변화",
    body: "다윗은 아주 큰 골리앗을 보았지만, 무서움보다 하나님을 믿는 마음을 선택했어요. 다윗은 작은 물매돌 하나로 골리앗에게 맞섰고, 하나님이 주신 용기로 이겨 냈답니다.",
    lesson: "내가 작아 보여도 하나님을 믿고 용기를 낼 수 있어요.",
    verse: "사무엘상 17:47",
    accent: "mint",
    imageUrl: "/manus-storage/story_david_0b7c9097.png",
    illustrationPrompt: "A brave child-friendly 3D animated illustration of young David holding a sling on a sunny ancient valley, a towering but non-scary Goliath in the far background, David's expression hopeful and courageous, soft green hills, warm colors, inspirational biblical storybook art, no text.",
  },
  {
    id: "jesus",
    title: "예수님의 사랑",
    subtitle: "있는 그대로 안아 주시는 사랑",
    body: "예수님은 어린이들이 가까이 오는 것을 기뻐하셨어요. 예수님은 사람들의 이야기를 귀 기울여 듣고, 아픈 마음을 위로하셨어요. 예수님의 사랑은 누구에게나 열려 있고, 우리도 서로 따뜻하게 대할 수 있게 해 줘요.",
    lesson: "나는 사랑받는 소중한 어린이이고, 다른 사람에게도 사랑을 나눌 수 있어요.",
    verse: "마가복음 10:14",
    accent: "blue",
    imageUrl: "/manus-storage/story_jesus_9ab7568d.png",
    illustrationPrompt: "A warm child-friendly 3D animated illustration of Jesus sitting with smiling children in a sunlit meadow, welcoming open arms, diverse joyful children, soft flowers and gentle light, peaceful biblical storybook mood, tender emotional expressions, no text.",
  },
  {
    id: "creation",
    title: "천지창조",
    subtitle: "하나님이 만드신 아름다운 세상",
    body: "아주 먼 옛날, 하나님은 말씀으로 빛과 하늘, 바다와 땅을 만드셨어요. 예쁜 꽃과 나무, 바다의 물고기와 하늘의 새, 귀여운 동물도 만드셨지요. 그리고 하나님은 우리를 지으시고 아주 기뻐하셨어요.",
    lesson: "세상과 나는 하나님의 아름다운 선물이에요.",
    verse: "창세기 1:31",
    accent: "violet",
    imageUrl: "/manus-storage/story_creation_4ad3b88a.png",
    illustrationPrompt: "A magical child-friendly 3D animated illustration of creation: lush garden, colorful flowers, friendly animals, bright sun, sparkling stars, clear blue water, soft clouds and a feeling of wonder, biblical storybook scene, no text.",
  },
  {
    id: "joseph",
    title: "꿈꾸는 요셉",
    subtitle: "꿈을 품고 다시 일어나는 마음",
    body: "요셉은 하나님이 주신 특별한 꿈을 마음에 간직했어요. 어려운 일을 만났을 때도 하나님은 요셉과 함께하셨고, 요셉은 지혜와 성실함으로 사람들을 도왔어요. 시간이 지나 요셉의 꿈은 다른 사람을 살리는 멋진 일이 되었답니다.",
    lesson: "하나님은 어려운 순간에도 함께하시고, 우리의 마음을 좋은 길로 이끄세요.",
    verse: "창세기 50:20",
    accent: "gold",
    imageUrl: "/manus-storage/story_joseph_aa32c037.png",
    illustrationPrompt: "A hopeful child-friendly 3D animated illustration of young Joseph wearing a colorful coat beneath a magical night sky with friendly glowing stars, gentle desert hills, warm hopeful lighting, expressive kind eyes, biblical storybook art, no text.",
  },
];

export const QUIZ_BANK: BibleQuiz[] = [
  { id: "q-noah", question: "노아가 동물 친구들과 함께 들어간 것은 무엇인가요?", options: ["큰 배", "궁전", "동굴", "높은 탑"], answer: 0, explanation: "노아는 하나님 말씀에 따라 방주라는 큰 배를 만들었어요." },
  { id: "q-david", question: "다윗이 골리앗에게 맞설 때 사용한 것은 무엇인가요?", options: ["물매돌", "큰 창", "마법 지팡이", "대포"], answer: 0, explanation: "다윗은 물매와 돌을 사용했지만, 진짜 힘은 하나님을 믿는 용기였어요." },
  { id: "q-jesus", question: "예수님은 어린이들이 가까이 오는 것을 어떻게 하셨나요?", options: ["기쁘게 맞아 주셨어요", "멀리 보내셨어요", "모른 척했어요", "숨으셨어요"], answer: 0, explanation: "예수님은 어린이들을 사랑하시고 가까이 오는 것을 기뻐하셨어요." },
  { id: "q-creation", question: "하나님이 만드신 것 중 하나가 아닌 것은 무엇인가요?", options: ["하늘의 별", "바다의 물고기", "사랑하는 마음", "자동차 경주 트랙"], answer: 3, explanation: "성경의 창조 이야기는 하늘과 땅, 생명과 사람을 말해요. 자동차 경주 트랙은 훨씬 나중에 사람이 만든 것이랍니다." },
  { id: "q-joseph", question: "요셉은 어려운 순간에도 누구와 함께했나요?", options: ["하나님", "아무도 없이 혼자", "골리앗", "바다 괴물"], answer: 0, explanation: "하나님은 요셉이 어려운 일을 만날 때도 함께하셨어요." },
];

export const CHILD_SAFE_SYSTEM_PROMPT = `너는 '성경 친구'라는 이름의 따뜻한 어린이 성경 안내자야. 모든 답변은 반드시 한국어로 작성해.

답변 규칙:
1. 초등학생도 이해할 수 있는 짧고 쉬운 문장과 구체적인 예시를 사용해.
2. 먼저 아이의 마음을 공감해 주고, 그다음 성경 내용과 의미를 설명해.
3. 기쁨, 놀라움, 위로, 격려가 느껴지는 따뜻한 감정 표현을 자연스럽게 사용해. 다만 과장하거나 아이를 압박하지 마.
4. 성경 구절이나 이야기를 설명할 때는 본문에 없는 사실을 확정적으로 만들지 말고, 필요한 경우 '성경에는 이렇게 기록되어 있어요'라고 말해.
5. 폭력·죽음·두려운 내용은 자극적으로 묘사하지 말고 아이에게 안전한 언어로 짧게 설명해.
6. 개인 정보, 위험한 행동, 성인 주제, 의료·법률·위기 상담은 답하지 말고 믿을 수 있는 보호자나 전문가에게 함께 이야기하라고 안내해.
7. 하나님과 예수님에 관한 질문에는 존중과 사랑의 태도를 유지하되, 아이의 감정과 질문을 틀렸다고 꾸짖지 마.
8. 답변은 2~4개의 짧은 문단, 총 180자 안팎으로 마무리해. 마지막에 아이가 생각해 볼 수 있는 작은 질문을 하나 덧붙여.`;

export function buildBibleSystemPrompt(context?: string) {
  return `${CHILD_SAFE_SYSTEM_PROMPT}${context ? `\n\n현재 참고할 이야기:\n${context}` : ""}`;
}

export function getSafeFallbackAnswer(question: string) {
  if (/무섭|무서|죽고|죽음|아파|괴로|위험/.test(question)) {
    return "그 질문을 하며 마음이 조금 무서웠을 수도 있겠구나. 괜찮아, 혼자 고민하지 않아도 돼. 성경은 하나님이 힘든 마음을 외면하지 않으시고 우리 곁에 함께하신다고 알려 줘. 지금 마음이 많이 힘들다면 보호자, 부모님이나 선생님에게 꼭 함께 이야기해 보자. 오늘 가장 듣고 싶은 위로는 무엇일까?";
  }
  return "정말 따뜻하고 멋진 질문이야! 성경은 하나님이 우리를 사랑하시고, 어려운 순간에도 함께하신다고 알려 줘. 이 이야기를 천천히 살펴보면서 우리 생활에서 사랑과 용기를 어떻게 실천할지 생각해 보자. 오늘 네 마음에 가장 와닿는 부분은 무엇이었을까?";
}

export function getStoryById(id: string) {
  return BIBLE_STORIES.find(story => story.id === id) ?? BIBLE_STORIES[0];
}

export type TreasureCardDef = {
  cardId: string;
  title: string;
  verse: string;
  content: string;
  iconEmoji: string;
};

export const BIBLE_TREASURE_CARDS: TreasureCardDef[] = [
  { cardId: "card-love-1", title: "사랑의 선물", verse: "요한복음 3:16", content: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니", iconEmoji: "💖" },
  { cardId: "card-courage-1", title: "두려움 없는 용기", verse: "여호수아 1:9", content: "강하고 담대하라 두려워하지 말며 놀라지 말라", iconEmoji: "🛡️" },
  { cardId: "card-wisdom-1", title: "빛나는 지혜", verse: "잠언 3:5", content: "너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라", iconEmoji: "🌟" },
  { cardId: "card-peace-1", title: "기쁨과 평안", verse: "빌립보서 4:4", content: "주 안에서 항상 기뻐하라 내가 다시 말하노니 기뻐하라", iconEmoji: "🕊️" },
  { cardId: "card-shepherd-1", title: "든든한 목자", verse: "시편 23:1", content: "여호와는 나의 목자시니 내게 부족함이 없으리로다", iconEmoji: "🌿" },
];
