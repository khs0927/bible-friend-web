export interface GrowthDailyVerse {
  id: string;
  ref: string;
  text: string;
  theme: string;
}

// Short key-verse excerpts intentionally kept concise for child memorization and
// robust speech transcription. The full Bible passage remains available in the
// reading experience and must be sourced from the app's canonical Bible content.
export const GROWTH_DAILY_VERSES: GrowthDailyVerse[] = [
  { id: "john-3-16", ref: "요한복음 3:16", text: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니", theme: "사랑" },
  { id: "psalm-23-1", ref: "시편 23:1", text: "여호와는 나의 목자시니 내게 부족함이 없으리로다", theme: "돌보심" },
  { id: "phil-4-6", ref: "빌립보서 4:6", text: "아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로", theme: "평안" },
  { id: "eph-6-16", ref: "에베소서 6:16", text: "모든 것 위에 믿음의 방패를 가지고", theme: "믿음" },
];

export function getGrowthDailyVerse(id: string) {
  return GROWTH_DAILY_VERSES.find(verse => verse.id === id) ?? null;
}
