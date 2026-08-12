import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GeminiTTSProvider,
  getTTSRuntimeStats,
  makeWavFromPcm,
  resetTTSRuntimeState,
  resolveVoice,
  synthesizeSpeech,
} from "./_core/tts";

const pcm = Buffer.from([0, 0, 16, 0, 32, 0, 48, 0]);

function geminiResponse(status = 200) {
  return new Response(
    status === 200
      ? JSON.stringify({ output_audio: { data: pcm.toString("base64") } })
      : JSON.stringify({ error: { message: "Resource exhausted" } }),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("Gemini TTS provider", () => {
  beforeEach(() => {
    resetTTSRuntimeState();
    process.env.GEMINI_TTS_DAILY_REQUESTS = "2";
    process.env.GEMINI_TTS_DAILY_CHARS = "100";
    process.env.GEMINI_TTS_MAX_CHARS = "900";
    delete process.env.COSYVOICE_API_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.GEMINI_TTS_DAILY_REQUESTS;
    delete process.env.GEMINI_TTS_DAILY_CHARS;
    delete process.env.GEMINI_TTS_MAX_CHARS;
  });

  it("wraps Gemini PCM output as a playable 24kHz WAV", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse());
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeminiTTSProvider({ apiKey: "test-key", model: "test-tts", timeoutMs: 500 });
    const result = await provider.synthesize(
      { text: "안녕!", speaker: "CHILD_FRIEND" },
      resolveVoice({ text: "안녕!", speaker: "CHILD_FRIEND" }),
    );

    expect(result.provider).toBe("gemini");
    expect(result.model).toBe("test-tts");
    expect(result.audio.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(result.audio.readUInt32LE(24)).toBe(24_000);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("maps Bible speakers to a child-safe voice and instruction", () => {
    const voice = resolveVoice({
      text: "하나님은 너를 사랑해.",
      speaker: "JESUS",
      emotion: "평온한 위로",
      speed: 0.9,
    });

    expect(voice.voice).toBe("Vindemiatrix");
    expect(voice.prompt).toContain("차분하고 따뜻하며 자비로운 성인");
    expect(voice.prompt).toContain("조금 천천히");
  });

  it("deduplicates identical in-flight requests and records first-audio latency", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 8));
      return geminiResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      synthesizeSpeech({ text: "동시에 물어본 성경 질문", speaker: "CHILD_FRIEND" }),
      synthesizeSpeech({ text: "동시에 물어본 성경 질문", speaker: "CHILD_FRIEND" }),
    ]);

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getTTSRuntimeStats().quotaRemaining.requests).toBe(1);
    if (first.success) expect(first.latencyMs).toBeGreaterThanOrEqual(8);
  });

  it("reuses identical audio from cache without a second API call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse());
    vi.stubGlobal("fetch", fetchMock);

    const first = await synthesizeSpeech({ text: "안녕, 성경 친구야!", speaker: "CHILD_FRIEND" });
    const second = await synthesizeSpeech({ text: "안녕, 성경 친구야!", speaker: "CHILD_FRIEND" });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (first.success && second.success) {
      expect(first.cached).toBe(false);
      expect(second.cached).toBe(true);
      expect(second.audioBase64).toBe(first.audioBase64);
    }
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getTTSRuntimeStats().quotaRemaining.requests).toBe(1);
  });

  it("returns a safe rate-limit response instead of retrying forever", async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiResponse(429));
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeSpeech({ text: "오늘의 말씀을 들려줘", speaker: "NARRATOR" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("rate_limit");
      expect(result.error).not.toContain("Resource exhausted");
      expect(result.fallbackSuggested).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps an existing WAV unchanged", () => {
    const wav = Buffer.from("RIFFfake-wav");
    expect(makeWavFromPcm(wav)).toBe(wav);
  });
});
