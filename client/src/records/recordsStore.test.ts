import { describe, expect, it } from "vitest";
import {
  EMPTY_RECORDS,
  MAX_RECENTS,
  addPrayer,
  addRecent,
  formatRecordTime,
  isFavorite,
  parseRecords,
  removeFavorites,
  setPrayerStatus,
  toggleFavorite,
} from "./recordsStore";

const AT = "2026-09-30T09:30:00.000Z";

describe("records store", () => {
  it("keeps the newest recents first and caps the list", () => {
    let state = EMPTY_RECORDS;
    for (let i = 0; i < MAX_RECENTS + 5; i++) {
      state = addRecent(state, { question: `q${i}`, answer: "a", verseId: "john-3-16", at: AT });
    }
    expect(state.recents).toHaveLength(MAX_RECENTS);
    expect(state.recents[0].question).toBe(`q${MAX_RECENTS + 4}`);
  });

  it("toggles favorites by content and removes by id", () => {
    const verse = { kind: "verse" as const, title: "시편 23:1", body: "여호와는 나의 목자시니", verseId: "psalm-23-1", at: AT };
    let state = toggleFavorite(EMPTY_RECORDS, verse);
    expect(isFavorite(state, verse)).toBe(true);
    expect(toggleFavorite(state, verse).favorites).toHaveLength(0);
    state = toggleFavorite(state, { kind: "answer", title: "다윗", body: "다윗은 용감했어요", at: AT });
    expect(state.favorites).toHaveLength(2);
    expect(removeFavorites(state, [state.favorites[0].id]).favorites).toHaveLength(1);
  });

  it("tracks prayer answers", () => {
    let state = addPrayer(EMPTY_RECORDS, { title: "가족", category: "가족", at: AT });
    expect(state.prayers[0].status).toBe("기도 중");
    state = setPrayerStatus(state, state.prayers[0].id, "응답됨", AT);
    expect(state.prayers[0]).toMatchObject({ status: "응답됨", answeredAt: AT });
    state = setPrayerStatus(state, state.prayers[0].id, "기도 중", AT);
    expect(state.prayers[0].answeredAt).toBeUndefined();
  });

  it("migrates user prayers from the old screen but drops its samples", () => {
    const legacy = JSON.stringify([
      { id: 1760000000000, title: "내 기도", status: "기도 중", category: "학교" },
      { id: 1, title: "샘플", status: "기도 중" },
    ]);
    const state = parseRecords(null, legacy, AT);
    expect(state.prayers.map(p => p.title)).toEqual(["내 기도"]);
    expect(parseRecords("{broken", null, AT)).toEqual(EMPTY_RECORDS);
  });

  it("formats times relative to now", () => {
    const now = new Date(2026, 8, 30, 12, 0);
    expect(formatRecordTime(new Date(2026, 8, 30, 9, 5).toISOString(), now)).toBe("오늘 09:05");
    expect(formatRecordTime(new Date(2026, 8, 29, 20, 15).toISOString(), now)).toBe("어제 20:15");
    expect(formatRecordTime(new Date(2026, 4, 18, 8, 0).toISOString(), now)).toBe("5월 18일");
  });
});
