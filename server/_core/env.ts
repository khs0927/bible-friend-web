function textEnv(value: string | undefined, fallback = "") {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function numberEnv(value: string | undefined, fallback: number) {
  const normalized = value?.trim();
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const ENV = {
  appId: textEnv(process.env.VITE_APP_ID),
  cookieSecret: textEnv(process.env.JWT_SECRET),
  databaseUrl: textEnv(process.env.DATABASE_URL),
  oAuthServerUrl: textEnv(process.env.OAUTH_SERVER_URL),
  ownerOpenId: textEnv(process.env.OWNER_OPEN_ID),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: textEnv(process.env.BUILT_IN_FORGE_API_URL),
  forgeApiKey: textEnv(process.env.BUILT_IN_FORGE_API_KEY),
  geminiApiKey: textEnv(process.env.GEMINI_API_KEY),
  geminiTtsModel: textEnv(process.env.GEMINI_TTS_MODEL, "gemini-3.1-flash-tts-preview"),
  geminiTtsTimeoutMs: numberEnv(process.env.GEMINI_TTS_TIMEOUT_MS, 30_000),
  geminiTtsHardTimeoutMs: numberEnv(process.env.GEMINI_TTS_HARD_TIMEOUT_MS, 30_000),
};
