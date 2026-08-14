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

  it("reports the server TTS error without silently switching to mechanical speech", async () => {
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

    expect(utterances).toHaveLength(0);
    expect(playbackError).toHaveBeenCalledWith(expect.objectContaining({ code: "rate_limit", provider: "server" }));
    expect(playbackStarted).not.toHaveBeenCalled();
    expect(playbackFinished).not.toHaveBeenCalled();
  });

  it("starts browser speech immediately from a speaker tap even when voices are initially empty", async () => {
    const playbackStarted = vi.fn();
    const utterances: any[] = [];
    class MockUtterance {
      onstart?: () => void;
      onend?: () => void;
      onerror?: (event: { error: string }) => void;
      lang = "";
      rate = 1;
      pitch = 1;
      constructor(public readonly text: string) { utterances.push(this); }
    }
    const speechSynthesis = new EventTarget() as EventTarget & Record<string, any>;
    speechSynthesis.cancel = vi.fn();
    speechSynthesis.getVoices = () => [];
    speechSynthesis.speak = (utterance: MockUtterance) => {
      utterance.onstart?.();
      setTimeout(() => utterance.onend?.(), 0);
    };
    vi.stubGlobal("window", { speechSynthesis });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);

    const queue = new AudioPlaybackQueue(
      { mutateAsync: async () => ({ success: false, errorCode: "rate_limit" }) },
      { onPlaybackStarted: playbackStarted },
    );
    queue.speakBrowserNow({ text: "버튼을 누르면 바로 들려요.", speaker: "CHILD_FRIEND" });

    expect(utterances).toHaveLength(1);
    expect(playbackStarted).toHaveBeenCalledWith(expect.objectContaining({ provider: "browser" }));
  });

  it("does not start browser speech before a slow Gemini server response returns", async () => {
    const playbackStarted = vi.fn();
    const utterances: any[] = [];
    let resolveServer!: (value: any) => void;
    const serverPromise = new Promise(resolve => { resolveServer = resolve; });
    class MockUtterance {
      onerror?: (event: { error: string }) => void;
      onstart?: () => void;
      onend?: () => void;
      lang = "";
      rate = 1;
      pitch = 1;
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
      { mutateAsync: async () => serverPromise },
      { fastFallbackMs: 5, allowBrowserFallback: false, onPlaybackStarted: playbackStarted },
    );
    queue.enqueue({ text: "먼저 바로 들려줄게요.", speaker: "CHILD_FRIEND" });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(utterances).toHaveLength(0);
    expect(playbackStarted).not.toHaveBeenCalled();
    resolveServer({ success: true, audioBase64: "", provider: "gemini" });
  });

  it("retries a late server WAV after the browser speech engine fails", async () => {
    const playbackStarted = vi.fn();
    const playbackError = vi.fn();
    const bytes = Buffer.from([82, 73, 70, 70]);
    const utterances: any[] = [];
    let resolveServer!: (value: any) => void;
    const serverPromise = new Promise(resolve => { resolveServer = resolve; });
    class MockUtterance {
      onerror?: (event: { error: string }) => void;
      onstart?: () => void;
      onend?: () => void;
      lang = "";
      rate = 1;
      pitch = 1;
      constructor(public readonly text: string) { utterances.push(this); }
    }
    vi.stubGlobal("window", {
      speechSynthesis: {
        cancel: vi.fn(),
        speak: (utterance: MockUtterance) => setTimeout(() => utterance.onerror?.({ error: "synthesis-failed" }), 0),
      },
    });
    vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("atob", (value: string) => Buffer.from(value, "base64").toString("binary"));

    const queue = new AudioPlaybackQueue(
      { mutateAsync: async () => serverPromise },
      { fastFallbackMs: 5, allowBrowserFallback: true, onPlaybackStarted: playbackStarted, onPlaybackError: playbackError },
    );
    queue.enqueue({ text: "서버 음성으로 다시 이어 갈게요.", speaker: "CHILD_FRIEND" });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(utterances).toHaveLength(1);
    expect(playbackError).toHaveBeenCalledWith(expect.objectContaining({ code: "synthesis-failed" }));

    resolveServer({ success: true, audioBase64: bytes.toString("base64"), mimeType: "audio/wav", provider: "gemini" });
    await new Promise(resolve => setTimeout(resolve, 25));
    expect(MockAudio.instances).toHaveLength(1);
    expect(playbackStarted).toHaveBeenCalledWith(expect.objectContaining({ provider: "gemini" }));
  });

  it("reports a browser synthesis-failed event when browser fallback is explicitly enabled", async () => {
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
      { allowBrowserFallback: true, onPlaybackError: playbackError },
    );
    queue.enqueue({ text: "음성 엔진 오류를 확인해요.", speaker: "CHILD_FRIEND" });
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(playbackError).toHaveBeenCalledWith(expect.objectContaining({ code: "synthesis-failed", provider: "browser" }));
  });

  it("does not wait forever for late server audio after browser speech is unavailable", async () => {
    const playbackError = vi.fn();
    vi.stubGlobal("window", {
      AudioContext: undefined,
      speechSynthesis: { cancel: vi.fn(), getVoices: () => [], speak: vi.fn() },
    });
    const queue = new AudioPlaybackQueue(
      { mutateAsync: () => new Promise(() => undefined) },
      { fastFallbackMs: 5, lateServerRecoveryMs: 10, allowBrowserFallback: true, onPlaybackError: playbackError },
    );
    queue.enqueue({ text: "늦은 음성 복구를 기다리지 않아요.", speaker: "NARRATOR" });
    await new Promise(resolve => setTimeout(resolve, 35));

    expect(playbackError).toHaveBeenCalledWith(expect.objectContaining({ code: "browser_speech_unavailable" }));
  });

  it("propagates server response timing to first-playable callbacks", async () => {
    const serverResponseAt = Date.now() - 12;
    const onServerResponse = vi.fn();
    const onPlaybackStarted = vi.fn();
    const playbackStarted = onPlaybackStarted;
    const bytes = Buffer.from([82, 73, 70, 70]);
    vi.stubGlobal("window", { AudioContext: MockAudioContext, speechSynthesis: { cancel: vi.fn(), speak: vi.fn() } });
    vi.stubGlobal("Audio", MockAudio);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() });
    vi.stubGlobal("atob", (value: string) => Buffer.from(value, "base64").toString("binary"));

    const queue = new AudioPlaybackQueue(
      { mutateAsync: async () => ({ success: true, audioBase64: bytes.toString("base64"), mimeType: "audio/wav", provider: "gemini", latencyMs: 37, serverResponseAt }) },
      { onServerResponse, onPlaybackStarted },
    );
    queue.enqueue({ text: "서버 완료시각도 함께 기록해요.", speaker: "NARRATOR" });
    await new Promise(resolve => setTimeout(resolve, 25));

    expect(onServerResponse).toHaveBeenCalledWith(expect.objectContaining({ serverResponseAt, latencyMs: 37, success: true }));
    const started = playbackStarted.mock.calls[0]?.[0];
    expect(started).toEqual(expect.objectContaining({ provider: "gemini", serverResponseAt }));
    expect(started.startedAt - started.serverResponseAt).toBeGreaterThanOrEqual(0);
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
