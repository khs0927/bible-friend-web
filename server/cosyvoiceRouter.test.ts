import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTestContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("tts router", () => {
  it("returns a safe structured response when Gemini is rate limited and CosyVoice is unavailable", async () => {
    const originalUrl = process.env.COSYVOICE_API_URL;
    delete process.env.COSYVOICE_API_URL;
    delete process.env.QWEN3_TTS_API_URL;
    delete process.env.QWEN3_TTS_API_TOKEN;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Resource exhausted" } }), { status: 429 }),
      ),
    );

    const caller = appRouter.createCaller(createTestContext());
    const result = await caller.tts.synthesize({ text: "안녕하세요" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorCode).toBe("rate_limit");
      expect(result.error).not.toContain("Resource exhausted");
      expect(result.fallbackSuggested).toBe(true);
    }

    if (originalUrl) process.env.COSYVOICE_API_URL = originalUrl;
    vi.restoreAllMocks();
  });
});
