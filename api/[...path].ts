import "dotenv/config";
import "../server/_core/geminiTtsFetchCompat";
import express, { type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { registerComicAssetProxy } from "../server/_core/comicAssetProxy";
import { createContext } from "../server/_core/context";
import { ENV } from "../server/_core/env";
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
    model: ENV.geminiTtsModel,
    serverAudioPreferred: true,
    browserFallbackAvailable: true,
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

export default app;
