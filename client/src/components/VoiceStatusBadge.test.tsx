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

  it("shows the free voice quota explanation when Gemini is limited", () => {
    const html = renderToStaticMarkup(<VoiceStatusBadge enabled status="error" error="Gemini 음성 사용량이 잠시 제한되어 있어요. 글로는 계속 이야기할 수 있어요." />);
    expect(html).toContain("무료 음성 사용량이 잠시 제한될 수 있어요");
    expect(html).toContain("글 대화는 계속 사용할 수 있어요");
  });

  it("renders the concrete error shown after a silent playback failure", () => {
    const html = renderToStaticMarkup(<VoiceStatusBadge enabled status="error" error="브라우저 음성 엔진이 재생을 시작하지 못했어요." />);
    expect(html).toContain("브라우저 음성 엔진이 재생을 시작하지 못했어요.");
    expect(html).toContain("bf-voice-status error");
  });
});
