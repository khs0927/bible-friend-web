import { describe, expect, it } from "vitest";
import { pickRecordingMimeType } from "./voiceCapture";

describe("voice capture helpers", () => {
  it("prefers Safari-compatible mp4 when the recorder supports it", () => {
    expect(pickRecordingMimeType({ isTypeSupported: type => type === "audio/mp4" })).toBe("audio/mp4");
  });

  it("falls back through webm and ogg formats", () => {
    expect(pickRecordingMimeType({ isTypeSupported: type => type === "audio/webm;codecs=opus" })).toBe("audio/webm;codecs=opus");
    expect(pickRecordingMimeType({ isTypeSupported: type => type === "audio/ogg;codecs=opus" })).toBe("audio/ogg;codecs=opus");
  });

  it("returns empty when MediaRecorder has no supported format", () => {
    expect(pickRecordingMimeType({ isTypeSupported: () => false })).toBe("");
    expect(pickRecordingMimeType(undefined)).toBe("");
  });
});
