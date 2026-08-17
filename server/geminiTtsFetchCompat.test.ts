import { describe, expect, it } from "vitest";
import { buildGenerateContentTtsRequest } from "./_core/geminiTtsFetchCompat";

describe("Gemini TTS generateContent compatibility", () => {
  it("converts the legacy internal audio request to the official generateContent payload", () => {
    const converted = buildGenerateContentTtsRequest({
      model: "gemini-2.5-flash-preview-tts",
      input: "안녕! 나는 성경 친구야.",
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: "Leda" }] },
    });

    expect(converted?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
    );
    expect(converted?.body).toEqual({
      contents: [{ parts: [{ text: "안녕! 나는 성경 친구야." }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Leda" },
          },
        },
      },
    });
  });

  it("rejects a request that has no model or prompt", () => {
    expect(buildGenerateContentTtsRequest({ model: "", input: "" })).toBeNull();
  });
});
