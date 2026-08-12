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

describe("tts router failure handling", () => {
  afterEach(() => {
    delete process.env.COSYVOICE_API_URL;
    vi.restoreAllMocks();
  });

  it("returns a safe error when Gemini and the CosyVoice fallback both fail", async () => {
    process.env.COSYVOICE_API_URL = "http://localhost:50000";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "upstream" }), { status: 503 })));
    mockedAxios.post.mockRejectedValueOnce(new Error("Network connection refused"));

    const result = await appRouter.createCaller(createTestContext()).tts.synthesize({ text: "테스트" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.fallbackSuggested).toBe(true);
    }
  });
});
