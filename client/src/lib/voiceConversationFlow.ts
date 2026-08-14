import type { VoiceRequest } from "./audioPlaybackQueue";

export type TranscribeInput = { audioDataUrl: string; language: string };
export type AssistantAskInput = { question: string; storyId?: string };

export async function transcribeAndSend(options: {
  audioDataUrl: string;
  transcribe: (input: TranscribeInput) => Promise<unknown>;
  send: (text: string) => Promise<void> | void;
}) {
  const result = await options.transcribe({ audioDataUrl: options.audioDataUrl, language: "ko" });
  if (!result || typeof result !== "object" || !("text" in result) || typeof result.text !== "string" || !result.text.trim()) {
    throw new Error("transcription_empty");
  }
  const text = result.text.trim();
  await options.send(text);
  return text;
}

export async function askAndSpeak(options: {
  input: AssistantAskInput;
  ask: (input: AssistantAskInput) => Promise<string>;
  speak: (request: VoiceRequest) => void;
  context?: string;
}) {
  const answer = await options.ask(options.input);
  options.speak({ text: answer, speaker: "CHILD_FRIEND", emotion: "따뜻한 격려", context: options.context });
  return answer;
}
