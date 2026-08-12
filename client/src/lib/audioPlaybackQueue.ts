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
  onPlaybackStarted?: (info: { request: VoiceRequest; provider: string; startedAt: number }) => void;
  onPlaybackFinished?: (info: { request: VoiceRequest; provider: string; finishedAt: number }) => void;
  onPlaybackError?: (info: { request: VoiceRequest; provider: string; code: string; message: string }) => void;
};

export class AudioPlaybackQueue {
  private queue: VoiceRequest[] = [];
  private playing = false;
  private currentAudio?: HTMLAudioElement;
  private currentSource?: AudioBufferSourceNode;
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
      void this.audioContext.resume();
    } catch {
      // HTMLAudioElement and Web Speech remain available as fallbacks.
    }
  }

  enqueue(request: VoiceRequest) {
    if (typeof window === "undefined") return;
    this.queue.push({ ...request, text: request.text.trim() });
    void this.flush();
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
      const response = await this.ttsMutation.mutateAsync(next);
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
        await this.playServerAudio(next, response.audioBase64, response.mimeType ?? "audio/wav", provider, run);
      } else {
        await this.playBrowserAudio(next, next.speed ?? 0.94, provider, run);
      }
    } catch (error) {
      if (run === this.generation) {
        this.options.onPlaybackError?.({ request: next, provider: "browser", code: "audio_play_failed", message: error instanceof Error ? error.message : "오디오 재생을 시작하지 못했어요." });
        await this.playBrowserAudio(next, next.speed ?? 0.94, "browser", run);
      }
    } finally {
      if (run === this.generation) {
        this.playing = false;
        void this.flush();
      }
    }
  }

  private async playServerAudio(request: VoiceRequest, base64: string, mimeType: string, provider: string, run: number) {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const webAudioPlayed = await this.playWithWebAudio(request, bytes, provider, run);
    if (webAudioPlayed) return;
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const audio = new Audio(url);
    this.currentAudio = audio;
    let completed = false;
    try {
      const playPromise = audio.play();
      await playPromise;
      if (run === this.generation) {
        this.options.onPlaybackStarted?.({ request, provider, startedAt: Date.now() });
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
        this.options.onPlaybackFinished?.({ request, provider, finishedAt: Date.now() });
      }
    }
  }

  private async playWithWebAudio(request: VoiceRequest, bytes: Uint8Array, provider: string, run: number) {
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
      this.options.onPlaybackStarted?.({ request, provider, startedAt: Date.now() });
      await finished;
      if (run === this.generation) this.options.onPlaybackFinished?.({ request, provider, finishedAt: Date.now() });
      if (this.currentSource === source) this.currentSource = undefined;
      return true;
    } catch {
      this.currentSource = undefined;
      return false;
    }
  }

  private playBrowserAudio(request: VoiceRequest, rate: number, provider: string, run: number) {
    return new Promise<void>(resolve => {
      if (run !== this.generation) {
        resolve();
        return;
      }
      if (!("speechSynthesis" in window)) {
        this.options.onPlaybackError?.({ request, provider, code: "browser_speech_unavailable", message: "이 브라우저에서는 음성 재생을 사용할 수 없어요." });
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.lang = "ko-KR";
      utterance.rate = Math.min(1.05, Math.max(0.86, rate));
      utterance.pitch = 1.18;
      const started = () => {
        this.options.onPlaybackStarted?.({ request, provider, startedAt: Date.now() });
      };
      utterance.onstart = started;
      utterance.onend = () => {
        this.options.onPlaybackFinished?.({ request, provider, finishedAt: Date.now() });
        resolve();
      };
      utterance.onerror = event => {
        const code = event?.error ?? "browser_speech_error";
        this.options.onPlaybackError?.({ request, provider, code, message: "브라우저 음성 엔진이 재생을 시작하지 못했어요." });
        resolve();
      };
      window.speechSynthesis.speak(utterance);
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
