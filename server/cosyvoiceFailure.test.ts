import { describe, expect, it, vi } from "vitest";
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
  it("returns success false and error message when CosyVoice server throws error", async () => {
    process.env.COSYVOICE_API_URL = "http://localhost:50000";
    mockedAxios.post.mockRejectedValueOnce(new Error("Network connection refused"));

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tts.synthesize({ text: "테스트" });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
