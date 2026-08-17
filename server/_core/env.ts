const BIBLE_FRIEND_GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // Bible Friend intentionally stays on Gemini 2.5 Flash TTS for the current voice pipeline.
  // Pinning prevents a stale Vercel GEMINI_TTS_MODEL value from silently switching providers.
  geminiTtsModel: BIBLE_FRIEND_GEMINI_TTS_MODEL,
  geminiTtsTimeoutMs: Number(process.env.GEMINI_TTS_TIMEOUT_MS ?? 30_000),
  geminiTtsHardTimeoutMs: Number(process.env.GEMINI_TTS_HARD_TIMEOUT_MS ?? 30_000),
};
