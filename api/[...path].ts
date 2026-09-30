import "dotenv/config";
import "../server/_core/geminiTtsFetchCompat";
import express, { type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { registerComicAssetProxy } from "../server/_core/comicAssetProxy";
import { createContext } from "../server/_core/context";
import { ENV } from "../server/_core/env";
import { synthesizeSpeech } from "../server/_core/tts";
import { appRouter } from "../server/routers";

const app = express();

app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ limit: "4mb", extended: true }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ ok: true, runtime: "vercel-express" });
});

app.get("/api/voice-health", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    geminiConfigured: Boolean(ENV.geminiApiKey),
    qwen3Configured: Boolean(process.env.QWEN3_TTS_API_URL),
    cosyVoiceConfigured: Boolean(process.env.COSYVOICE_API_URL),
    ttsMode: process.env.BIBLE_FRIEND_TTS_MODE?.trim() || "gemini_only",
    providerChain:
      (process.env.BIBLE_FRIEND_TTS_MODE?.trim() || "gemini_only") === "fallback_chain"
        ? ["gemini", "qwen3", "cosyvoice"]
        : ["gemini"],
    model: ENV.geminiTtsModel,
    timeoutMs: ENV.geminiTtsTimeoutMs,
    hardTimeoutMs: ENV.geminiTtsHardTimeoutMs,
    serverAudioPreferred: true,
    browserFallbackAvailable: false,
  });
});

app.get("/api/voice-probe", async (_req: Request, res: Response) => {
  const startedAt = Date.now();
  const result = await synthesizeSpeech({
    text: "안녕! 나는 성경 친구야. 오늘 마음에 떠오르는 질문이 있니? 🌈",
    speaker: "CHILD_FRIEND",
    emotion: "밝고 친근한 목소리",
  });
  const summary = result.success
    ? {
        success: true,
        provider: result.provider,
        model: result.model,
        voice: result.voice,
        latencyMs: result.latencyMs,
        cached: result.cached,
        audioBytesApprox: Math.floor((result.audioBase64.length * 3) / 4),
      }
    : {
        success: false,
        provider: result.provider,
        errorCode: result.errorCode,
        error: result.error,
      };
  res.status(200).json({
    ok: result.success,
    totalMs: Date.now() - startedAt,
    timeoutMs: ENV.geminiTtsTimeoutMs,
    hardTimeoutMs: ENV.geminiTtsHardTimeoutMs,
    result: summary,
  });
});

registerComicAssetProxy(app);
registerStorageProxy(app);
registerOAuthRoutes(app);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

function restoreRewrittenPath(req: Request) {
  const rawPath = (req.query as Record<string, unknown> | undefined)?.path;
  const routePath = Array.isArray(rawPath)
    ? rawPath.map(String).join("/")
    : typeof rawPath === "string"
      ? rawPath
      : undefined;

  if (!routePath) return;

  const incoming = new URL(req.url ?? "/", "http://localhost");
  incoming.searchParams.delete("path");
  const query = incoming.searchParams.toString();
  req.url = `/api/${routePath}${query ? `?${query}` : ""}`;
}

export default function handler(req: Request, res: Response) {
  restoreRewrittenPath(req);
  return app(req, res);
}
