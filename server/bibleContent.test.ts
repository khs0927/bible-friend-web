import { describe, expect, it } from "vitest";
import { BIBLE_STORIES, QUIZ_BANK, buildBibleSystemPrompt, getSafeFallbackAnswer } from "./bibleContent";

describe("Bible Friend content", () => {
  it("keeps the five required story titles in the product order", () => {
    expect(BIBLE_STORIES.map(story => story.title)).toEqual([
      "노아의 방주",
      "다윗과 골리앗",
      "예수님의 사랑",
      "천지창조",
      "꿈꾸는 요셉",
    ]);
  });

  it("provides a safe Korean child-facing system prompt", () => {
    const prompt = buildBibleSystemPrompt("노아의 방주");
    expect(prompt).toContain("반드시 한국어");
    expect(prompt).toContain("보호자");
    expect(prompt).toContain("노아의 방주");
  });

  it("keeps a quiz bank with answer explanations", () => {
    expect(QUIZ_BANK.length).toBeGreaterThanOrEqual(5);
    for (const quiz of QUIZ_BANK) {
      expect(quiz.options[quiz.answer]).toBeTruthy();
      expect(quiz.explanation.length).toBeGreaterThan(10);
    }
  });

  it("returns a calm fallback for emotional questions", () => {
    expect(getSafeFallbackAnswer("너무 무서워요")).toContain("보호자");
    expect(getSafeFallbackAnswer("하나님은 누구예요?")).toContain("하나님");
  });
});
