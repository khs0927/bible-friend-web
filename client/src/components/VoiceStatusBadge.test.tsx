import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceStatusBadge } from "./VoiceStatusBadge";

describe("VoiceStatusBadge", () => {
  it("renders the speaking state used after server audio starts", () => {
    const html = renderToStaticMarkup(<VoiceStatusBadge enabled status="speaking" error={null} />);
    expect(html).toContain("성경 친구가 말하고 있어요…");
    expect(html).toContain('role="status"');
  });

  it("renders the concrete error shown after a silent playback failure", () => {
    const html = renderToStaticMarkup(<VoiceStatusBadge enabled status="error" error="브라우저 음성 엔진이 재생을 시작하지 못했어요." />);
    expect(html).toContain("브라우저 음성 엔진이 재생을 시작하지 못했어요.");
    expect(html).toContain("bf-voice-status error");
  });
});
