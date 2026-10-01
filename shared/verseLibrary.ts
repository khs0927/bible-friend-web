// Verses (개역개정) the friend shows next to answers and in Records. Keep the
// text exact; `keywords` pick the verse that fits a question or answer.

export type VerseTheme = "사랑" | "용기" | "평안" | "위로" | "기도" | "감사" | "지혜" | "용서" | "소망" | "친구" | "가족" | "예수님";

export interface LibraryVerse {
  id: string;
  ref: string;
  text: string;
  theme: VerseTheme;
  keywords: string[];
}

export const VERSE_LIBRARY: LibraryVerse[] = [
  { id: "john-3-16", ref: "요한복음 3:16", theme: "사랑", keywords: ["사랑", "세상", "영생"], text: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라" },
  { id: "1john-4-19", ref: "요한일서 4:19", theme: "사랑", keywords: ["사랑하시", "나를 사랑", "먼저"], text: "우리가 사랑함은 그가 먼저 우리를 사랑하셨음이라" },
  { id: "1cor-13-4", ref: "고린도전서 13:4", theme: "사랑", keywords: ["참", "온유", "시기", "자랑"], text: "사랑은 오래 참고 사랑은 온유하며 시기하지 아니하며 사랑은 자랑하지 아니하며 교만하지 아니하며" },
  { id: "1sam-17-45", ref: "사무엘상 17:45", theme: "용기", keywords: ["다윗", "골리앗", "블레셋", "물맷돌"], text: "다윗이 블레셋 사람에게 이르되 너는 칼과 창과 단창으로 내게 나아오거니와 나는 만군의 여호와의 이름 곧 네가 모욕하는 이스라엘 군대의 하나님의 이름으로 네게 나아가노라" },
  { id: "isaiah-41-10", ref: "이사야 41:10", theme: "용기", keywords: ["두려", "무서", "겁", "놀라"], text: "두려워하지 말라 내가 너와 함께 함이라 놀라지 말라 나는 네 하나님이 됨이라 내가 너를 굳세게 하리라 참으로 너를 도와 주리라 참으로 나의 의로운 오른손으로 너를 붙들리라" },
  { id: "joshua-1-9", ref: "여호수아 1:9", theme: "용기", keywords: ["용기", "강하고", "담대", "용감"], text: "내가 네게 명령한 것이 아니냐 강하고 담대하라 두려워하지 말며 놀라지 말라 네가 어디로 가든지 네 하나님 여호와가 너와 함께 하느니라" },
  { id: "john-14-27", ref: "요한복음 14:27", theme: "평안", keywords: ["평안", "근심", "불안"], text: "평안을 너희에게 끼치노니 곧 나의 평안을 너희에게 주노라 내가 너희에게 주는 것은 세상이 주는 것과 같지 아니하니라 너희는 마음에 근심하지도 말고 두려워하지도 말라" },
  { id: "phil-4-6", ref: "빌립보서 4:6", theme: "기도", keywords: ["걱정", "염려", "기도", "간구"], text: "아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로 너희 구할 것을 감사함으로 하나님께 아뢰라" },
  { id: "1thes-5-16", ref: "데살로니가전서 5:16-18", theme: "감사", keywords: ["기뻐", "감사", "쉬지 말고"], text: "항상 기뻐하라 쉬지 말고 기도하라 범사에 감사하라 이것이 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라" },
  { id: "psalm-136-1", ref: "시편 136:1", theme: "감사", keywords: ["감사", "선하시", "인자"], text: "여호와께 감사하라 그는 선하시며 그 인자하심이 영원함이로다" },
  { id: "psalm-23-1", ref: "시편 23:1", theme: "위로", keywords: ["목자", "부족", "돌보", "양"], text: "여호와는 나의 목자시니 내게 부족함이 없으리로다" },
  { id: "matt-11-28", ref: "마태복음 11:28", theme: "위로", keywords: ["힘들", "지쳐", "피곤", "슬퍼", "속상", "쉬게"], text: "수고하고 무거운 짐 진 자들아 다 내게로 오라 내가 너희를 쉬게 하리라" },
  { id: "prov-3-5", ref: "잠언 3:5", theme: "지혜", keywords: ["지혜", "신뢰", "공부", "결정"], text: "너는 마음을 다하여 여호와를 신뢰하고 네 명철을 의지하지 말라" },
  { id: "psalm-119-105", ref: "시편 119:105", theme: "지혜", keywords: ["말씀", "성경", "길", "빛"], text: "주의 말씀은 내 발에 등이요 내 길에 빛이니이다" },
  { id: "eph-4-32", ref: "에베소서 4:32", theme: "용서", keywords: ["용서", "친절", "화해", "싸웠"], text: "서로 친절하게 하며 불쌍히 여기며 서로 용서하기를 하나님이 그리스도 안에서 너희를 용서하심과 같이 하라" },
  { id: "rom-8-28", ref: "로마서 8:28", theme: "소망", keywords: ["합력", "선을", "왜 이런"], text: "우리가 알거니와 하나님을 사랑하는 자 곧 그의 뜻대로 부르심을 입은 자들에게는 모든 것이 합력하여 선을 이루느니라" },
  { id: "jer-29-11", ref: "예레미야 29:11", theme: "소망", keywords: ["미래", "희망", "꿈", "소망"], text: "여호와의 말씀이니라 너희를 향한 나의 생각을 내가 아나니 평안이요 재앙이 아니니라 너희에게 미래와 희망을 주는 것이니라" },
  { id: "john-15-12", ref: "요한복음 15:12", theme: "친구", keywords: ["친구", "서로 사랑"], text: "내 계명은 곧 내가 너희를 사랑한 것 같이 너희도 서로 사랑하라 하는 이것이니라" },
  { id: "matt-22-39", ref: "마태복음 22:39", theme: "친구", keywords: ["이웃", "도와", "나눔"], text: "둘째도 그와 같으니 네 이웃을 네 자신 같이 사랑하라 하셨으니" },
  { id: "eph-6-1", ref: "에베소서 6:1", theme: "가족", keywords: ["부모", "엄마", "아빠", "순종", "가족"], text: "자녀들아 주 안에서 너희 부모에게 순종하라 이것이 옳으니라" },
  { id: "luke-2-11", ref: "누가복음 2:11", theme: "예수님", keywords: ["예수님", "태어", "탄생", "성탄", "구주", "왜 세상에"], text: "오늘 다윗의 동네에 너희를 위하여 구주가 나셨으니 곧 그리스도 주시니라" },
  { id: "gen-1-1", ref: "창세기 1:1", theme: "예수님", keywords: ["창조", "만드셨", "세상은 어떻게", "태초"], text: "태초에 하나님이 천지를 창조하시니라" },
];

export const VERSE_THEMES: VerseTheme[] = ["사랑", "용기", "평안", "위로", "기도", "감사", "지혜", "용서", "소망", "친구", "가족", "예수님"];

export function getVerse(id: string): LibraryVerse | undefined {
  return VERSE_LIBRARY.find(verse => verse.id === id);
}

function bestMatch(text: string): { verse: LibraryVerse; score: number } {
  let best = { verse: VERSE_LIBRARY[0], score: 0 };
  for (const verse of VERSE_LIBRARY) {
    const score = verse.keywords.filter(keyword => text.includes(keyword)).length;
    if (score > best.score) best = { verse, score };
  }
  return best;
}

/**
 * Verse that fits the child's question; the answer is only consulted when the
 * question itself names no topic ("더 쉽게 설명해줘"). Stable fallback is
 * John 3:16. Ties go to the earlier entry, so story-specific verses (names)
 * sit first within a theme.
 */
export function pickVerseFor(question: string, answer = ""): LibraryVerse {
  const fromQuestion = bestMatch(question);
  if (fromQuestion.score > 0) return fromQuestion.verse;
  return bestMatch(answer).verse;
}

export function searchVerses(query: string, theme?: VerseTheme): LibraryVerse[] {
  const q = query.trim();
  return VERSE_LIBRARY.filter(
    verse =>
      (!theme || verse.theme === theme) &&
      (!q || `${verse.ref} ${verse.text} ${verse.theme} ${verse.keywords.join(" ")}`.includes(q)),
  );
}

/** Same verse for everyone on a given day (YYYY-MM-DD). */
export function verseOfTheDay(day: string): LibraryVerse {
  let hash = 0;
  for (const ch of day) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return VERSE_LIBRARY[hash % VERSE_LIBRARY.length];
}
