import { describe, expect, it } from "vitest";
import { getVoiceMicAriaLabel, getVoiceMicLabel, getVoiceMicStateClass } from "./voiceMicPresentation";

describe("central voice microphone presentation", () => {
  it("shows the listening state before the transient pressed state", () => {
    expect(getVoiceMicLabel({ isListening: true, isPressed: true })).toBe("듣는 중");
    expect(getVoiceMicStateClass({ isListening: true, isPressed: true })).toBe("is-listening is-pressed");
  });

  it("shows a clear pressed cue while the gesture is being handed to speech capture", () => {
    expect(getVoiceMicLabel({ isListening: false, isPressed: true })).toBe("잠깐만");
    expect(getVoiceMicStateClass({ isListening: false, isPressed: true })).toBe("is-pressed");
  });

  it("returns the idle label and action label when ready", () => {
    expect(getVoiceMicLabel({ isListening: false, isPressed: false })).toBe("말하기");
    expect(getVoiceMicAriaLabel(false)).toBe("마이크로 질문하기");
    expect(getVoiceMicAriaLabel(true)).toBe("음성 인식 중지");
    expect(getVoiceMicStateClass({ isListening: false, isPressed: false })).toBe("");
  });
});
