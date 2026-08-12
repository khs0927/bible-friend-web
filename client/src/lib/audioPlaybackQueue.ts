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
};

export class AudioPlaybackQueue {
  private queue: VoiceRequest[] = [];
  private playing = false;
  private currentAudio?: HTMLAudioElement;
  private generation = 0;

  constructor(
    private readonly ttsMutation: TTSMutation,
    private readonly options: AudioPlaybackQueueOptions = {},
  ) {}

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
      if (response.success && response.audioBase64) {
        await this.playServerAudio(next, response.audioBase64, response.mimeType ?? "audio/wav", provider, run);
      } else {
        await this.playBrowserAudio(next, next.speed ?? 0.94, provider, run);
      }
    } catch {
      if (run === this.generation) await this.playBrowserAudio(next, next.speed ?? 0.94, "browser", run);
    } finally {
      if (run === this.generation) {
        this.playing = false;
        void this.flush();
      }
    }
  }

  private async playServerAudio(request: VoiceRequest, base64: string, mimeType: string, provider: string, run: number) {
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const audio = new Audio(url);
    this.currentAudio = audio;
    try {
      const playPromise = audio.play();
      await playPromise;
      if (run === this.generation) {
        this.options.onPlaybackStarted?.({ request, provider, startedAt: Date.now() });
      }
      await new Promise<void>(resolve => {
        const finish = () => resolve();
        audio.addEventListener("ended", finish, { once: true });
        audio.addEventListener("error", finish, { once: true });
        if (run !== this.generation) resolve();
      });
    } finally {
      audio.pause();
      URL.revokeObjectURL(url);
      if (this.currentAudio === audio) this.currentAudio = undefined;
      if (run === this.generation) {
        this.options.onPlaybackFinished?.({ request, provider, finishedAt: Date.now() });
      }
    }
  }

  private playBrowserAudio(request: VoiceRequest, rate: number, provider: string, run: number) {
    return new Promise<void>(resolve => {
      if (run !== this.generation || !("speechSynthesis" in window)) {
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
      utterance.onerror = () => {
        this.options.onPlaybackFinished?.({ request, provider, finishedAt: Date.now() });
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
