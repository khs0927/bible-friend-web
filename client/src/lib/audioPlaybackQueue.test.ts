import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioPlaybackQueue } from "./audioPlaybackQueue";

class MockAudioContext {
  destination = {};
  async resume() {}
  async decodeAudioData() {
    return { duration: 0.1 } as AudioBuffer;
  }
  createBufferSource() {
    const source = {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      start: () => setTimeout(() => source.onended?.(), 0),
      onended: undefined as (() => void) | undefined,
    };
    return source as unknown as AudioBufferSourceNode;
  }
}

class MockAudio extends EventTarget {
  static instances: MockAudio[] = [];
  readonly url: string;
  playCalledAt = 0;

  constructor(url: string) {
    super();
    this.url = url;
    MockAudio.instances.push(this);
  }

  play() {
    this.playCalledAt = Date.now();
    setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
    return Promise.resolve();
  }

  pause() {}
}

describe("AudioPlaybackQueue", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockAudio.instances = [];
  });

  it("uses Web Audio for server WAV data when AudioContext is available", async () => {
    const playbackStarted = vi.fn();
    const playbackFinished = vi.fn();
    const bytes = Buffer.from([82, 73, 70, 70]);

    vi.stubGlobal("window", { AudioContext: MockAudioContext, speechSynthesis: { cancel: vi.fn(), speak: vi.fn() } });
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("atob", (value: string) => Buffer.from(value, "base64").toString("binary"));

    const queue = new AudioPlaybackQueue(
      { mutateAsync: async () => ({ success: true, audioBase64: bytes.toString("base64"), mimeType: "audio/wav", provider: "gemini" }) },
      { onPlaybackStarted: playbackStarted, onPlaybackFinished: playbackFinished },
    );
    queue.enqueue({ text: "Web Audio로 재생해요.", speaker: "NARRATOR" });
    await new Promise(resolve => setTimeout(resolve, 25));

    expect(playbackStarted).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini" }));
    expect(playbackFinished).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini" }));
    expect(MockAudio.instances).toHaveLength(0);
  });

  it("falls back to Web Speech and reports the server TTS error", async () => {
    const playbackStarted = vi.fn();
    const playbackFinished = vi.fn();
    const playbackError = vi.fn();
    const utterances: any[] = [];
    class MockUtterance {
      lang = "";
      rate = 1;
      pitch = 1;
      onstart?: () => void;
      onend?: () => void;
      onerror?: (event: { error: string }) => void;
      constructor(public readonly text: string) { utterances.push(this); }
    }

    vi.stubGlobal("window", {
      speechSynthesis: {
        cancel: vi.fn(),
        speak: (utterance: MockUtterance) => {
          utterance.onstart?.();
          setTimeout(() => utterance.onend?.(), 0);
        },
      },
    });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const queue = new AudioPlaybackQueue(
      { mutateAsync: async () => ({ success: false, errorCode: "rate_limit", error: "오늘 음성 사용량을 쉬어 가고 있어요." }) },
      { onPlaybackStarted: playbackStarted, onPlaybackFinished: playbackFinished, onPlaybackError: playbackError },
    );
    queue.enqueue({ text: "브라우저 음성으로 이어서 말해요.", speaker: "CHILD_FRIEND" });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(utterances).toHaveLength(1);
    expect(playbackError).toHaveBeenCalledWith(expect.objectContaining({ code: "rate_limit", provider: "server" }));
    expect(playbackStarted).toHaveBeenCalledWith(expect.objectContaining({ provider: "browser" }));
    expect(playbackFinished).toHaveBeenCalledWith(expect.objectContaining({ provider: "browser" }));
  });

  it("reports a browser synthesis-failed event instead of silently swallowing it", async () => {
    const playbackError = vi.fn();
    class MockUtterance {
      onerror?: (event: { error: string }) => void;
      onstart?: () => void;
      onend?: () => void;
      lang = "";
      rate = 1;
      pitch = 1;
    }
    vi.stubGlobal("window", {
      speechSynthesis: {
        cancel: vi.fn(),
        speak: (utterance: MockUtterance) => setTimeout(() => utterance.onerror?.({ error: "synthesis-failed" }), 0),
      },
    });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const queue = new AudioPlaybackQueue(
      { mutateAsync: async () => ({ success: false, errorCode: "rate_limit", error: "오늘 음성 사용량을 쉬어 가고 있어요." }) },
      { onPlaybackError: playbackError },
    );
    queue.enqueue({ text: "음성 엔진 오류를 확인해요.", speaker: "CHILD_FRIEND" });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(playbackError).toHaveBeenCalledWith(expect.objectContaining({ code: "synthesis-failed", provider: "browser" }));
  });

  it("measures first playable audio separately from server synthesis latency", async () => {
    const requestStartedAt = Date.now();
    const playbackStarted: Array<{ provider: string; startedAt: number }> = [];
    const playbackFinished: Array<{ provider: string; finishedAt: number }> = [];
    const bytes = Buffer.from([82, 73, 70, 70]);

    vi.stubGlobal("window", { speechSynthesis: { cancel: vi.fn(), speak: vi.fn() } });
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("atob", (value: string) => Buffer.from(value, "base64").toString("binary"));

    const queue = new AudioPlaybackQueue(
      {
        mutateAsync: async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            success: true,
            audioBase64: bytes.toString("base64"),
            mimeType: "audio/wav",
            provider: "gemini",
          };
        },
      },
      {
        onPlaybackStarted: info => playbackStarted.push(info),
        onPlaybackFinished: info => playbackFinished.push(info),
      },
    );

    queue.enqueue({ text: "첫 문장이 준비되었어요.", speaker: "NARRATOR" });
    await new Promise(resolve => setTimeout(resolve, 40));

    expect(MockAudio.instances).toHaveLength(1);
    expect(playbackStarted).toHaveLength(1);
    expect(playbackFinished).toHaveLength(1);
    expect(playbackStarted[0]?.provider).toBe("gemini");
    expect(playbackStarted[0]!.startedAt).toBeGreaterThanOrEqual(requestStartedAt + 10);
    expect(playbackFinished[0]!.finishedAt).toBeGreaterThanOrEqual(playbackStarted[0]!.startedAt);
  });
});
