export type VoiceMicPresentationState = {
  isListening: boolean;
  isPressed: boolean;
};

export function getVoiceMicLabel({ isListening, isPressed }: VoiceMicPresentationState): string {
  if (isListening) return "듣는 중";
  if (isPressed) return "잠깐만";
  return "말하기";
}

export function getVoiceMicAriaLabel(isListening: boolean): string {
  return isListening ? "음성 인식 중지" : "마이크로 질문하기";
}

export function getVoiceMicStateClass({ isListening, isPressed }: VoiceMicPresentationState): string {
  return [isListening ? "is-listening" : "", isPressed ? "is-pressed" : ""].filter(Boolean).join(" ");
}
