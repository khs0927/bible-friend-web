import { describe, expect, it, vi } from "vitest";
import { askAndSpeak, transcribeAndSend } from "./voiceConversationFlow";

describe("voice conversation flow", () => {
  it("transcribes a microphone recording and sends the resulting question", async () => {
    const transcribe = vi.fn(async () => ({ text: "노아의 방주는 어떤 이야기예요?" }));
    const send = vi.fn(async () => undefined);

    const question = await transcribeAndSend({
      audioDataUrl: "data:audio/mp4;base64,AA==",
      transcribe,
      send,
    });

    expect(transcribe).toHaveBeenCalledWith({ audioDataUrl: "data:audio/mp4;base64,AA==", language: "ko" });
    expect(send).toHaveBeenCalledWith("노아의 방주는 어떤 이야기예요?");
    expect(question).toBe("노아의 방주는 어떤 이야기예요?");
  });

  it("speaks the assistant answer automatically with the Gemini child-friend profile", async () => {
    const ask = vi.fn(async () => "하나님은 우리를 지켜 주시는 분이야.");
    const speak = vi.fn();

    const answer = await askAndSpeak({
      input: { question: "하나님은 나를 지켜 주시나요?" },
      ask,
      speak,
      context: "노아의 방주",
    });

    expect(ask).toHaveBeenCalledWith({ question: "하나님은 나를 지켜 주시나요?" });
    expect(speak).toHaveBeenCalledWith({
      text: "하나님은 우리를 지켜 주시는 분이야.",
      speaker: "CHILD_FRIEND",
      emotion: "따뜻한 격려",
      context: "노아의 방주",
    });
    expect(answer).toBe("하나님은 우리를 지켜 주시는 분이야.");
  });
});
