import { describe, expect, it } from "vitest";
import { GEMINI_TTS_API_REVISION, withGeminiTtsRevision } from "./_core/geminiTtsFetchCompat";

describe("Gemini TTS Interactions compatibility", () => {
  it("adds the current audio API revision without losing existing headers", () => {
    const patched = withGeminiTtsRevision({
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": "test" },
    });
    const headers = new Headers(patched.headers);
    expect(headers.get("Api-Revision")).toBe(GEMINI_TTS_API_REVISION);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("x-goog-api-key")).toBe("test");
  });

  it("preserves an explicitly supplied revision", () => {
    const patched = withGeminiTtsRevision({ headers: { "Api-Revision": "custom-revision" } });
    expect(new Headers(patched.headers).get("Api-Revision")).toBe("custom-revision");
  });
});
