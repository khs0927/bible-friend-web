export type VoiceRequest = {
  text: string;
  speaker?: "NARRATOR" | "JESUS" | "DAVID" | "PETER" | "MARY" | "CHILD_FRIEND" | "GENERAL_MALE" | "GENERAL_FEMALE";
  emotion?: string;
  style?: string;
  speed?: number;
  context?: string;
};

export type TTSMutation = { mutateAsync: (input: VoiceRequest) => Promise<any> };

export type AudioPlaybackQueueOptions = {
  onPlaybackStarted?: (info: { request: VoiceRequest; provider: string; startedAt: number; serverResponseAt?: number }) => void;
  onPlaybackFinished?: (info: { request: VoiceRequest; provider: string; finishedAt: number; serverResponseAt?: number }) => void;
  onServerResponse?: (info: { request: VoiceRequest; provider?: string; serverResponseAt: number; observedAt: number; latencyMs?: number; success: boolean; errorCode?: string; errorMessage?: string }) => void;
  onPlaybackError?: (info: { request: VoiceRequest; provider: string; code: string; message: string }) => void;
  /** Start device speech while a slow server TTS request continues warming the cache. */
  fastFallbackMs?: number;
  /** Maximum time to wait for a late server WAV after device speech fails. */
  lateServerRecoveryMs?: number;
  /** Browser speech is opt-in only; Gemini server audio is the default and preferred path. */
  allowBrowserFallback?: boolean;
};

async function waitForSpeechVoices(synthesis: SpeechSynthesis, timeoutMs = 700) {
  if (typeof synthesis.getVoices !== "function") return true;
  if (synthesis.getVoices().length > 0) return true;
  // iOS Safari may expose an empty list before its default voice is ready.
  // Do not reject that state: allow speak() to try the platform default voice.
  if (typeof synthesis.addEventListener !== "function") return true;
  return new Promise<boolean>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      synthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(true);
    };
    const onVoicesChanged = () => finish();
    const timer = setTimeout(() => finish(), timeoutMs);
    synthesis.addEventListener("voiceschanged", onVoicesChanged, { once: true });
  });
}

export class AudioPlaybackQueue {
  private queue: VoiceRequest[] = [];
  private playing = false;
  private currentAudio?: HTMLAudioElement;
  private currentSource?: AudioBufferSourceNode;
  private currentUtterance?: SpeechSynthesisUtterance;
  private audioContext?: AudioContext;
  private generation = 0;

  constructor(
    private readonly ttsMutation: TTSMutation,
    private readonly options: AudioPlaybackQueueOptions = {},
  ) {}

