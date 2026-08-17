import { ENV } from "./env";

type GeminiTextRequest = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  timeoutMs?: number;
};

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

const PRIMARY_MODEL = "gemini-2.5-flash";
const BACKUP_MODEL = "gemini-2.5-flash-lite";

function extractText(payload: GeminiGenerateResponse) {
  return (payload.candidates ?? [])
    .flatMap(candidate => candidate.content?.parts ?? [])
    .map(part => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function requestModel(model: string, request: GeminiTextRequest) {
  if (!ENV.geminiApiKey) throw new Error("GEMINI_API_KEY is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs ?? 12_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": ENV.geminiApiKey,
        },
        body: JSON.stringify({
          ...(request.systemInstruction
            ? { system_instruction: { parts: [{ text: request.systemInstruction }] } }
            : {}),
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 700,
          },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`gemini_text_http_${response.status}:${body.slice(0, 240)}`);
    }

    const payload = (await response.json()) as GeminiGenerateResponse;
    const text = extractText(payload);
    if (!text) throw new Error("gemini_text_empty");
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateGeminiText(request: GeminiTextRequest) {
  const preferred = request.model?.trim() || PRIMARY_MODEL;
  const models = Array.from(new Set([preferred, BACKUP_MODEL]));
  let lastError: unknown;

  for (const model of models) {
    try {
      const text = await requestModel(model, request);
      console.info("[Bible Agent] Gemini direct success", { model, chars: text.length });
      return { text, model };
    } catch (error) {
      lastError = error;
      console.warn("[Bible Agent] Gemini direct attempt failed", {
        model,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error("gemini_text_failed");
}
