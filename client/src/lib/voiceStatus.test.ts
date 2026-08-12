import { describe, expect, it } from "vitest";
import { getVoiceStatusText } from "./voiceStatus";

describe("voice status text", () => {
  it("renders the speaking and fallback states used by Home", () => {
    expect(getVoiceStatusText(true, "speaking", null)).toBe("성경 친구가 말하고 있어요…");
    expect(getVoiceStatusText(true, "fallback", null)).toBe("브라우저 음성으로 이어서 재생해요");
  });

  it("renders the concrete error instead of hiding a silent failure", () => {
    expect(getVoiceStatusText(true, "error", "브라우저 음성 엔진이 재생을 시작하지 못했어요.")).toBe("브라우저 음성 엔진이 재생을 시작하지 못했어요.");
    expect(getVoiceStatusText(true, "error", null)).toBe("음성을 재생하지 못했어요");
  });

  it("explains when the child turned voice off", () => {
    expect(getVoiceStatusText(false, "ready", null)).toBe("음성 답변이 꺼져 있어요");
  });
});
