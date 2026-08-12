import { describe, expect, it } from "vitest";

describe("Gemini API credentials", () => {
  it("accepts the configured key on the lightweight models endpoint", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    expect(apiKey, "GEMINI_API_KEY must be configured for Gemini TTS").toBeTruthy();

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey! },
    });

    expect(response.ok, `Gemini models endpoint returned HTTP ${response.status}`).toBe(true);
  }, 15_000);
});
