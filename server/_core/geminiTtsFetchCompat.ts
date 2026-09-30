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
    // Only translate the legacy string-input request. Gemini 3.8 TTS uses
    // structured Interactions input with speech_metadata annotations and must
    // pass through untouched to the official Interactions endpoint.
    return audioRequested && typeof parsed.input === "string" ? parsed : null;
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
    const voiceName = parsed.generation_config?.speech_config?.[0]?.voice?.trim() || "Leda";
    const startedAt = Date.now();
    console.info("[TTS Compat] generateContent start", {
      model: parsed.model ?? null,
      voice: voiceName,
      promptChars: parsed.input?.length ?? 0,
      inheritedSignal: Boolean(init?.signal),
    });

    let response: Response;
    try {
      response = await originalFetch(converted.url, {
        ...init,
        headers,
        body: JSON.stringify(converted.body),
      });
    } catch (error) {
      console.warn("[TTS Compat] generateContent fetch failed", {
        latencyMs: Date.now() - startedAt,
        name: error instanceof Error ? error.name : "unknown",
      });
      throw error;
    }

    console.info("[TTS Compat] generateContent response", {
      status: response.status,
      latencyMs: Date.now() - startedAt,
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
    console.info("[TTS Compat] generateContent audio", {
      latencyMs: Date.now() - startedAt,
      audioBase64Chars: audioData?.length ?? 0,
    });
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
