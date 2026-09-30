import { describe, expect, it } from "vitest";
import { apiUrl, resolveApiBase } from "./apiBase";

describe("apiBase", () => {
  it("keeps same-origin paths when no base is configured", () => {
    expect(resolveApiBase(undefined)).toBe("");
    expect(apiUrl("/api/trpc", "")).toBe("/api/trpc");
  });

  it("prefixes the configured server and trims trailing slashes", () => {
    const base = resolveApiBase(" https://bible-friend.vercel.app/ ");
    expect(base).toBe("https://bible-friend.vercel.app");
    expect(apiUrl("/api/voice-tts-stream", base)).toBe("https://bible-friend.vercel.app/api/voice-tts-stream");
    expect(apiUrl("api/trpc", base)).toBe("https://bible-friend.vercel.app/api/trpc");
  });
});
