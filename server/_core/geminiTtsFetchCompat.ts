const GEMINI_HOST = "generativelanguage.googleapis.com";
const LEGACY_INTERACTIONS_PATH = "/v1beta/interactions";
const PATCH_FLAG = "__bibleFriendGeminiTtsGenerateContentInstalled" as const;

type PatchedGlobal = typeof globalThis & { [PATCH_FLAG]?: boolean };

type LegacyTtsBody = {
  model?: string;
  input?: string;
  response_format?: { type?: string } | Array<{ type?: string }>;
  generation_config?: {
    speech_config?: Array<{ voice?: string }>;
  };
};

function getRawUrl(input: RequestInfo | URL) {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function isLegacyGeminiTtsUrl(input: RequestInfo | URL) {
  try {
    const url = new URL(getRawUrl(input));
    return url.hostname === GEMINI_HOST && url.pathname === LEGACY_INTERACTIONS_PATH;
  } catch {
    return false;
  }
}

function parseLegacyTtsBody(body: BodyInit | null | undefined): LegacyTtsBody | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body) as LegacyTtsBody;
    const format = parsed.response_format;
    const audioRequested = Array.isArray(format)
      ? format.some(item => item?.type === "audio")
      : format?.type === "audio";
    return audioRequested ? parsed : null;
  } catch {
    return null;
  }
}

export function buildGenerateContentTtsRequest(body: LegacyTtsBody) {
  const model = body.model?.trim();
  const prompt = body.input?.trim();
  const voiceName = body.generation_config?.speech_config?.[0]?.voice?.trim() || "Leda";
  if (!model || !prompt) return null;

  return {
    url: `https://${GEMINI_HOST}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    body: {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    },
  };
}

function extractGeneratedAudio(body: any) {
  const parts = body?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return undefined;
  return parts.find((part: any) => typeof part?.inlineData?.data === "string")?.inlineData?.data as string | undefined;
}

export function installGeminiTtsFetchCompat() {
  const patchedGlobal = globalThis as PatchedGlobal;
  if (patchedGlobal[PATCH_FLAG] || typeof globalThis.fetch !== "function") return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const parsed =
      isLegacyGeminiTtsUrl(input) && (init?.method ?? "GET").toUpperCase() === "POST"
        ? parseLegacyTtsBody(init?.body)
        : null;
    if (!parsed) return originalFetch(input, init);

    const converted = buildGenerateContentTtsRequest(parsed);
    if (!converted) return originalFetch(input, init);

    const headers = new Headers(init?.headers ?? undefined);
    headers.set("content-type", "application/json");
    headers.delete("Api-Revision");

    const response = await originalFetch(converted.url, {
      ...init,
      headers,
      body: JSON.stringify(converted.body),
    });
    if (!response.ok) return response;

    const responseText = await response.text();
    let generated: any;
    try {
      generated = JSON.parse(responseText);
    } catch {
      return new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    const audioData = extractGeneratedAudio(generated);
    if (!audioData) {
      return new Response(JSON.stringify(generated), {
        status: response.status,
        statusText: response.statusText,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ output_audio: { data: audioData } }), {
      status: response.status,
      statusText: response.statusText,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  patchedGlobal[PATCH_FLAG] = true;
}

installGeminiTtsFetchCompat();
