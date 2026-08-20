const BIBLE_FRIEND_GEMINI_TTS_MODEL = "gemini-3.1-flash-tts-preview";
const FAST_VOICE_FALLBACK_TIMEOUT_MS = 1_200;

function boundedVoiceTimeout(value: string | undefined) {
  const configured = Number(value ?? FAST_VOICE_FALLBACK_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured <= 0) return FAST_VOICE_FALLBACK_TIMEOUT_MS;
  return Math.min(configured, FAST_VOICE_FALLBACK_TIMEOUT_MS);
}

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
  // Gemini 3.1 is the current preferred expressive TTS model and supports
  // low-latency streaming. Keep the browser fallback available if it is slow
  // or temporarily rate-limited.
  geminiTtsModel: BIBLE_FRIEND_GEMINI_TTS_MODEL,
  geminiTtsTimeoutMs: boundedVoiceTimeout(process.env.GEMINI_TTS_TIMEOUT_MS),
  geminiTtsHardTimeoutMs: boundedVoiceTimeout(process.env.GEMINI_TTS_HARD_TIMEOUT_MS),
};