  prime() {
    if (typeof window === "undefined") return;
    const browserWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextCtor) return;
    try {
      this.audioContext ??= new AudioContextCtor();
      void this.audioContext.resume().catch(() => undefined);
    } catch {
      // HTMLAudioElement and Web Speech remain available as fallbacks.
    }
  }

  enqueue(request: VoiceRequest) {
    if (typeof window === "undefined") return;
    this.prime();
    this.queue.push({ ...request, text: request.text.trim() });
    void this.flush();
  }

  speakBrowserNow(request: VoiceRequest) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    this.cancel();
    const run = this.generation;
    this.playing = true;
    void this.playBrowserAudio(request, request.speed ?? 0.94, "browser", run, undefined, false).finally(() => {
      if (run === this.generation) {
        this.playing = false;
        void this.flush();
      }
    });
  }

  cancel() {
    this.generation += 1;
    this.queue = [];
    this.currentAudio?.pause();
    this.currentAudio = undefined;
    try {
      this.currentSource?.stop();
    } catch {
      // The source may already have ended.
    }
    this.currentSource = undefined;
    this.currentUtterance = undefined;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    this.playing = false;
  }

  private async flush() {
    if (this.playing || this.queue.length === 0 || typeof window === "undefined") return;
    this.playing = true;
    const run = this.generation;
    const next = this.queue.shift();
    if (!next) {
      this.playing = false;
      return;
    }
    try {
      const serverPromise = this.ttsMutation.mutateAsync(next);
      void serverPromise.then((response: any) => {
        if (typeof response?.serverResponseAt === "number") {
          this.options.onServerResponse?.({
            request: next,
            provider: response.provider,
            serverResponseAt: response.serverResponseAt,
            observedAt: Date.now(),
            latencyMs: response.latencyMs,
            success: Boolean(response.success),
            errorCode: response.errorCode,
            errorMessage: response.error,
          });
        }
      }).catch(() => undefined);
      const allowBrowserFallback = this.options.allowBrowserFallback === true;
      const configuredFallbackMs = this.options.fastFallbackMs;
      // The home screen historically passed 400ms, which meant Gemini could almost
      // never win the race on a real phone. Keep tiny values usable in node tests,
      // but give natural server audio a fair window in an actual browser.
      const fastFallbackMs = typeof configuredFallbackMs === "number" && typeof document !== "undefined"
        ? Math.max(configuredFallbackMs, 2_600)
        : configuredFallbackMs;
      const race = allowBrowserFallback && typeof fastFallbackMs === "number"
        ? await Promise.race([
            serverPromise,
            new Promise<{ __fastFallback: true }>(resolve => setTimeout(() => resolve({ __fastFallback: true }), fastFallbackMs)),
          ])
        : await serverPromise;
      if ("__fastFallback" in race) {
        // Keep the server request alive so a successful response can populate its cache.
        void serverPromise.catch(() => undefined);
        if (run === this.generation) {
          const browserPlayed = await this.playBrowserAudio(next, next.speed ?? 0.94, "browser", run);
          if (!browserPlayed) {
            const recoveryMs = this.options.lateServerRecoveryMs ?? 6_000;
            const lateResponse = await Promise.race([
              serverPromise,
              new Promise<{ __lateRecoveryTimeout: true }>(resolve => setTimeout(() => resolve({ __lateRecoveryTimeout: true }), recoveryMs)),
            ]).catch(() => ({ __lateRecoveryTimeout: true as const }));
            if (!("__lateRecoveryTimeout" in lateResponse) && run === this.generation && lateResponse.success && lateResponse.audioBase64) {
              await this.playServerAudio(next, lateResponse.audioBase64, lateResponse.mimeType ?? "audio/wav", lateResponse.provider ?? "server", run, lateResponse.serverResponseAt);
            }
          }
        }
        return;
      }
      const response = race;
      if (run !== this.generation) return;
      const provider = response.success ? response.provider ?? "server" : "browser";
      if (!response.success) {
        this.options.onPlaybackError?.({
          request: next,
          provider: "server",
          code: response.errorCode ?? "tts_unavailable",
          message: response.error ?? "서버 음성을 준비하지 못했어요.",
        });
      }
      if (response.success && response.audioBase64) {
        await this.playServerAudio(next, response.audioBase64, response.mimeType ?? "audio/wav", provider, run, response.serverResponseAt);
      } else if (allowBrowserFallback) {
        await this.playBrowserAudio(next, next.speed ?? 0.94, "browser", run);
      }
    } catch (error) {
      if (run === this.generation) {
        this.options.onPlaybackError?.({ request: next, provider: "gemini", code: "audio_play_failed", message: error instanceof Error ? error.message : "오디오 재생을 시작하지 못했어요." });
        if (this.options.allowBrowserFallback === true) {
          await this.playBrowserAudio(next, next.speed ?? 0.94, "browser", run);
        }
      }
    } finally {
      if (run === this.generation) {
        this.playing = false;
        void this.flush();
      }
    }
  }

  private async playServerAudio(request: VoiceRequest, base64: string, mimeType: string, provider: string, run: number, serverResponseAt?: number) {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const webAudioPlayed = await this.playWithWebAudio(request, bytes, provider, run, serverResponseAt);
    if (webAudioPlayed) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const audio = new Audio(url);
    audio.preload = "auto";
    this.currentAudio = audio;
    let completed = false;
    try {
      await audio.play();
      if (run === this.generation) {
        this.options.onPlaybackStarted?.({ request, provider, startedAt: Date.now(), serverResponseAt });
      }
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener("ended", () => { completed = true; resolve(); }, { once: true });
        audio.addEventListener("error", () => reject(new Error("audio_element_error")), { once: true });
        if (run !== this.generation) resolve();
      });
    } finally {
      audio.pause();
      URL.revokeObjectURL(url);
      if (this.currentAudio === audio) this.currentAudio = undefined;
      if (run === this.generation && completed) {
        this.options.onPlaybackFinished?.({ request, provider, finishedAt: Date.now(), serverResponseAt });
      }
    }
  }

  private async playWithWebAudio(request: VoiceRequest, bytes: Uint8Array, provider: string, run: number, serverResponseAt?: number) {
    if (typeof window === "undefined") return false;
    const browserWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextCtor) return false;
    try {
      this.audioContext ??= new AudioContextCtor();
      await this.audioContext.resume();
      if (run !== this.generation) return true;
      const audioBuffer = await this.audioContext.decodeAudioData(bytes.slice().buffer);
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      this.currentSource = source;
      const finished = new Promise<void>(resolve => {
        source.onended = () => resolve();
      });
      source.start();
      this.options.onPlaybackStarted?.({ request, provider, startedAt: Date.now(), serverResponseAt });
      await finished;
      if (run === this.generation) this.options.onPlaybackFinished?.({ request, provider, finishedAt: Date.now(), serverResponseAt });
      if (this.currentSource === source) this.currentSource = undefined;
      return true;
    } catch {
      this.currentSource = undefined;
      return false;
    }
  }

  private playBrowserAudio(request: VoiceRequest, rate: number, provider: string, run: number, serverResponseAt?: number, waitForVoices = true) {
    return new Promise<boolean>(resolve => {
      if (run !== this.generation) {
        resolve(false);
        return;
      }
      if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        this.options.onPlaybackError?.({ request, provider, code: "browser_speech_unavailable", message: "이 기기에서는 음성 엔진을 사용할 수 없어요. 잠시 후 다시 눌러 주세요." });
        resolve(false);
        return;
      }
      const startSpeech = () => {
        if (run !== this.generation) {
          resolve(false);
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(request.text);
        this.currentUtterance = utterance;
        utterance.lang = "ko-KR";
        utterance.rate = Math.min(1.05, Math.max(0.86, rate));
        utterance.pitch = 1.12;
        utterance.volume = 1;
        const voices = typeof window.speechSynthesis.getVoices === "function" ? window.speechSynthesis.getVoices() : [];
        const koreanVoice = voices.find(voice => voice.lang.toLowerCase() === "ko-kr")
          ?? voices.find(voice => voice.lang.toLowerCase().startsWith("ko"));
        if (koreanVoice) utterance.voice = koreanVoice;
        utterance.onstart = () => {
          this.options.onPlaybackStarted?.({ request, provider, startedAt: Date.now(), serverResponseAt });
        };
        utterance.onend = () => {
          if (this.currentUtterance === utterance) this.currentUtterance = undefined;
          if (run === this.generation) {
            this.options.onPlaybackFinished?.({ request, provider, finishedAt: Date.now(), serverResponseAt });
          }
          resolve(true);
        };
        utterance.onerror = event => {
          if (this.currentUtterance === utterance) this.currentUtterance = undefined;
          const code = event?.error ?? "browser_speech_error";
          if (run !== this.generation || code === "canceled" || code === "interrupted") {
            resolve(false);
            return;
          }
          this.options.onPlaybackError?.({ request, provider, code, message: "브라우저 음성 엔진이 재생을 시작하지 못했어요." });
          resolve(false);
        };
        try {
          window.speechSynthesis.resume?.();
        } catch {
          // Some WebViews do not expose a working resume method.
        }
        window.speechSynthesis.speak(utterance);
      };
      if (waitForVoices) {
        void waitForSpeechVoices(window.speechSynthesis).then(startSpeech);
      } else {
        startSpeech();
      }
    });
  }
}

export function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}
