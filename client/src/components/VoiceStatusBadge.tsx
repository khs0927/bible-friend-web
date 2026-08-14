import React from "react";
import { getVoiceStatusText, type VoiceStatus } from "@/lib/voiceStatus";

type VoiceStatusBadgeProps = {
  enabled: boolean;
  status: VoiceStatus;
  error: string | null;
};

export function VoiceStatusBadge({ enabled, status, error }: VoiceStatusBadgeProps) {
  return (
    <div className={`bf-voice-status ${status} ${status === "error" ? "error" : ""}`} role="status">
      <i />
      {getVoiceStatusText(enabled, status, error)}
    </div>
  );
}
