import express from "express";
import fs from "node:fs";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./server/_core/oauth";
import { registerStorageProxy } from "./server/_core/storageProxy";
import { createContext } from "./server/_core/context";
import { appRouter } from "./server/routers";

/**
 * Vercel production entrypoint.
 *
 * The Manus/local entrypoint in server/_core/index.ts keeps its existing
 * listen()/Vite-dev behavior. Vercel imports this Express app directly as a
 * serverless function, so no port probing or app.listen() is used here.
 */
const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

registerStorageProxy(app);
registerOAuthRoutes(app);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

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

const publicDir = path.resolve(process.cwd(), "dist", "public");
const indexFile = path.join(publicDir, "index.html");

app.use(
  express.static(publicDir, {
    index: false,
    maxAge: "1h",
  }),
);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (!fs.existsSync(indexFile)) {
    return res.status(503).json({
      error: "frontend_not_built",
      message: "Vite production assets are not available.",
    });
  }
  return res.sendFile(indexFile);
});

export default app;
