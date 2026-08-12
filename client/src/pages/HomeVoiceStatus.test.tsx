import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeVoiceStatus } from "./Home";
import { getVoiceStateFromPlaybackError, getVoiceStateFromPlaybackStarted } from "@/lib/voiceStatus";

describe("HomeVoiceStatus", () => {
  it("renders the speaking state after AudioPlaybackQueue onPlaybackStarted", () => {
    const html = renderToStaticMarkup(<HomeVoiceStatus enabled status="speaking" error={null} />);
    expect(html).toContain("성경 친구가 말하고 있어요…");
  });

  it("maps AudioPlaybackQueue onPlaybackStarted to the speaking badge", () => {
    const nextState = getVoiceStateFromPlaybackStarted("gemini");
    const html = renderToStaticMarkup(<HomeVoiceStatus enabled status={nextState.status} error={nextState.error} />);
    expect(html).toContain("성경 친구가 말하고 있어요…");
  });

  it("renders the error state after AudioPlaybackQueue onPlaybackError", () => {
    const nextState = getVoiceStateFromPlaybackError("synthesis-failed", "브라우저 음성 엔진이 재생을 시작하지 못했어요.");
    const html = renderToStaticMarkup(<HomeVoiceStatus enabled status={nextState.status} error={nextState.error} />);
    expect(html).toContain("브라우저 음성 엔진이 재생을 시작하지 못했어요.");
    expect(html).toContain("bf-voice-status error");
  });
});
