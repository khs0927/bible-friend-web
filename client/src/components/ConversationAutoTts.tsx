import { AudioPlaybackQueue, type TTSMutation, type VoiceRequest } from "@/lib/audioPlaybackQueue";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

const INITIAL_GREETING = "안녕! 무엇이 궁금한지 말해줄래? 😊";
const ASSISTANT_BUBBLE_SELECTOR = ".bf-chat-bubble-row.assistant .bf-chat-bubble";
const REPLAY_TTS_EVENT = "bible-friend:replay-tts";

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

    const replayLatest = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: string }>).detail;
      const text = detail?.text?.trim() ?? "";
      if (!text) return;
      // This event is dispatched synchronously by the visible replay button,
      // so queue.prime() inside enqueue still runs during the user's tap.
      queue.cancel();
      queue.enqueue(voiceRequest(text));
    };
    window.addEventListener(REPLAY_TTS_EVENT, replayLatest as EventListener);

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
      window.removeEventListener(REPLAY_TTS_EVENT, replayLatest as EventListener);
      queue.cancel();
    };
  }, []);

  return null;
}
