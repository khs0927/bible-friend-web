import type { Express } from "express";

export const COMIC_ASSET_KEYS = ["scene1", "scene2"] as const;
const ASSET_KEYS = new Set<string>(COMIC_ASSET_KEYS);
export const APPDEPLOY_STATUS_BASE =
  "https://api-v2.appdeploy.ai/app/bible-friend-asset-bridge-6xd7bg/api/status/";
export const APPDEPLOY_STORAGE_HOST = "appdeployai-v2-storage.s3.us-east-1.amazonaws.com";
const UPSTREAM_TIMEOUT_MS = 8_000;

type AssetStatus = {
  ok?: boolean;
  key?: string;
  path?: string;
  url?: string;
};

export function isAllowedComicAssetKey(key: string): boolean {
  return ASSET_KEYS.has(key);
}

export function buildComicAssetStatusUrl(key: string): string {
  if (!isAllowedComicAssetKey(key)) {
    throw new Error("Unknown comic asset key");
  }
  return `${APPDEPLOY_STATUS_BASE}${encodeURIComponent(key)}`;
}

export function validateComicAssetSignedUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.hostname !== APPDEPLOY_STORAGE_HOST) {
    throw new Error("Unexpected comic asset storage URL");
  }
  return url.toString();
}

export function registerComicAssetProxy(app: Express) {
  app.get("/api/comic-assets/:key", async (req, res) => {
    const key = String(req.params.key ?? "");
    if (!isAllowedComicAssetKey(key)) {
      res.status(404).json({ error: "comic_asset_not_found" });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const upstream = await fetch(buildComicAssetStatusUrl(key), {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });

      if (!upstream.ok) {
        res.status(502).json({ error: "comic_asset_upstream_unavailable" });
        return;
      }

      const status = (await upstream.json()) as AssetStatus;
      if (!status.ok || status.key !== key || typeof status.url !== "string") {
        res.status(502).json({ error: "comic_asset_upstream_invalid" });
        return;
      }

      const signedUrl = validateComicAssetSignedUrl(status.url);
      res.set("Cache-Control", "no-store");
      res.redirect(307, signedUrl);
    } catch (error) {
      const code = error instanceof Error && error.name === "AbortError"
        ? "comic_asset_upstream_timeout"
        : "comic_asset_proxy_failed";
      console.warn(`[ComicAssetProxy] ${key} failed`, error);
      res.status(502).json({ error: code });
    } finally {
      clearTimeout(timeout);
    }
  });
}
