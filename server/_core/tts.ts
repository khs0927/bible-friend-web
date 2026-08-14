import { createHash } from "node:crypto";
import { synthesizeWithCosyVoice } from "./cosyvoice";
import { ENV } from "./env";

export type BibleSpeaker =
  | "NARRATOR"
  | "JESUS"
  | "DAVID"
  | "PETER"
  | "MARY"
  | "CHILD_FRIEND"
  | "GENERAL_MALE"
  | "GENERAL_FEMALE";

export type TTSProviderName = "gemini" | "cosyvoice";
export type TTSFailureCode =
  | "configuration"
  | "invalid_request"
  | "quota"
  | "rate_limit"
  | "timeout"
  | "upstream"
  | "unknown";

export type TTSRequest = {
  text: string;
  speaker?: BibleSpeaker;
  emotion?: string;
  style?: string;
  speed?: number;
  context?: string;
  mode?: "sft" | "zero_shot" | "cross_lingual" | "instruct";
  instructText?: string;
};

export type TTSResult = {
  audio: Buffer;
  mimeType: "audio/wav";
  provider: TTSProviderName;
  model: string;
  voice: string;
  latencyMs: number;
  cached: boolean;
};

export type TTSFailure = {
  code: TTSFailureCode;
  provider: TTSProviderName;
  message: string;
  retryable: boolean;
};

export type TTSResponse =
  | {
      success: true;
      audioBase64: string;
      mimeType: "audio/wav";
      provider: TTSProviderName;
      model: string;
      voice: string;
      latencyMs: number;
      cached: boolean;
      fallback: boolean;
      quotaRemaining: { requests: number; characters: number };
      serverResponseAt: number;
    }
  | {
      success: false;
      provider: TTSProviderName;
      error: string;
      errorCode: TTSFailureCode;
      fallbackSuggested: true;
      quotaRemaining: { requests: number; characters: number };
      serverResponseAt: number;
    };

export type VoiceProfile = {
  voice: string;
  description: string;
  instruction: string;
};

export const VOICE_PROFILES: Record<BibleSpeaker, VoiceProfile> = {
  NARRATOR: {
    voice: "Sulafat",
    description: "Warm",
    instruction: "따뜻한 어린이 오디오북 선생님처럼 차분하고 밝게 말해.",
  },
  JESUS: {
    voice: "Vindemiatrix",
    description: "Gentle",
    instruction: "차분하고 따뜻하며 자비로운 성인처럼 말해. 권위는 있지만 위압적이지 않게 해.",
  },
  DAVID: {
    voice: "Puck",
    description: "Upbeat",
    instruction: "젊고 밝으며 용기 있는 느낌으로 말해. 신앙의 확신은 느껴지되 과장하지 마.",
  },
  PETER: {
    voice: "Fenrir",
    description: "Excitable",
    instruction: "활기차고 인간적인 느낌으로 말해. 놀람과 기쁨 같은 감정 변화를 자연스럽게 표현해.",
  },
  MARY: {
    voice: "Achernar",
    description: "Soft",
    instruction: "부드럽고 포근하며 안정감을 주는 어머니 같은 말투로 말해.",
  },
  CHILD_FRIEND: {
    voice: "Leda",
    description: "Youthful",
    instruction: "밝고 친근하며 호기심 많은 성경 친구처럼 말해.",
  },
  GENERAL_MALE: {
    voice: "Kore",
    description: "Firm",
    instruction: "또렷하고 믿음직하지만 아이에게 편안한 말투로 말해.",
  },
  GENERAL_FEMALE: {
    voice: "Zephyr",
    description: "Bright",
    instruction: "맑고 밝으며 친절한 말투로 말해.",
  },
};

const DEFAULT_SPEAKER: BibleSpeaker = "NARRATOR";
const DEFAULT_MAX_CHARS = 900;
const DEFAULT_DAILY_REQUEST_LIMIT = 80;
const DEFAULT_DAILY_CHARACTER_LIMIT = 20_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 120;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 15_000;
let geminiRateLimitUntil = 0;

