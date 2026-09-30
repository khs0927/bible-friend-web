import { describe, expect, it } from "vitest";
import { VERSE_LIBRARY, getVerse, pickVerseFor, searchVerses, verseOfTheDay } from "@shared/verseLibrary";

describe("verse library", () => {
  it("has unique ids and non-empty text", () => {
    expect(new Set(VERSE_LIBRARY.map(v => v.id)).size).toBe(VERSE_LIBRARY.length);
    expect(VERSE_LIBRARY.every(v => v.text.length > 5 && v.ref.includes(":"))).toBe(true);
  });

  it("picks a verse that fits the question", () => {
    expect(pickVerseFor("다윗은 왜 용감했어?").id).toBe("1sam-17-45");
    expect(pickVerseFor("밤에 무서워요").id).toBe("isaiah-41-10");
    expect(pickVerseFor("친구랑 싸웠는데 용서해야 해?").id).toBe("eph-4-32");
    expect(pickVerseFor("오늘 날씨 어때?").id).toBe("john-3-16");
  });

  it("searches by text and theme, and the daily verse is stable", () => {
    expect(searchVerses("목자").map(v => v.id)).toEqual(["psalm-23-1"]);
    expect(searchVerses("", "감사").every(v => v.theme === "감사")).toBe(true);
    expect(verseOfTheDay("2026-09-30")).toBe(verseOfTheDay("2026-09-30"));
    expect(getVerse("nope")).toBeUndefined();
  });
});
