import React from "react";
import { getVoiceStatusText, type VoiceStatus } from "@/lib/voiceStatus";

type VoiceStatusBadgeProps = {
  enabled: boolean;
  status: VoiceStatus;
  error: string | null;
};

export function VoiceStatusBadge({ enabled, status, error }: VoiceStatusBadgeProps) {
  const isGeminiQuotaLimited = status === "error" && error?.includes("Gemini 음성 사용량");
  return (
    <div className={`bf-voice-status ${status} ${status === "error" ? "error" : ""}`} role="status">
      <i />
      <span>{getVoiceStatusText(enabled, status, error)}</span>
      {isGeminiQuotaLimited && <small className="bf-voice-limit-help">무료 음성 사용량이 잠시 제한될 수 있어요. 글 대화는 계속 사용할 수 있어요.</small>}
    </div>
  );
}
