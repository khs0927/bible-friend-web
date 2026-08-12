export type VoiceStatus = "ready" | "speaking" | "fallback" | "error";

export function getVoiceStateFromPlaybackStarted(provider: string): { status: VoiceStatus; error: string | null } {
  return { status: provider === "browser" ? "fallback" : "speaking", error: null };
}

export function getVoiceStateFromPlaybackError(code: string, message: string): { status: VoiceStatus; error: string } {
  return { status: "error", error: code === "rate_limit" ? "오늘의 AI 음성 사용량이 잠시 쉬고 있어요." : message };
}

export function getVoiceStatusText(enabled: boolean, status: VoiceStatus, error: string | null) {
  if (!enabled) return "음성 답변이 꺼져 있어요";
  if (status === "speaking") return "성경 친구가 말하고 있어요…";
  if (status === "fallback") return "브라우저 음성으로 이어서 재생해요";
  if (status === "error") return error ?? "음성을 재생하지 못했어요";
  return "Gemini 한국어 음성 준비됨";
}
