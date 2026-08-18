import { describe, expect, it } from "vitest";
import { ai3dObjectKey, resolveAi3dProvider, validateGlb } from "./orchestrator";

describe("AI-3D orchestration", () => {
  it("prefers an open-source remote worker over a hosted provider", () => {
    expect(resolveAi3dProvider({ AI3D_WORKER_URL: "https://worker.example.test", TRIPO_API_KEY: "paid-fallback" })).toBe("remote-worker");
    expect(resolveAi3dProvider({ TRIPO_API_KEY: "fallback" })).toBe("tripo");
  });

  it("rejects configuration with no available provider", () => {
    expect(() => resolveAi3dProvider({})).toThrow(/No AI-3D provider configured/);
  });

  it("validates a minimal glTF 2 binary header", () => {
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0, 0, 0, 0x0c, 0, 0, 0]);
    expect(validateGlb(bytes)).toEqual({ version: 2, declaredLength: 12 });
    expect(() => validateGlb(new Uint8Array(12))).toThrow(/not a GLB/);
  });

  it("creates stable sanitized storage keys", () => {
    expect(ai3dObjectKey("character/Bible Friend Base")).toBe("growth/3d/character/bible-friend-base.glb");
    expect(ai3dObjectKey("equipment/shield_faith/lv5")).toBe("growth/3d/equipment/shield_faith/lv5.glb");
  });
});
