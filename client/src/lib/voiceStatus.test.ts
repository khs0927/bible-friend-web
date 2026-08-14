import { describe, expect, it } from "vitest";
import { getVoiceStateFromPlaybackError, getVoiceStatusText, getVoiceToggleLabel } from "./voiceStatus";

describe("voice status text", () => {
  it("uses opposite action labels for the voice toggle", () => {
    expect(getVoiceToggleLabel(true)).toBe("답변 음성 끄기");
    expect(getVoiceToggleLabel(false)).toBe("답변 음성 켜기");
  });
  it("renders the speaking and fallback states used by Home", () => {
    expect(getVoiceStatusText(true, "speaking", null)).toBe("성경 친구가 말하고 있어요…");
    expect(getVoiceStatusText(true, "fallback", null)).toBe("브라우저 음성으로 이어서 재생해요");
  });

  it("renders the concrete error instead of hiding a silent failure", () => {
    expect(getVoiceStatusText(true, "error", "브라우저 음성 엔진이 재생을 시작하지 못했어요.")).toBe("브라우저 음성 엔진이 재생을 시작하지 못했어요.");
    expect(getVoiceStatusText(true, "error", null)).toBe("음성을 재생하지 못했어요");
  });

  it("maps internal browser and rate-limit errors to child-friendly messages", () => {
    expect(getVoiceStateFromPlaybackError("browser_speech_unavailable", "error1").error).toBe("이 기기에서 음성을 준비하지 못했어요. 잠시 후 다시 눌러 주세요.");
    expect(getVoiceStateFromPlaybackError("rate_limit", "error1").error).toContain("Gemini 음성 사용량");
    expect(getVoiceStateFromPlaybackError("rate_limit", "error1").error).toContain("제한");
    expect(getVoiceStateFromPlaybackError("timeout", "error1").error).toContain("음성 준비가 늦어지고");
  });

  it("explains when the child turned voice off", () => {
    expect(getVoiceStatusText(false, "ready", null)).toBe("음성 답변이 꺼져 있어요");
  });
});
