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

describe("tts router success mock", () => {
  it("returns base64 audio when CosyVoice succeeds", async () => {
    process.env.COSYVOICE_API_URL = "http://localhost:50000";
    const dummyBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
    mockedAxios.post.mockResolvedValueOnce({ data: dummyBuffer });

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tts.synthesize({ text: "안녕하세요" });
    expect(result.success).toBe(true);
    expect(result.audioBase64).toBe(Buffer.from(dummyBuffer).toString("base64"));
  });
});
