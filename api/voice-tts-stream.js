const MODEL = "gemini-3.1-flash-tts-preview";
const GEMINI_HOST = "https://generativelanguage.googleapis.com";
const MAX_TEXT_CHARS = 900;
const STREAM_TIMEOUT_MS = 20_000;

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

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) return JSON.parse(req.body);
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw.trim() ? JSON.parse(raw) : {};
}

function extractVoiceInput(body) {
  const input = body?.json ?? body ?? {};
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

function jsonError(res, status, code, message) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: false, code, message }));
}

function isIOSChrome(req) {
  const userAgent = String(req.headers?.["user-agent"] ?? "");
  return /CriOS/i.test(userAgent);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      model: MODEL,
      streaming: true,
      format: "native-pcm",
      sampleRate: 24000,
      configured: Boolean(process.env.GEMINI_API_KEY),
      iosChromeStrategy: "device-speech-fallback",
    });
  }

  if (req.method !== "POST") return jsonError(res, 405, "method_not_allowed", "POST only");

  // Chrome on iOS uses WebKit but has a different media-activation lifecycle
  // from Safari/in-app browsers. Streaming PCM through WebAudio can succeed on
  // the server while remaining silent in CriOS. Fail this path immediately so
  // the client moves to the direct TTS mutation, which returns an immediate
  // device-speech fallback for CriOS instead of leaving the child in silence.
  if (isIOSChrome(req)) {
    res.setHeader("X-Bible-Friend-Voice-Fallback", "device-speech");
    return jsonError(res, 409, "ios_chrome_device_fallback", "Use device speech on iOS Chrome");
  }

  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) return jsonError(res, 503, "configuration", "Gemini TTS is not configured");

  let input;
  try {
    input = extractVoiceInput(await readJsonBody(req));
  } catch {
    return jsonError(res, 400, "bad_json", "Invalid request body");
  }

  if (!input.text) return jsonError(res, 400, "invalid_request", "Missing text");
  if (input.text.length > MAX_TEXT_CHARS) return jsonError(res, 400, "invalid_request", "Text is too long");

  const voice = VOICES[input.speaker] || VOICES.CHILD_FRIEND;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const upstream = await fetch(`${GEMINI_HOST}/v1beta/interactions?alt=sse`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "text/event-stream",
        "x-goog-api-key": apiKey,
        "Api-Revision": "2026-05-20",
      },
      body: JSON.stringify({
        model: MODEL,
        input: buildPrompt(input),
        response_format: { type: "audio" },
        generation_config: {
          speech_config: [{ voice }],
        },
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      console.warn("[VOICE_STREAM] upstream rejected", {
        status: upstream.status,
        elapsedMs: Date.now() - startedAt,
        detail: detail.slice(0, 200),
      });
      return jsonError(res, 502, `gemini_http_${upstream.status}`, "Gemini streaming TTS was unavailable");
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("X-Bible-Friend-TTS-Model", MODEL);
    res.setHeader("X-Bible-Friend-TTS-Voice", voice);
    res.flushHeaders?.();

    const reader = upstream.body.getReader();
    let firstChunkAt = 0;
    let bytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      if (!firstChunkAt) {
        firstChunkAt = Date.now();
        console.info("[VOICE_STREAM] first upstream chunk", {
          model: MODEL,
          voice,
          ms: firstChunkAt - startedAt,
        });
      }
      bytes += value.byteLength;
      res.write(Buffer.from(value));
    }

    console.info("[VOICE_STREAM] completed", {
      model: MODEL,
      voice,
      firstChunkMs: firstChunkAt ? firstChunkAt - startedAt : null,
      totalMs: Date.now() - startedAt,
      bytes,
    });
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[VOICE_STREAM] failed", { message, elapsedMs: Date.now() - startedAt });
    if (!res.headersSent) return jsonError(res, 502, "stream_failed", "Gemini streaming TTS failed");
    res.end();
  } finally {
    clearTimeout(timer);
  }
}
