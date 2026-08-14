import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { createContext } from "../server/_core/context";
import { appRouter } from "../server/routers";

/**
 * Vercel catch-all API entrypoint for the Vite deployment.
 * Requests under /api/* are routed here by Vercel's file-based function routing.
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
    ttsModel: process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

export const config = {
  maxDuration: 60,
};

export default app;
