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

  it("exposes the configured Gemini TTS model on the lightweight models endpoint", async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_TTS_MODEL;
    expect(apiKey, "GEMINI_API_KEY must be configured for Gemini TTS").toBeTruthy();
    expect(model, "GEMINI_TTS_MODEL must be configured for Gemini TTS").toBeTruthy();

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey! },
    });
    expect(response.ok, `Gemini models endpoint returned HTTP ${response.status}`).toBe(true);
    const body = await response.json() as { models?: Array<{ name?: string }> };
    expect(body.models?.some(entry => entry.name === `models/${model}` || entry.name?.endsWith(`/${model}`))).toBe(true);
  }, 15_000);
});
