import { AudioPlaybackQueue, type TTSMutation, type VoiceRequest } from "@/lib/audioPlaybackQueue";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";

const INITIAL_GREETING = "안녕! 무엇이 궁금한지 말해줄래? 😊";
const ASSISTANT_BUBBLE_SELECTOR = ".bf-chat-bubble-row.assistant .bf-chat-bubble";
const IOS_MEDIA_BRIDGE_WAV = "data:audio/wav;base64,UklGRgQCAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YeABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

let iosMediaBridge: HTMLAudioElement | null = null;
let iosMediaBridgeStopTimer: ReturnType<typeof setTimeout> | undefined;

function voiceRequest(text: string): VoiceRequest {
  return {
    text,
    speaker: "CHILD_FRIEND",
    emotion: "따뜻하고 친근한 격려",
    style: "자연스럽고 또렷하게, 문장 사이에 짧게 호흡하며 읽어 줘.",
  };
}

function isIOSLikeBrowser() {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent ?? "";
  const platform = navigator.platform ?? "";
  const touchPoints = navigator.maxTouchPoints ?? 0;
  return /iPad|iPhone|iPod/i.test(userAgent) || (platform === "MacIntel" && touchPoints > 1);
}

function forceIOSPlaybackSession() {
  if (!isIOSLikeBrowser() || typeof navigator === "undefined") return;
  try {
    const audioSession = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (audioSession) audioSession.type = "playback";
  } catch {
    // Older iOS/WebViews do not expose navigator.audioSession.
  }
}

function primeIOSMediaChannel() {
  if (!isIOSLikeBrowser() || typeof Audio === "undefined") return;
  try {
    iosMediaBridge ??= new Audio();
    const audio = iosMediaBridge;
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = 1;
    audio.setAttribute?.("playsinline", "");
    try {
      (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    } catch {
      // Older WebViews may not expose playsInline as writable.
    }
    if (audio.src !== IOS_MEDIA_BRIDGE_WAV) audio.src = IOS_MEDIA_BRIDGE_WAV;
    if (iosMediaBridgeStopTimer) clearTimeout(iosMediaBridgeStopTimer);
    void audio.play().catch(() => undefined);
    // Keep the media channel open long enough for speech recognition, the AI
    // response and a long Gemini stream. This tiny file contains only silence.
    iosMediaBridgeStopTimer = setTimeout(() => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // The bridge may already have stopped.
      }
    }, 120_000);
  } catch {
    // The normal WebAudio/direct-audio fallbacks remain available.
  }
}

function stopIOSMediaChannelSoon(delayMs = 1_500) {
  if (!iosMediaBridge) return;
  if (iosMediaBridgeStopTimer) clearTimeout(iosMediaBridgeStopTimer);
  iosMediaBridgeStopTimer = setTimeout(() => {
    try {
      iosMediaBridge?.pause();
      if (iosMediaBridge) iosMediaBridge.currentTime = 0;
    } catch {
      // Ignore teardown failures.
    }
  }, delayMs);
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
      onPlaybackStarted: () => {
        forceIOSPlaybackSession();
        primeIOSMediaChannel();
      },
      onPlaybackFinished: () => {
        stopIOSMediaChannelSoon();
      },
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

    // Prime both WebAudio and an HTML media channel while the child's tap is
    // still trusted. On iOS, WebAudio can otherwise remain silent while the
    // hardware silent switch is enabled even though the Gemini stream itself
    // is arriving normally.
    const primeFromGesture = () => {
      queue.prime();
      primeIOSMediaChannel();
    };
    document.addEventListener("pointerdown", primeFromGesture, true);
    document.addEventListener("touchstart", primeFromGesture, true);
    document.addEventListener("keydown", primeFromGesture, true);

    const speakBubble = (element: Element) => {
      if (spokenNodesRef.current.has(element)) return;

      const text = element.textContent?.trim() ?? "";
      // Do not mark an empty bubble as spoken. Some chat renders insert the
      // assistant container first and fill in its text a moment later.
      if (!text || text === INITIAL_GREETING) return;
      spokenNodesRef.current.add(element);

      forceIOSPlaybackSession();
      queue.enqueue(voiceRequest(text));
    };

    // The visible "음성으로 듣기" button uses the same media-channel priming
    // and Gemini path so replay is reliable on iPhone as well.
    const replayFromClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest("button");
      if (!button || !button.textContent?.includes("음성으로 듣기")) return;
      const bubbles = document.querySelectorAll(ASSISTANT_BUBBLE_SELECTOR);
      const latest = bubbles.item(bubbles.length - 1);
      const text = latest?.textContent?.trim() ?? "";
      if (!text || text === INITIAL_GREETING) return;
      forceIOSPlaybackSession();
      primeIOSMediaChannel();
      queue.cancel();
      queue.enqueue(voiceRequest(text));
    };
    document.addEventListener("click", replayFromClick, true);

    const scanNode = (node: Node) => {
      if (node instanceof Element) {
        if (node.matches(ASSISTANT_BUBBLE_SELECTOR)) speakBubble(node);
        node.querySelectorAll(ASSISTANT_BUBBLE_SELECTOR).forEach(speakBubble);
        return;
      }
      if (node.parentElement) {
        const bubble = node.parentElement.closest(ASSISTANT_BUBBLE_SELECTOR);
        if (bubble) speakBubble(bubble);
      }
    };

    // Mark complete assistant bubbles that already existed before this observer
    // as seen, so mounting/reloading does not unexpectedly replay old messages.
    document.querySelectorAll(ASSISTANT_BUBBLE_SELECTOR).forEach(element => {
      const text = element.textContent?.trim() ?? "";
      if (text && text !== INITIAL_GREETING) spokenNodesRef.current.add(element);
    });

    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "characterData") {
          scanNode(record.target);
          continue;
        }
        record.addedNodes.forEach(scanNode);
        if (record.target instanceof Element && record.target.matches(ASSISTANT_BUBBLE_SELECTOR)) {
          speakBubble(record.target);
        }
      }
    });
    observer.observe(document.getElementById("root") ?? document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", primeFromGesture, true);
      document.removeEventListener("touchstart", primeFromGesture, true);
      document.removeEventListener("keydown", primeFromGesture, true);
      document.removeEventListener("click", replayFromClick, true);
      queue.cancel();
      stopIOSMediaChannelSoon(0);
    };
  }, []);

  return null;
}
