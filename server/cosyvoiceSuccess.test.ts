import { afterEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

function createTestContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("tts router CosyVoice fallback", () => {
  afterEach(() => {
    delete process.env.COSYVOICE_API_URL;
    vi.restoreAllMocks();
  });

  it("returns base64 audio when Gemini fails and CosyVoice succeeds", async () => {
    process.env.COSYVOICE_API_URL = "http://localhost:50000";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "upstream" }), { status: 503 })));
    const dummyBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
    mockedAxios.post.mockResolvedValueOnce({ data: dummyBuffer });

    const result = await appRouter.createCaller(createTestContext()).tts.synthesize({ text: "안녕하세요" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.audioBase64).toBe(Buffer.from(dummyBuffer).toString("base64"));
      expect(result.provider).toBe("cosyvoice");
      expect(result.fallback).toBe(true);
    }
  });
});
