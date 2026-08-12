import { describe, expect, it } from "vitest";
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
  it("returns error when COSYVOICE_API_URL is missing", async () => {
    const originalUrl = process.env.COSYVOICE_API_URL;
    delete process.env.COSYVOICE_API_URL;

    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tts.synthesize({ text: "안녕하세요" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("COSYVOICE_API_URL");

    if (originalUrl) {
      process.env.COSYVOICE_API_URL = originalUrl;
    }
  });
});
