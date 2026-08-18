const STREAMING_MODEL = "gemini-3.1-flash-tts-preview";
const DIRECT_PRIMARY_MODEL = "gemini-2.5-flash-preview-tts";
const DIRECT_FALLBACK_MODEL = "gemini-3.1-flash-tts-preview";
const GEMINI_HOST = "https://generativelanguage.googleapis.com";
const MAX_TEXT_CHARS = 900;
const DIRECT_PRIMARY_TIMEOUT_MS = 8000;
const DIRECT_FALLBACK_TIMEOUT_MS = 6000;

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
    "밝고 친근하며 따뜻한 성경 친구처럼 말해.",
    "6~12세 어린이가 이해하기 쉬운 자연스러운 한국어 발음으로 말해.",
    "너무 느리거나 과장된 유아 말투는 피하고, 또렷하고 편안하게 말해.",
    `${pace} 말해.`,
    input.emotion ? `감정은 ${input.emotion}으로 표현해.` : "감정은 따뜻하고 자연스럽게 표현해.",
    input.style || "문장 사이에 자연스러운 호흡을 두고 중요한 부분은 살짝 강조해.",
    input.context ? `맥락: ${input.context}` : "",
    `다음 문장을 뜻을 바꾸지 말고 정확히 읽어 줘:\n${input.text}`,
  ].filter(Boolean).join("\n");
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, elapsedMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
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

async function synthesize31({ apiKey, prompt, voice }) {
  const { response, elapsedMs } = await fetchWithTimeout(`${GEMINI_HOST}/v1beta/interactions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
      "Api-Revision": "2026-05-20",
    },
    body: JSON.stringify({
      model: DIRECT_FALLBACK_MODEL,
      input: prompt,
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    }),
  }, DIRECT_FALLBACK_TIMEOUT_MS);
  const text = await response.text();
  if (!response.ok) throw new Error(`gemini31_http_${response.status}`);
  let body;
  try { body = JSON.parse(text); } catch { throw new Error("gemini31_bad_json"); }
  const encoded = extractInteractionAudio(body);
  if (!encoded) throw new Error("gemini31_no_audio");
  return { encoded, model: DIRECT_FALLBACK_MODEL, latencyMs: elapsedMs };
}

async function synthesize25({ apiKey, prompt, voice }) {
  const url = `${GEMINI_HOST}/v1beta/models/${encodeURIComponent(DIRECT_PRIMARY_MODEL)}:generateContent`;
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
  }, DIRECT_PRIMARY_TIMEOUT_MS);
  const text = await response.text();
  if (!response.ok) throw new Error(`gemini25_http_${response.status}`);
  let body;
  try { body = JSON.parse(text); } catch { throw new Error("gemini25_bad_json"); }
  const encoded = extractGenerateContentAudio(body);
  if (!encoded) throw new Error("gemini25_no_audio");
  return { encoded, model: DIRECT_PRIMARY_MODEL, latencyMs: elapsedMs };
}

async function synthesize(input) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) return { success: false, provider: "gemini", errorCode: "configuration", error: "Gemini 음성 연결 설정이 필요해요.", serverResponseAt: Date.now(), attempts: [] };
  if (!input.text) return { success: false, provider: "gemini", errorCode: "invalid_request", error: "읽어 줄 문장이 없어요.", serverResponseAt: Date.now(), attempts: [] };
  if (input.text.length > MAX_TEXT_CHARS) return { success: false, provider: "gemini", errorCode: "invalid_request", error: "문장이 너무 길어요. 조금 나누어 말해 주세요.", serverResponseAt: Date.now(), attempts: [] };

  const voice = VOICES[input.speaker] || VOICES.CHILD_FRIEND;
  const prompt = buildPrompt(input);
  const attempts = [];
  const totalStartedAt = Date.now();

  // Gemini 3.1 streaming is attempted by the browser first. If that stream is
  // unavailable or quota-limited, this direct endpoint starts with the older,
  // more stable 2.5 Flash TTS instead of spending a second 3.1 request.
  const candidates = [[DIRECT_PRIMARY_MODEL, synthesize25], [DIRECT_FALLBACK_MODEL, synthesize31]];

  for (const [name, fn] of candidates) {
    const attemptStartedAt = Date.now();
    try {
      const result = await fn({ apiKey, prompt, voice });
      attempts.push({ model: name, ok: true, ms: Date.now() - attemptStartedAt });
      const wav = makeWavFromPcm(Buffer.from(result.encoded, "base64"));
      console.info("[VOICE_DIRECT] success", { model: result.model, voice, latencyMs: result.latencyMs, totalMs: Date.now() - totalStartedAt, bytes: wav.length, attempts });
      return {
        success: true,
        audioBase64: wav.toString("base64"),
        mimeType: "audio/wav",
        provider: "gemini",
        model: result.model,
        voice,
        latencyMs: Date.now() - totalStartedAt,
        cached: false,
        fallback: result.model !== DIRECT_PRIMARY_MODEL,
        serverResponseAt: Date.now(),
        attempts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown";
      attempts.push({ model: name, ok: false, ms: Date.now() - attemptStartedAt, reason: message });
      console.warn("[VOICE_DIRECT] attempt failed", { model: name, reason: message, ms: Date.now() - attemptStartedAt });
    }
  }

  return {
    success: false,
    provider: "device",
    errorCode: "device_fallback",
    error: "Gemini 음성이 잠시 바빠 기기 음성으로 이어서 들려줘요.",
    fallbackSuggested: true,
    serverResponseAt: Date.now(),
    attempts,
  };
}

function tRpcEnvelope(result) {
  return [{ result: { data: { json: result } } }];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    if (String(req.query?.probe ?? "") === "1") {
      const result = await synthesize({
        text: "안녕! 나는 성경 친구야. 오늘도 함께 말씀을 알아보자.",
        speaker: "CHILD_FRIEND",
        emotion: "밝고 친근한 목소리",
        style: "또렷하고 따뜻하게",
        speed: 1,
        context: "성경 친구 앱 음성 진단",
      });
      const safe = result.success
        ? { success: true, provider: result.provider, model: result.model, voice: result.voice, latencyMs: result.latencyMs, fallback: result.fallback, audioBytesApprox: Math.floor((result.audioBase64.length * 3) / 4), attempts: result.attempts }
        : { success: false, errorCode: result.errorCode, error: result.error, attempts: result.attempts };
      return res.status(200).json({ ok: result.success, streamingModel: STREAMING_MODEL, directPrimaryModel: DIRECT_PRIMARY_MODEL, directFallbackModel: DIRECT_FALLBACK_MODEL, result: safe });
    }
    return res.status(200).json({
      ok: true,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      streamingModel: STREAMING_MODEL,
      directPrimaryModel: DIRECT_PRIMARY_MODEL,
      directFallbackModel: DIRECT_FALLBACK_MODEL,
      directPrimaryTimeoutMs: DIRECT_PRIMARY_TIMEOUT_MS,
      directFallbackTimeoutMs: DIRECT_FALLBACK_TIMEOUT_MS,
      directFunction: true,
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
    console.error("[VOICE_DIRECT] handler error", { message: error instanceof Error ? error.message : String(error) });
    const result = {
      success: false,
      provider: "device",
      errorCode: "device_fallback",
      error: "음성 서버가 잠시 바빠 기기 음성으로 이어서 들려줘요.",
      fallbackSuggested: true,
      serverResponseAt: Date.now(),
    };
    const isBatch = String(req.query?.batch ?? "") === "1";
    return res.status(200).json(isBatch ? tRpcEnvelope(result) : result);
  }
}
