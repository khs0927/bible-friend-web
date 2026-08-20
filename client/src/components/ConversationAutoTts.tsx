import { AudioPlaybackQueue, type TTSMutation, type VoiceRequest } from "@/lib/audioPlaybackQueue";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

const INITIAL_GREETING = "안녕! 무엇이 궁금한지 말해줄래? 😊";
const ASSISTANT_BUBBLE_SELECTOR = ".bf-chat-bubble-row.assistant .bf-chat-bubble";

function voiceRequest(text: string): VoiceRequest {
  return {
    text,
    speaker: "CHILD_FRIEND",
    emotion: "따뜻하고 친근한 격려",
    style: "자연스럽고 또렷하게, 문장 사이에 짧게 호흡하며 읽어 줘.",
  };
}

export default function ConversationAutoTts() {
  const ttsMutation = trpc.tts.synthesize.useMutation();
  const queueRef = useRef<AudioPlaybackQueue | null>(null);
  const spokenNodesRef = useRef<WeakSet<Element>>(new WeakSet());

  if (!queueRef.current) {
    queueRef.current = new AudioPlaybackQueue(ttsMutation as TTSMutation, {
      allowBrowserFallback: true,
      fastFallbackMs: 7_000,
      lateServerRecoveryMs: 8_000,
      onPlaybackError: info => {
        console.warn("[Bible Friend Auto TTS] playback fallback", {
          provider: info.provider,
          code: info.code,
          message: info.message,
        });
      },
    });
  }

  useEffect(() => {
    const queue = queueRef.current;
    if (!queue || typeof document === "undefined") return;

    // Prime WebAudio/HTMLAudio while the child's tap is still a trusted user
    // gesture. Do not cancel this primed media element before the async Gemini
    // response arrives; iOS otherwise blocks the later audio.play() call.
    const primeFromGesture = () => queue.prime();
    document.addEventListener("pointerdown", primeFromGesture, true);
    document.addEventListener("keydown", primeFromGesture, true);

    const speakBubble = (element: Element) => {
      if (spokenNodesRef.current.has(element)) return;
      spokenNodesRef.current.add(element);

      const text = element.textContent?.trim() ?? "";
      if (!text || text === INITIAL_GREETING) return;
      queue.enqueue(voiceRequest(text));
    };

    // The visible "음성으로 듣기" button did not previously have a handler.
    // Handle it globally so the replay starts from the same trusted tap on iOS.
    const replayFromClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("button");
      if (!button || !button.textContent?.includes("음성으로 듣기")) return;
      const bubbles = document.querySelectorAll(ASSISTANT_BUBBLE_SELECTOR);
      const latest = bubbles.item(bubbles.length - 1);
      const text = latest?.textContent?.trim() ?? "";
      if (!text || text === INITIAL_GREETING) return;
      queue.cancel();
      queue.enqueue(voiceRequest(text));
    };
    document.addEventListener("click", replayFromClick, true);

    const scanNode = (node: Node) => {
      if (!(node instanceof Element)) return;
      if (node.matches(ASSISTANT_BUBBLE_SELECTOR)) speakBubble(node);
      node.querySelectorAll(ASSISTANT_BUBBLE_SELECTOR).forEach(speakBubble);
    };

    // Mark any assistant bubbles that already existed before this observer as
    // seen, so mounting/reloading does not unexpectedly replay old messages.
    document.querySelectorAll(ASSISTANT_BUBBLE_SELECTOR).forEach(element => {
      spokenNodesRef.current.add(element);
    });

    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(scanNode);
      }
    });
    observer.observe(document.getElementById("root") ?? document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", primeFromGesture, true);
      document.removeEventListener("keydown", primeFromGesture, true);
      document.removeEventListener("click", replayFromClick, true);
      queue.cancel();
    };
  }, []);

  return null;
}
