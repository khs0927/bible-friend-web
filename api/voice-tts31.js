const PRIMARY_MODEL = "gemini-3.1-flash-tts-preview";
const FALLBACK_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_HOST = "https://generativelanguage.googleapis.com";
const OPEN_TTS_GATEWAY_URL = (process.env.OPEN_TTS_GATEWAY_URL || "").trim().replace(/\/$/, "");
const OPEN_TTS_GATEWAY_TOKEN = (process.env.OPEN_TTS_GATEWAY_TOKEN || "").trim();
const OPEN_TTS_GATEWAY_TIMEOUT_MS = Math.max(
  2000,
  Math.min(Number(process.env.OPEN_TTS_GATEWAY_TIMEOUT_MS || 12000), 30000),
);
const MAX_TEXT_CHARS = 900;
const PRIMARY_TIMEOUT_MS = 9_000;
const FALLBACK_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 24;

const VOICES = {
  NARRATOR: "Sulafat",
  JESUS: "Vindemiatrix",
  DAVID: "Puck",
  PETER: "Fenrir",
  MARY: "Achernar",
  CHILD_FRIEND: "Leda",
  GENERAL_MALE: "Kore",
  GENERAL_FEMALE: "Zephyr",
};

const resultCache = new Map();
const inFlight = new Map();

function makeWavFromPcm(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
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

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw.trim() ? JSON.parse(raw) : {};
}

function extractVoiceInput(body) {
  const batchEntry = body?.["0"];
  const input = batchEntry?.json ?? batchEntry ?? body?.json ?? body ?? {};
  return {
    text: typeof input.text === "string" ? input.text.trim() : "",
    speaker: typeof input.speaker === "string" ? input.speaker : "CHILD_FRIEND",
    emotion: typeof input.emotion === "string" ? input.emotion.trim() : "",
    style: typeof input.style === "string" ? input.style.trim() : "",
    speed: typeof input.speed === "number" ? input.speed : 1,
    context: typeof input.context === "string" ? input.context.trim() : "",
  };
}

function buildPrompt(input) {
  const pace = input.speed <= 0.92 ? "조금 천천히" : input.speed >= 1.08 ? "조금 경쾌하게" : "자연스러운 속도로";
  return [
    "음성 합성 요청입니다. 아래 '낭독할 본문'만 실제 음성으로 합성하고, 지시문 자체는 읽지 마세요.",
    "밝고 친근하며 따뜻한 성경 친구처럼 말해 주세요.",
    "6~12세 어린이가 이해하기 쉬운 자연스러운 한국어 발음으로 말해 주세요.",
    "너무 느리거나 과장된 유아 말투는 피하고, 또렷하고 편안하게 말해 주세요.",
    `${pace} 말해 주세요.`,
    input.emotion ? `감정은 ${input.emotion}으로 표현해 주세요.` : "감정은 따뜻하고 자연스럽게 표현해 주세요.",
    input.style || "문장 사이에 자연스러운 호흡을 두고 중요한 부분은 살짝 강조해 주세요.",
    input.context ? `맥락: ${input.context}` : "",
    "낭독할 본문:",
    input.text,
  ].filter(Boolean).join("\n");
}

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  return fetch(url, { ...options, signal: controller.signal })
    .then(response => ({ response, elapsedMs: Date.now() - startedAt }))
    .finally(() => clearTimeout(timer));
}

function extractInteractionAudio(body) {
  if (typeof body?.output_audio?.data === "string") return body.output_audio.data;
  for (const step of Array.isArray(body?.steps) ? body.steps : []) {
    for (const block of Array.isArray(step?.content) ? step.content : []) {
      if (typeof block?.data === "string" && (block?.type === "audio" || !block?.type)) return block.data;
    }
  }
}

function extractGenerateContentAudio(body) {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  for (const part of parts) {
    const data = part?.inlineData?.data ?? part?.inline_data?.data;
    if (typeof data === "string" && data.length > 0) return data;
  }
}

