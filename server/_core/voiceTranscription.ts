import { ENV } from "./env";

export type TranscribeOptions = {
  audioUrl: string;
  language?: string;
  prompt?: string;
};

export type WhisperSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

export type WhisperResponse = {
  task: "transcribe";
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
};

export type TranscriptionResponse = WhisperResponse;

export type TranscriptionError = {
  error: string;
  code: "FILE_TOO_LARGE" | "INVALID_FORMAT" | "TRANSCRIPTION_FAILED" | "UPLOAD_FAILED" | "SERVICE_ERROR";
  details?: string;
};

type LoadedAudio = {
  buffer: Buffer;
  mimeType: string;
};

const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const GEMINI_STT_MODEL = process.env.GEMINI_STT_MODEL?.trim() || "gemini-2.5-flash";

function normalizeMimeType(value: string) {
  const mimeType = value.toLowerCase().split(";")[0]?.trim() || "audio/m4a";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "audio/m4a";
  return mimeType;
}

function decodeDataUrl(value: string): LoadedAudio | null {
  if (!value.startsWith("data:")) return null;
  const comma = value.indexOf(",");
  if (comma < 0) return null;

  const metadata = value.slice(5, comma);
  const payload = value.slice(comma + 1);
  const isBase64 = metadata.toLowerCase().includes(";base64");
  const mimeType = normalizeMimeType(metadata.split(";")[0] || "audio/m4a");

  try {
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

async function loadAudio(source: string): Promise<LoadedAudio | TranscriptionError> {
  const inline = decodeDataUrl(source);
  if (source.startsWith("data:") && !inline) {
    return {
      error: "Invalid inline audio data",
      code: "INVALID_FORMAT",
      details: "The recorded audio could not be decoded",
    };
  }

  let loaded: LoadedAudio;
  if (inline) {
    loaded = inline;
  } else {
    try {
      const response = await fetch(source);
      if (!response.ok) {
        return {
          error: "Failed to download audio file",
          code: "INVALID_FORMAT",
          details: `HTTP ${response.status}`,
        };
      }
      loaded = {
        buffer: Buffer.from(await response.arrayBuffer()),
        mimeType: normalizeMimeType(response.headers.get("content-type") || "audio/mpeg"),
      };
    } catch {
      return {
        error: "Failed to fetch audio file",
        code: "SERVICE_ERROR",
        details: "The audio source could not be read",
      };
    }
  }

  if (loaded.buffer.length === 0) {
    return { error: "Recorded audio is empty", code: "INVALID_FORMAT" };
  }
  if (loaded.buffer.length > MAX_AUDIO_BYTES) {
    return {
      error: "Audio file exceeds maximum size limit",
      code: "FILE_TOO_LARGE",
      details: "Maximum supported audio size is 16MB",
    };
  }
  return loaded;
}

function extractGeminiText(body: any) {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function transcribeWithGemini(audio: LoadedAudio, options: TranscribeOptions): Promise<TranscriptionResponse> {
  if (!ENV.geminiApiKey) throw new Error("gemini_not_configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  const language = options.language?.trim() || "ko";
  const prompt = options.prompt?.trim() ||
    `이 오디오에서 사람이 말한 내용을 ${language === "ko" ? "한국어" : language} 텍스트로 정확히 받아 적어 주세요. 설명이나 머리말 없이 실제로 들린 말만 출력하세요.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_STT_MODEL)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": ENV.geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: audio.mimeType,
                    data: audio.buffer.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 220,
          },
        }),
        signal: controller.signal,
      },
    );

    const bodyText = await response.text();
    if (!response.ok) throw new Error(`gemini_http_${response.status}`);

    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      throw new Error("gemini_invalid_json");
    }

    const text = extractGeminiText(body).replace(/^```(?:text)?\s*/i, "").replace(/```$/i, "").trim();
    if (!text) throw new Error("gemini_empty_transcript");

    return {
      task: "transcribe",
      language,
      duration: 0,
      text,
      segments: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function transcribeWithForge(audio: LoadedAudio, options: TranscribeOptions): Promise<TranscriptionResponse> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("forge_not_configured");

  const formData = new FormData();
  const filename = `audio.${getFileExtension(audio.mimeType)}`;
  const audioBlob = new Blob([new Uint8Array(audio.buffer)], { type: audio.mimeType });
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append(
    "prompt",
    options.prompt ||
      (options.language
        ? `Transcribe the user's voice to text. The working language is ${getLanguageName(options.language)}.`
        : "Transcribe the user's voice to text."),
  );

  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const response = await fetch(new URL("v1/audio/transcriptions", baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.forgeApiKey}`,
      "Accept-Encoding": "identity",
    },
    body: formData,
  });

  if (!response.ok) throw new Error(`forge_http_${response.status}`);
  const result = (await response.json()) as WhisperResponse;
  if (!result?.text || typeof result.text !== "string") throw new Error("forge_invalid_transcript");
  return result;
}

export async function transcribeAudio(options: TranscribeOptions): Promise<TranscriptionResponse | TranscriptionError> {
  const loaded = await loadAudio(options.audioUrl);
  if ("error" in loaded) return loaded;

  if (ENV.geminiApiKey) {
    try {
      return await transcribeWithGemini(loaded, options);
    } catch (error) {
      console.warn("[Voice STT] Gemini transcription failed", error instanceof Error ? error.message : "unknown_error");
    }
  }

  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    try {
      return await transcribeWithForge(loaded, options);
    } catch (error) {
      console.warn("[Voice STT] Forge transcription failed", error instanceof Error ? error.message : "unknown_error");
    }
  }

  return {
    error: "Voice transcription is temporarily unavailable",
    code: "TRANSCRIPTION_FAILED",
    details: ENV.geminiApiKey
      ? "Gemini could not transcribe the recording"
      : "GEMINI_API_KEY is not configured",
  };
}

function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "audio/webm": "webm",
    "audio/opus": "opus",
    "audio/mp3": "mp3",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/ogg": "ogg",
    "audio/m4a": "m4a",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/flac": "flac",
  };
  return mimeToExt[mimeType] || "audio";
}

function getLanguageName(langCode: string): string {
  const langMap: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ru: "Russian",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    ar: "Arabic",
    hi: "Hindi",
  };
  return langMap[langCode] || langCode;
}
