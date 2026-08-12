import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioPlaybackQueue } from "./audioPlaybackQueue";

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
