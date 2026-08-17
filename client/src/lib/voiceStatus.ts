export type VoiceStatus = "ready" | "speaking" | "fallback" | "error";

export function getVoiceStateFromPlaybackStarted(provider: string): { status: VoiceStatus; error: string | null } {
  return { status: provider === "browser" ? "fallback" : "speaking", error: null };
}

export function getVoiceStateFromPlaybackError(code: string, message: string): { status: VoiceStatus; error: string } {
  if (code === "rate_limit" || code === "quota") {
    return { status: "error", error: "Gemini 음성 사용량이 잠시 제한되어 있어요. 글로는 계속 이야기할 수 있어요." };
  }
  if (code === "browser_speech_unavailable" || code === "synthesis-failed" || code === "browser_speech_error") {
    return { status: "error", error: "이 기기에서 음성을 준비하지 못했어요. 잠시 후 다시 눌러 주세요." };
  }
  if (code === "timeout") {
    return { status: "error", error: "음성 준비가 늦어지고 있어요. 잠시 후 다시 눌러 주세요." };
  }

  // Safari/WebKit can surface low-level DOMException/URL parsing messages such as
  // "The string did not match the expected pattern.". Never expose those raw
  // browser implementation details in the child-facing UI.
  const normalizedMessage = (message ?? "").toLowerCase();
  if (
    code === "audio_play_failed" ||
    normalizedMessage.includes("expected pattern") ||
    normalizedMessage.includes("invalid url") ||
    normalizedMessage.includes("domexception")
  ) {
    return { status: "error", error: "음성을 재생하지 못했어요. 잠시 후 다시 눌러 주세요." };
  }

  return { status: "error", error: message || "음성을 재생하지 못했어요. 잠시 후 다시 눌러 주세요." };
}

export function getVoiceToggleLabel(enabled: boolean) {
  return enabled ? "답변 음성 끄기" : "답변 음성 켜기";
}

export function getVoiceStatusText(enabled: boolean, status: VoiceStatus, error: string | null) {
  if (!enabled) return "음성 답변이 꺼져 있어요";
  if (status === "speaking") return "성경 친구가 말하고 있어요…";
  if (status === "fallback") return "브라우저 음성으로 이어서 재생해요";
  if (status === "error") return error ?? "음성을 재생하지 못했어요";
  return "Gemini 한국어 음성 준비됨";
}
