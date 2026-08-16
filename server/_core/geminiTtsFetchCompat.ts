const GEMINI_INTERACTIONS_HOST = "generativelanguage.googleapis.com";
const GEMINI_INTERACTIONS_PATH = "/v1beta/interactions";
export const GEMINI_TTS_API_REVISION = "2026-05-20";

function isGeminiInteractionsUrl(input: RequestInfo | URL) {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw);
    return url.hostname === GEMINI_INTERACTIONS_HOST && url.pathname === GEMINI_INTERACTIONS_PATH;
  } catch {
    return false;
  }
}

function isAudioInteractionBody(body: BodyInit | null | undefined) {
  if (typeof body !== "string") return false;
  try {
    const parsed = JSON.parse(body);
    const responseFormat = parsed?.response_format;
    if (responseFormat?.type === "audio") return true;
    if (Array.isArray(responseFormat)) return responseFormat.some((item: any) => item?.type === "audio");
    return false;
  } catch {
    return false;
  }
}

export function withGeminiTtsRevision(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers ?? undefined);
  if (!headers.has("Api-Revision")) headers.set("Api-Revision", GEMINI_TTS_API_REVISION);
  return { ...init, headers };
}

const PATCH_KEY = Symbol.for("bible-friend.gemini-tts-fetch-revision");

type PatchedGlobal = typeof globalThis & { [PATCH_KEY]?: boolean };

export function installGeminiTtsFetchCompat() {
  const patchedGlobal = globalThis as PatchedGlobal;
  if (patchedGlobal[PATCH_KEY] || typeof globalThis.fetch !== "function") return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const isTtsRequest =
      isGeminiInteractionsUrl(input) &&
      (init?.method ?? "GET").toUpperCase() === "POST" &&
      isAudioInteractionBody(init?.body);

    return originalFetch(input, isTtsRequest ? withGeminiTtsRevision(init) : init);
  }) as typeof globalThis.fetch;

  patchedGlobal[PATCH_KEY] = true;
}

installGeminiTtsFetchCompat();