async function synthesize31Once({ apiKey, prompt, voice }) {
  const { response, elapsedMs } = await fetchWithTimeout(`${GEMINI_HOST}/v1beta/interactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      "Api-Revision": "2026-05-20",
    },
    body: JSON.stringify({
      model: PRIMARY_MODEL,
      input: prompt,
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    }),
  }, PRIMARY_TIMEOUT_MS);

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`gemini31_http_${response.status}`);
    error.status = response.status;
    throw error;
  }
  let body;
  try { body = JSON.parse(text); } catch { throw new Error("gemini31_bad_json"); }
  const encoded = extractInteractionAudio(body);
  if (!encoded) throw new Error("gemini31_no_audio");
  return { encoded, model: PRIMARY_MODEL, latencyMs: elapsedMs };
}

async function synthesize31({ apiKey, prompt, voice, attempts, retryPreview = true }) {
  for (let retry = 0; retry < 2; retry += 1) {
    const startedAt = Date.now();
    try {
      const result = await synthesize31Once({ apiKey, prompt, voice });
      attempts.push({ model: PRIMARY_MODEL, ok: true, ms: Date.now() - startedAt, retry });
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      attempts.push({ model: PRIMARY_MODEL, ok: false, ms: Date.now() - startedAt, retry, reason });
      const status = Number(error?.status ?? 0);
      const retryablePreviewGlitch = retryPreview && retry === 0 && (status === 500 || reason === "gemini31_no_audio" || reason === "gemini31_bad_json");
      if (!retryablePreviewGlitch) throw error;
      await new Promise(resolve => setTimeout(resolve, 120));
    }
  }
  throw new Error("gemini31_retry_exhausted");
}

async function synthesize25({ apiKey, prompt, voice, attempts }) {
  const startedAt = Date.now();
  try {
    const url = `${GEMINI_HOST}/v1beta/models/${encodeURIComponent(FALLBACK_MODEL)}:generateContent`;
    const { response, elapsedMs } = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    }, FALLBACK_TIMEOUT_MS);
    const text = await response.text();
    if (!response.ok) throw new Error(`gemini25_http_${response.status}`);
    let body;
    try { body = JSON.parse(text); } catch { throw new Error("gemini25_bad_json"); }
    const encoded = extractGenerateContentAudio(body);
    if (!encoded) throw new Error("gemini25_no_audio");
    attempts.push({ model: FALLBACK_MODEL, ok: true, ms: Date.now() - startedAt });
    return { encoded, model: FALLBACK_MODEL, latencyMs: elapsedMs };
  } catch (error) {
    attempts.push({ model: FALLBACK_MODEL, ok: false, ms: Date.now() - startedAt, reason: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}


async function synthesizeOpenGateway({ input, attempts }) {
  if (!OPEN_TTS_GATEWAY_URL) throw new Error("open_tts_gateway_not_configured");

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPEN_TTS_GATEWAY_TIMEOUT_MS);
  try {
    const response = await fetch(`${OPEN_TTS_GATEWAY_URL}/api/voice/speech`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "audio/wav, audio/mpeg, audio/ogg, audio/*",
        ...(OPEN_TTS_GATEWAY_TOKEN
          ? { authorization: `Bearer ${OPEN_TTS_GATEWAY_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        text: input.text,
        speaker: input.speaker === "CHILD_FRIEND" ? "Sohee" : "Sohee",
        language: "Korean",
        emotion: input.emotion,
        style: input.style,
        context: input.context,
        speed: input.speed,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`open_tts_gateway_http_${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 44) throw new Error("open_tts_gateway_invalid_audio");

    const model =
      response.headers.get("x-bible-friend-tts-model") ||
      response.headers.get("x-bible-friend-tts-provider") ||
      "qwen3-tts";
    attempts.push({
      model,
      provider: "open-source",
      ok: true,
      ms: Date.now() - startedAt,
      endpoint: response.headers.get("x-bible-friend-tts-endpoint") || undefined,
      cache: response.headers.get("x-bible-friend-tts-cache") || undefined,
    });
    return {
      bytes,
      mimeType: response.headers.get("content-type") || "audio/wav",
      model,
      provider: "qwen3",
    };
  } catch (error) {
    attempts.push({
      model: "qwen3-tts",
      provider: "open-source",
      ok: false,
      ms: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : "unknown",
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function probeOpenGateway(input) {
  const attempts = [];
  try {
    const result = await synthesizeOpenGateway({ input, attempts });
    return {
      success: true,
      provider: result.provider,
      model: result.model,
      voice: "Sohee",
      audioBase64: result.bytes.toString("base64"),
      latencyMs: attempts.at(-1)?.ms,
      cached: attempts.at(-1)?.cache === "HIT",
      fallback: false,
      costMode: "open-source-free-pool",
      attempts,
    };
  } catch {
    return { success: false, errorCode: "open_source_probe_failed", attempts };
  }
}

function cacheKey(input) {
  return JSON.stringify([input.text, input.speaker, input.emotion, input.style, input.speed, input.context]);
}

function getCached(key) {
  const hit = resultCache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    resultCache.delete(key);
    return undefined;
  }
  resultCache.delete(key);
  resultCache.set(key, hit);
  return { ...hit.result, cached: true, serverResponseAt: Date.now() };
}

function putCached(key, result) {
  resultCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  while (resultCache.size > CACHE_LIMIT) {
    const oldest = resultCache.keys().next().value;
    if (oldest === undefined) break;
    resultCache.delete(oldest);
  }
}

async function synthesizeUncached(input) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!input.text) return { success: false, provider: "gemini", errorCode: "invalid_request", error: "읽어 줄 문장이 없어요.", fallbackSuggested: true, serverResponseAt: Date.now(), attempts: [] };
  if (input.text.length > MAX_TEXT_CHARS) return { success: false, provider: "gemini", errorCode: "invalid_request", error: "문장이 너무 길어요. 조금 나누어 말해 주세요.", fallbackSuggested: true, serverResponseAt: Date.now(), attempts: [] };

  const voice = VOICES[input.speaker] || VOICES.CHILD_FRIEND;
  const prompt = buildPrompt(input);
  const attempts = [];
  const totalStartedAt = Date.now();

  if (OPEN_TTS_GATEWAY_URL) {
    try {
      const result = await synthesizeOpenGateway({ input, attempts });
      console.info("[VOICE31_DIRECT] Qwen primary success", {
        model: result.model,
        totalMs: Date.now() - totalStartedAt,
        bytes: result.bytes.length,
        attempts,
      });
      return {
        success: true,
        audioBase64: result.bytes.toString("base64"),
        mimeType: result.mimeType,
        provider: result.provider,
        model: result.model,
        voice: "Sohee",
        latencyMs: Date.now() - totalStartedAt,
        cached: attempts.at(-1)?.cache === "HIT",
        fallback: false,
        costMode: "open-source-free-pool",
        serverResponseAt: Date.now(),
        attempts,
      };
    } catch (error) {
      console.warn("[VOICE31_DIRECT] Qwen primary failed", {
        reason: error instanceof Error ? error.message : String(error),
        attempts,
      });
    }
  }

  if (apiKey) {
    try {
      const result = await synthesize31({ apiKey, prompt, voice, attempts, retryPreview: false });
    const wav = makeWavFromPcm(Buffer.from(result.encoded, "base64"));
    console.info("[VOICE31_DIRECT] success", { model: result.model, voice, totalMs: Date.now() - totalStartedAt, bytes: wav.length, attempts });
      return {
        success: true,
        audioBase64: wav.toString("base64"),
        mimeType: "audio/wav",
        provider: "gemini",
        model: result.model,
        voice,
        latencyMs: Date.now() - totalStartedAt,
        cached: false,
        fallback: true,
        costMode: "gemini-free-tier-compatible",
        serverResponseAt: Date.now(),
        attempts,
      };
    } catch (error) {
      const status = Number(error?.status ?? 0);
      const reason = error instanceof Error ? error.message : String(error);
      console.warn("[VOICE31_DIRECT] primary failed", { reason, status, attempts });
    }
  } else {
    attempts.push({
      model: PRIMARY_MODEL,
      provider: "gemini",
      ok: false,
      ms: 0,
      reason: "gemini_not_configured",
    });
  }

  if (apiKey) try {
    const result = await synthesize25({ apiKey, prompt, voice, attempts });
    const wav = makeWavFromPcm(Buffer.from(result.encoded, "base64"));
    console.info("[VOICE31_DIRECT] fallback success", { model: result.model, voice, totalMs: Date.now() - totalStartedAt, bytes: wav.length, attempts });
    return {
      success: true,
      audioBase64: wav.toString("base64"),
      mimeType: "audio/wav",
      provider: "gemini",
      model: result.model,
      voice,
      latencyMs: Date.now() - totalStartedAt,
      cached: false,
      fallback: true,
      costMode: "gemini-free-tier-compatible",
      serverResponseAt: Date.now(),
      attempts,
    };
  } catch (error) {
    console.warn("[VOICE31_DIRECT] Gemini 2.5 fallback failed", { reason: error instanceof Error ? error.message : String(error), attempts });
  }

  const quotaLimited = attempts.some(attempt =>
    typeof attempt?.reason === "string" && attempt.reason.includes("429"),
  );
  return {
    success: false,
    provider: "device",
    errorCode: quotaLimited ? "gemini_free_quota" : "device_fallback",
    error: quotaLimited
      ? "Google 무료 음성 한도가 잠시 제한되어 기기 음성으로 이어서 들려줘요."
      : "Google 음성이 잠시 바빠 기기 음성으로 이어서 들려줘요.",
    fallbackSuggested: true,
    costMode: "zero-external-cost-fallback",
    serverResponseAt: Date.now(),
    attempts,
  };
}

async function synthesize(input) {
  const key = cacheKey(input);
  const cached = getCached(key);
  if (cached) return cached;
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = synthesizeUncached(input).then(result => {
    if (result.success) putCached(key, result);
    return result;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

function tRpcEnvelope(result) {
  return [{ result: { data: { json: result } } }];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Bible-Friend-TTS-Primary", "qwen3-tts");
  res.setHeader("X-Bible-Friend-TTS-Cost-Mode", "free-tier-compatible");

  if (req.method === "GET") {
    if (String(req.query?.probe ?? "") === "1") {
      const probeInput = {
        text: "안녕! 나는 성경 친구야. 오늘도 함께 말씀을 알아보자.",
        speaker: "CHILD_FRIEND",
        emotion: "밝고 친근한 목소리",
        style: "또렷하고 따뜻하게",
        speed: 1,
        context: "성경 친구 앱 음성 진단",
      };
      const result = String(req.query?.provider ?? "") === "qwen3"
        ? await probeOpenGateway(probeInput)
        : await synthesize(probeInput);
      const safe = result.success
        ? { success: true, provider: result.provider, model: result.model, voice: result.voice, latencyMs: result.latencyMs, cached: result.cached, fallback: result.fallback, costMode: result.costMode, audioBytesApprox: Math.floor((result.audioBase64.length * 3) / 4), attempts: result.attempts }
        : { success: false, errorCode: result.errorCode, error: result.error, costMode: result.costMode, attempts: result.attempts };
      return res.status(200).json({ ok: result.success, primaryModel: "qwen3-tts", fallbackModel: PRIMARY_MODEL, freeTierCompatible: true, configured: Boolean(OPEN_TTS_GATEWAY_URL || process.env.GEMINI_API_KEY), result: safe });
    }
    return res.status(200).json({
      ok: true,
      configured: Boolean(OPEN_TTS_GATEWAY_URL || process.env.GEMINI_API_KEY),
      primaryModel: "qwen3-tts",
      fallbackModel: PRIMARY_MODEL,
      openSourceGatewayConfigured: Boolean(OPEN_TTS_GATEWAY_URL),
      providerChain: [
        ...(OPEN_TTS_GATEWAY_URL ? ["cloudflare-worker/qwen3-tts"] : []),
        PRIMARY_MODEL,
        FALLBACK_MODEL,
        "device-speech",
      ],
      freeTierCompatible: true,
      freeTierRequirement: "Qwen3 primary with Gemini fallback; provider usage limits apply.",
      primaryTimeoutMs: OPEN_TTS_GATEWAY_TIMEOUT_MS,
      gemini31TimeoutMs: PRIMARY_TIMEOUT_MS,
      fallbackTimeoutMs: FALLBACK_TIMEOUT_MS,
      retry31OnPreview500: false,
      duplicateRequestCacheTtlMs: CACHE_TTL_MS,
    });
  }

  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  try {
    const body = await readJsonBody(req);
    const isBatch = String(req.query?.batch ?? "") === "1" || Object.prototype.hasOwnProperty.call(body || {}, "0");
    const input = extractVoiceInput(body);
    const result = await synthesize(input);
    return res.status(200).json(isBatch ? tRpcEnvelope(result) : result);
  } catch (error) {
    console.error("[VOICE31_DIRECT] handler error", { message: error instanceof Error ? error.message : String(error) });
    const result = {
      success: false,
      provider: "device",
      errorCode: "device_fallback",
      error: "음성 서버가 잠시 바빠 기기 음성으로 이어서 들려줘요.",
      fallbackSuggested: true,
      costMode: "zero-external-cost-fallback",
      serverResponseAt: Date.now(),
      attempts: [],
    };
    const isBatch = String(req.query?.batch ?? "") === "1";
    return res.status(200).json(isBatch ? tRpcEnvelope(result) : result);
  }
}
