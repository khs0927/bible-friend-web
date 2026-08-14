import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { createContext } from "./_core/context";
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

export default app;
