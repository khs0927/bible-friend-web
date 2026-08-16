import { describe, expect, it } from "vitest";
import {
  APPDEPLOY_STORAGE_HOST,
  APPDEPLOY_STATUS_BASE,
  buildComicAssetStatusUrl,
  isAllowedComicAssetKey,
  validateComicAssetSignedUrl,
} from "./_core/comicAssetProxy";

describe("comic asset proxy guards", () => {
  it("allows only the approved Noah scene keys", () => {
    expect(isAllowedComicAssetKey("scene1")).toBe(true);
    expect(isAllowedComicAssetKey("scene2")).toBe(true);
    expect(isAllowedComicAssetKey("scene3")).toBe(false);
    expect(isAllowedComicAssetKey("../scene1")).toBe(false);
    expect(isAllowedComicAssetKey("https://example.com/image.png")).toBe(false);
  });

  it("builds status URLs only for allowlisted keys", () => {
    expect(buildComicAssetStatusUrl("scene1")).toBe(`${APPDEPLOY_STATUS_BASE}scene1`);
    expect(() => buildComicAssetStatusUrl("bad-key")).toThrow("Unknown comic asset key");
  });

  it("accepts only HTTPS signed URLs on the exact AppDeploy storage host", () => {
    const valid = `https://${APPDEPLOY_STORAGE_HOST}/asset.png?X-Amz-Signature=test`;
    expect(validateComicAssetSignedUrl(valid)).toBe(valid);

    expect(() => validateComicAssetSignedUrl(`http://${APPDEPLOY_STORAGE_HOST}/asset.png`))
      .toThrow("Unexpected comic asset storage URL");
    expect(() => validateComicAssetSignedUrl("https://example.com/asset.png"))
      .toThrow("Unexpected comic asset storage URL");
    expect(() => validateComicAssetSignedUrl(`https://evil.${APPDEPLOY_STORAGE_HOST}/asset.png`))
      .toThrow("Unexpected comic asset storage URL");
  });
});
