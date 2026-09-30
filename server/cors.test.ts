import { describe, expect, it } from "vitest";
import { allowedOrigins, applyCors } from "../api/_cors.js";

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 200,
    ended: false,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    end() {
      this.ended = true;
    },
  };
}

describe("app CORS", () => {
  it("allows the Tauri app origin with credentials", () => {
    const res = fakeRes();
    const stop = applyCors({ method: "POST", headers: { origin: "tauri://localhost" } }, res, allowedOrigins(""));
    expect(stop).toBe(false);
    expect(res.headers["access-control-allow-origin"]).toBe("tauri://localhost");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("answers preflight and stops the handler", () => {
    const res = fakeRes();
    const stop = applyCors({ method: "OPTIONS", headers: { origin: "http://tauri.localhost" } }, res, allowedOrigins(""));
    expect(stop).toBe(true);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.headers["access-control-allow-headers"]).toContain("authorization");
  });

  it("ignores unknown origins and accepts configured extras", () => {
    const res = fakeRes();
    expect(applyCors({ method: "OPTIONS", headers: { origin: "https://evil.example" } }, res, allowedOrigins(""))).toBe(false);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(allowedOrigins("https://a.example, https://b.example").has("https://b.example")).toBe(true);
  });
});
