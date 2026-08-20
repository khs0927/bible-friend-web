import { AudioPlaybackQueue, type TTSMutation, type VoiceRequest } from "@/lib/audioPlaybackQueue";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

const INITIAL_GREETING = "안녕! 무엇이 궁금한지 말해줄래? 😊";
const ASSISTANT_BUBBLE_SELECTOR = ".bf-chat-bubble-row.assistant .bf-chat-bubble";
const DEVICE_SPEECH_START_GUARD_MS = 450;

function isIOSFamilyBrowser() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent ?? "";
  const platform = navigator.platform ?? "";
  const touchPoints = navigator.maxTouchPoints ?? 0;
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
}

function primeIOSSystemSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
  try {
    // iOS may suppress the first asynchronous speechSynthesis call unless the
    // speech engine has already been touched directly by a user gesture.
    const unlock = new SpeechSynthesisUtterance(" ");
    unlock.lang = "ko-KR";
    unlock.volume = 0.01;
    unlock.rate = 1;
    window.speechSynthesis.speak(unlock);
  } catch {
    // Gemini/server audio remains available as the emergency fallback.
  }
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

    const preferSystemSpeech = isIOSFamilyBrowser() && typeof window !== "undefined" && "speechSynthesis" in window;
    let systemSpeechPrimed = false;

    // Prime both media playback and iOS system speech during the child's first
    // gesture. Later answers arrive asynchronously, after the network request.
    const primeFromGesture = () => {
      queue.prime();
      if (preferSystemSpeech && !systemSpeechPrimed) {
        systemSpeechPrimed = true;
        primeIOSSystemSpeech();
      }
    };
    document.addEventListener("pointerdown", primeFromGesture, true);
    document.addEventListener("keydown", primeFromGesture, true);

    const speakBubble = (element: Element) => {
      if (spokenNodesRef.current.has(element)) return;
      spokenNodesRef.current.add(element);

      const text = element.textContent?.trim() ?? "";
      if (!text || text === INITIAL_GREETING) return;

      const request: VoiceRequest = {
        text,
        speaker: "CHILD_FRIEND",
        emotion: "따뜻하고 친근한 격려",
        style: "자연스럽고 또렷하게, 문장 사이에 짧게 호흡하며 읽어 줘.",
      };

      if (preferSystemSpeech) {
        // On iPhone/iPad, use the OS Korean voice first. This path uses no
        // Gemini TTS request, so it cannot be silenced by Gemini rate limits.
        queue.speakBrowserNow(request);

        // Some iOS WebViews can silently suppress speech without emitting an
        // error. Only in that case do we fall back to the Gemini/server queue.
        window.setTimeout(() => {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) return;
          console.warn("[Bible Friend Auto TTS] iOS system speech did not start; using server fallback");
          queue.enqueue(request);
        }, DEVICE_SPEECH_START_GUARD_MS);
        return;
      }

      // Desktop/Android keep the higher-quality Gemini streaming path first.
      queue.enqueue(request);
    };

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
      queue.cancel();
    };
  }, []);

  return null;
}