function numberEnv(value: string | undefined, fallback: number, min: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export class TTSProviderError extends Error {
  constructor(
    public readonly code: TTSFailureCode,
    public readonly provider: TTSProviderName,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "TTSProviderError";
  }
}

export interface TTSProvider {
  readonly name: TTSProviderName;
  isAvailable(): boolean;
  synthesize(request: TTSRequest, resolved: ResolvedVoice): Promise<TTSResult>;
}

export type ResolvedVoice = VoiceProfile & { speaker: BibleSpeaker; speed: number; prompt: string };

export function resolveVoice(request: TTSRequest): ResolvedVoice {
  const speaker = request.speaker ?? DEFAULT_SPEAKER;
  const profile = VOICE_PROFILES[speaker] ?? VOICE_PROFILES[DEFAULT_SPEAKER];
  const speed = Math.min(1.2, Math.max(0.8, request.speed ?? 1));
  const pace = speed <= 0.92 ? "조금 천천히" : speed >= 1.08 ? "조금 경쾌하게" : "자연스러운 속도로";
  const emotion = request.emotion?.trim() ? `감정은 ${request.emotion.trim()}으로 표현해.` : "감정은 따뜻하고 자연스럽게 표현해.";
  const style = request.style?.trim() ? request.style.trim() : "문장 사이에 짧은 호흡을 두고 중요한 부분은 살짝 강조해.";
  const context = request.context?.trim() ? `이 장면의 맥락은 ${request.context.trim()}이야.` : "";
  const prompt = [
    profile.instruction,
    "6~12세 어린이가 이해하기 쉬운 자연스러운 한국어로 말해.",
    "너무 느리거나 과장된 유아 말투, 연극적인 억양은 사용하지 마.",
    `${pace} 말해.`,
    emotion,
    style,
    context,
    `다음 문장을 뜻을 바꾸지 말고 정확히 읽어 줘:\n${request.text.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { ...profile, speaker, speed, prompt };
}

function makeWavFromPcm(pcm: Buffer, sampleRate = 24_000, channels = 1, bitsPerSample = 16) {
  if (pcm.subarray(0, 4).toString("ascii") === "RIFF") return pcm;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function errorCodeFromStatus(status: number, body: string): TTSFailureCode {
  const lower = body.toLowerCase();
  if (status === 401 || lower.includes("api key") || lower.includes("permission")) return "configuration";
  if (status === 400) return "invalid_request";
  if (status === 408 || lower.includes("timeout")) return "timeout";
  if (status === 429 || lower.includes("rate limit") || lower.includes("resource exhausted")) return "rate_limit";
  if (status === 403 && lower.includes("quota")) return "quota";
  if (status >= 500) return "upstream";
  return "unknown";
}

function safeUpstreamMessage(code: TTSFailureCode) {
  switch (code) {
    case "configuration":
      return "Gemini 음성 연결 설정을 확인하고 있어요.";
    case "invalid_request":
      return "이 문장은 음성으로 준비하기 어려워요. 조금 짧게 다시 말해 볼까요?";
    case "quota":
    case "rate_limit":
      return "오늘 음성 사용량을 잠시 쉬어 가고 있어요. 글로는 계속 이야기할 수 있어요.";
    case "timeout":
      return "Gemini 음성을 준비하는 데 시간이 걸리고 있어요. 잠시 후 다시 눌러 주세요.";
    default:
      return "Gemini 음성을 잠시 준비하지 못했어요. 잠시 후 다시 눌러 주세요.";
  }
}

class GeminiTTSProvider implements TTSProvider {
  readonly name = "gemini" as const;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey ?? ENV.geminiApiKey;
    this.model = options?.model ?? ENV.geminiTtsModel;
    this.timeoutMs = Math.max(250, Math.min(options?.timeoutMs ?? ENV.geminiTtsTimeoutMs, ENV.geminiTtsHardTimeoutMs));
  }

  isAvailable() {
    return Boolean(this.apiKey);
  }

  async synthesize(request: TTSRequest, resolved: ResolvedVoice): Promise<TTSResult> {
    if (!this.isAvailable()) {
      throw new TTSProviderError("configuration", this.name, "GEMINI_API_KEY is not configured");
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify({
          model: this.model,
          input: resolved.prompt,
          response_format: { type: "audio" },
          generation_config: {
            speech_config: [{ voice: resolved.voice }],
          },
        }),
        signal: controller.signal,
      });
      const bodyText = await response.text();
      if (!response.ok) {
        const code = errorCodeFromStatus(response.status, bodyText);
        throw new TTSProviderError(code, this.name, `Gemini TTS returned HTTP ${response.status}`, code === "rate_limit" || code === "upstream");
      }
      let body: any;
      try {
        body = JSON.parse(bodyText);
      } catch {
        throw new TTSProviderError("upstream", this.name, "Gemini TTS returned malformed JSON", true);
      }
      const encoded =
        body?.output_audio?.data ??
        body?.steps
          ?.flatMap((step: any) => (Array.isArray(step?.content) ? step.content : []))
          ?.find((block: any) => typeof block?.data === "string")?.data;
      if (typeof encoded !== "string" || encoded.length === 0) {
        throw new TTSProviderError("upstream", this.name, "Gemini TTS returned no audio data", true);
      }
      const audio = makeWavFromPcm(Buffer.from(encoded, "base64"));
      return {
        audio,
        mimeType: "audio/wav",
        provider: this.name,
        model: this.model,
        voice: resolved.voice,
        latencyMs: Date.now() - startedAt,
        cached: false,
      };
    } catch (error) {
      if (error instanceof TTSProviderError) throw error;
      if ((error as Error)?.name === "AbortError") {
        throw new TTSProviderError("timeout", this.name, "Gemini TTS request timed out", true);
      }
      throw new TTSProviderError("upstream", this.name, "Gemini TTS request failed", true);
    } finally {
      clearTimeout(timeout);
    }
  }
}

class CosyVoiceProvider implements TTSProvider {
  readonly name = "cosyvoice" as const;

  isAvailable() {
    return Boolean(process.env.COSYVOICE_API_URL);
  }

  async synthesize(request: TTSRequest, resolved: ResolvedVoice): Promise<TTSResult> {
    if (!this.isAvailable()) {
      throw new TTSProviderError("configuration", this.name, "COSYVOICE_API_URL is not configured");
    }
    const startedAt = Date.now();
    try {
      const audioData = await synthesizeWithCosyVoice({
        text: request.text,
        mode: request.mode ?? "instruct",
        instruct_text: request.instructText ?? resolved.prompt,
        spk_id: resolved.speaker.toLowerCase(),
      });
      return {
        audio: Buffer.from(audioData),
        mimeType: "audio/wav",
        provider: this.name,
        model: "cosyvoice",
        voice: resolved.speaker,
        latencyMs: Date.now() - startedAt,
        cached: false,
      };
    } catch {
      throw new TTSProviderError("upstream", this.name, "CosyVoice request failed", true);
    }
  }
}

type CacheEntry = { result: TTSResult; expiresAt: number };
const audioCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<TTSResponse>>();
const dailyUsage = new Map<string, { requests: number; characters: number }>();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function limits() {
  return {
    maxChars: numberEnv(process.env.GEMINI_TTS_MAX_CHARS, DEFAULT_MAX_CHARS, 80),
    requests: numberEnv(process.env.GEMINI_TTS_DAILY_REQUESTS, DEFAULT_DAILY_REQUEST_LIMIT, 1),
    characters: numberEnv(process.env.GEMINI_TTS_DAILY_CHARS, DEFAULT_DAILY_CHARACTER_LIMIT, 100),
  };
}

function getUsage() {
  const key = todayKey();
  const usage = dailyUsage.get(key) ?? { requests: 0, characters: 0 };
  dailyUsage.set(key, usage);
  return usage;
}

function remainingQuota() {
  const usage = getUsage();
  const config = limits();
  return {
    requests: Math.max(0, config.requests - usage.requests),
    characters: Math.max(0, config.characters - usage.characters),
  };
}

function cacheKey(request: TTSRequest, resolved: ResolvedVoice) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        text: request.text.trim(),
        speaker: resolved.speaker,
        voice: resolved.voice,
        // The spoken answer is the cache identity. Playback controls may change
        // emotion/style (automatic reply vs. manual replay), but should not spend
        // another Gemini quota unit for the same Korean answer.
        speed: resolved.speed,
        model: ENV.geminiTtsModel,
      }),
    )
    .digest("hex");
}

function getCached(key: string) {
  const cached = audioCache.get(key);
  if (!cached) return undefined;
  if (cached.expiresAt < Date.now()) {
    audioCache.delete(key);
    return undefined;
  }
  return { ...cached.result, cached: true, latencyMs: 0 };
}

function setCached(key: string, result: TTSResult) {
  if (audioCache.size >= CACHE_LIMIT) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  audioCache.set(key, { result: { ...result, cached: false }, expiresAt: Date.now() + CACHE_TTL_MS });
}

function enforceRequest(request: TTSRequest, countAgainstGeminiQuota: boolean) {
  const text = request.text.trim();
  const config = limits();
  if (!text) throw new TTSProviderError("invalid_request", "gemini", "Text is required");
  if (text.length > config.maxChars) {
    throw new TTSProviderError("invalid_request", "gemini", `Text exceeds ${config.maxChars} characters`);
  }
  if (!countAgainstGeminiQuota) return;
  const usage = getUsage();
  if (usage.requests >= config.requests) {
    throw new TTSProviderError("quota", "gemini", "Daily TTS request quota reached");
  }
  if (usage.characters + text.length > config.characters) {
    throw new TTSProviderError("quota", "gemini", "Daily TTS character quota reached");
  }
}

function consumeUsage(text: string) {
  const usage = getUsage();
  usage.requests += 1;
  usage.characters += text.length;
}

export function resetTTSRuntimeState() {
  audioCache.clear();
  inFlightRequests.clear();
  dailyUsage.clear();
  geminiRateLimitUntil = 0;
}

export function getTTSRuntimeStats() {
  return {
    cacheEntries: audioCache.size,
    inFlightRequests: inFlightRequests.size,
    geminiRateLimited: geminiRateLimitUntil > Date.now(),
    quotaRemaining: remainingQuota(),
  };
}

export function synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
  const resolved = resolveVoice({ ...request, text: request.text.trim() });
  const key = cacheKey({ ...request, text: request.text.trim() }, resolved);
  const existing = inFlightRequests.get(key);
  if (existing) return existing;
  const pending = synthesizeSpeechInternal(request).finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, pending);
  return pending;
}

async function synthesizeSpeechInternal(request: TTSRequest): Promise<TTSResponse> {
  const normalized = { ...request, text: request.text.trim() };
  const resolved = resolveVoice(normalized);
  const key = cacheKey(normalized, resolved);
  const cached = getCached(key);
  if (cached) {
    return {
      success: true,
      audioBase64: cached.audio.toString("base64"),
      mimeType: cached.mimeType,
      provider: cached.provider,
      model: cached.model,
      voice: cached.voice,
      latencyMs: 0,
      cached: true,
      fallback: cached.provider !== "gemini",
      quotaRemaining: remainingQuota(),
      serverResponseAt: Date.now(),
    };
  }

  const geminiProvider = new GeminiTTSProvider();
  try {
    enforceRequest(normalized, geminiProvider.isAvailable());
  } catch (error) {
    const failure = error instanceof TTSProviderError ? error : new TTSProviderError("invalid_request", "gemini", "Invalid TTS request");
    return {
      success: false,
      provider: failure.provider,
      error: safeUpstreamMessage(failure.code),
      errorCode: failure.code,
      fallbackSuggested: true,
      quotaRemaining: remainingQuota(),
      serverResponseAt: Date.now(),
    };
  }

  const providers: TTSProvider[] = [geminiProvider, new CosyVoiceProvider()];
  let lastFailure: TTSProviderError | undefined;
  if (Date.now() < geminiRateLimitUntil) {
    lastFailure = new TTSProviderError("rate_limit", "gemini", "Gemini TTS rate limit cooldown is active", true);
  }
  for (const provider of providers) {
    if (!provider.isAvailable()) continue;
    if (provider.name === "gemini" && Date.now() < geminiRateLimitUntil) continue;
    try {
      const result = await provider.synthesize(normalized, resolved);
      if (result.provider === "gemini") consumeUsage(normalized.text);
      setCached(key, result);
      return {
        success: true,
        audioBase64: result.audio.toString("base64"),
        mimeType: result.mimeType,
        provider: result.provider,
        model: result.model,
        voice: result.voice,
        latencyMs: result.latencyMs,
        cached: false,
        fallback: provider.name !== "gemini",
        quotaRemaining: remainingQuota(),
        serverResponseAt: Date.now(),
      };
    } catch (error) {
      lastFailure = error instanceof TTSProviderError ? error : new TTSProviderError("unknown", provider.name, "Provider failed");
      if (provider.name === "gemini" && lastFailure.code === "rate_limit") {
        const cooldownMs = numberEnv(process.env.GEMINI_TTS_RATE_LIMIT_COOLDOWN_MS, DEFAULT_RATE_LIMIT_COOLDOWN_MS, 1_000);
        geminiRateLimitUntil = Date.now() + cooldownMs;
      }
      console.warn(`[TTS] ${provider.name} failed with ${lastFailure.code}`);
    }
  }

  const failureCode = lastFailure?.code ?? "configuration";
  return {
    success: false,
    provider: lastFailure?.provider ?? "gemini",
    error: safeUpstreamMessage(failureCode),
    errorCode: failureCode,
    fallbackSuggested: true,
    quotaRemaining: remainingQuota(),
    serverResponseAt: Date.now(),
  };
}

export function getVoiceProfiles() {
  return Object.entries(VOICE_PROFILES).map(([speaker, profile]) => ({ speaker, ...profile }));
}

export { GeminiTTSProvider, CosyVoiceProvider, makeWavFromPcm };
