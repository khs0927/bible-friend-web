import { describe, expect, it } from "vitest";
import { synthesizeWithCosyVoice } from "./_core/cosyvoice";

describe("CosyVoice integration", () => {
  it("throws error when COSYVOICE_API_URL is missing", async () => {
    const originalUrl = process.env.COSYVOICE_API_URL;
    delete process.env.COSYVOICE_API_URL;

    await expect(synthesizeWithCosyVoice({ text: "안녕하세요" })).rejects.toThrow(
      "COSYVOICE_API_URL is not configured"
    );

    if (originalUrl) {
      process.env.COSYVOICE_API_URL = originalUrl;
    }
  });
});
