import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { createContext } from "./_core/context";
import { ENV } from "./_core/env";
import { synthesizeSpeech } from "./_core/tts";
import { appRouter } from "./routers";

/**
 * Source entry for the Vercel API bundle.
 * `pnpm build:vercel` bundles this file and all local TypeScript modules into
 * `api/[...path].js`, avoiding Vercel runtime module resolution issues.
 */
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerOAuthRoutes(app);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "bible-friend-web",
    runtime: "vercel",
    ttsModel: ENV.geminiTtsModel,
    geminiConfigured: Boolean(ENV.geminiApiKey),
    ttsTimeoutMs: ENV.geminiTtsTimeoutMs,
    ttsHardTimeoutMs: ENV.geminiTtsHardTimeoutMs,
    timestamp: new Date().toISOString(),
  });
});

// Temporary one-shot production smoke endpoint. Remove immediately after verification.
app.get("/api/_tts-smoke-7e552ce", async (_req, res) => {
  const result = await synthesizeSpeech({
    text: "안녕, 성경 친구야! 오늘도 말씀과 함께해요.",
    speaker: "CHILD_FRIEND",
    emotion: "밝고 따뜻함",
  });
  if (result.success) {
    res.status(200).json({
      success: true,
      provider: result.provider,
      model: result.model,
      voice: result.voice,
      latencyMs: result.latencyMs,
      cached: result.cached,
      audioBytesApprox: Math.floor((result.audioBase64.length * 3) / 4),
      quotaRemaining: result.quotaRemaining,
    });
    return;
  }
  res.status(200).json({
    success: false,
    provider: result.provider,
    errorCode: result.errorCode,
    error: result.error,
    quotaRemaining: result.quotaRemaining,
  });
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

export default app;
