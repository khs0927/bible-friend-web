import { afterEach, describe, expect, it, vi } from "vitest";
import { Qwen3TTSProvider, resolveVoice } from "./_core/tts";

const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(64)]);

describe("Qwen3-TTS provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.QWEN3_TTS_API_URL;
    delete process.env.QWEN3_TTS_API_TOKEN;
    delete process.env.QWEN3_TTS_SPEAKER;
  });

  it("sends Korean expressive instructions to the self-hosted service", async () => {
    process.env.QWEN3_TTS_API_URL = "https://qwen3.example.test";
    process.env.QWEN3_TTS_API_TOKEN = "test-token";
    process.env.QWEN3_TTS_SPEAKER = "Sohee";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(wav, { status: 200, headers: { "content-type": "audio/wav" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new Qwen3TTSProvider();
    const request = {
      text: "하나님은 언제나 네 곁에 계셔.",
      speaker: "CHILD_FRIEND" as const,
      emotion: "기쁘고 따뜻한 격려",
    };
    const result = await provider.synthesize(request, resolveVoice(request));

    expect(result.provider).toBe("qwen3");
    expect(result.voice).toBe("Sohee");
    expect(result.audio.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://qwen3.example.test/tts");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-token");
    const body = JSON.parse(String(init.body));
    expect(body.language).toBe("Korean");
    expect(body.speaker).toBe("Sohee");
    expect(body.instruct).toContain("기쁘고 따뜻한 격려");
  });
});
