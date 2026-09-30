interface Env {
  AUDIO_CACHE: KVNamespace;
  CIRCUIT_STATE: KVNamespace;
  API_TOKEN?: string;
  GPU_ENDPOINTS_JSON?: string;
  CACHE_VERSION?: string;
  CACHE_TTL_SECONDS?: string;
  MAX_TEXT_CHARS?: string;
  MAX_CACHE_BYTES?: string;
  DEFAULT_ENDPOINT_TIMEOUT_MS?: string;
  DEFAULT_CIRCUIT_COOLDOWN_SECONDS?: string;
}

type GpuEndpoint = {
  name: string;
  url: string;
  healthUrl?: string;
  token?: string;
  timeoutMs?: number;
  cooldownSeconds?: number;
  enabled?: boolean;
};

type TtsRequest = {
  text?: string;
  speaker?: string;
  voice?: string;
  language?: string;
  emotion?: string;
  style?: string;
  instruct?: string;
  context?: string;
  speed?: number;
  format?: string;
};

type CacheMetadata = {
  contentType?: string;
  provider?: string;
  endpoint?: string;
  createdAt?: string;
};

type CircuitState = {
  openUntil?: number;
  reason?: string;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, ...extraHeaders },
  });
}

function numberEnv(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(parsed, max)) : fallback;
}

function bearerToken(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function authorized(request: Request, env: Env) {
  const required = env.API_TOKEN?.trim();
  return !required || bearerToken(request) === required;
}

function endpoints(env: Env): GpuEndpoint[] {
  if (!env.GPU_ENDPOINTS_JSON?.trim()) return [];
  try {
    const parsed = JSON.parse(env.GPU_ENDPOINTS_JSON);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is GpuEndpoint =>
        Boolean(item && typeof item.name === "string" && typeof item.url === "string"),
      )
      .filter(item => item.enabled !== false);
  } catch {
    return [];
  }
}

function normalizeInput(input: TtsRequest, env: Env) {
  const maxChars = numberEnv(env.MAX_TEXT_CHARS, 1200, 80, 4000);
  const text = String(input.text || "").trim();
  if (!text) throw new Error("missing_text");
  if (text.length > maxChars) throw new Error("text_too_long");

  const speedRaw = Number(input.speed ?? 1);
  const speed = Number.isFinite(speedRaw) ? Math.max(0.7, Math.min(speedRaw, 1.3)) : 1;
  const speaker = String(input.speaker || input.voice || "Sohee").trim() || "Sohee";
  const language = String(input.language || "Korean").trim() || "Korean";
  const instruction = [
    String(input.instruct || "").trim(),
    String(input.emotion || "").trim() ? `감정: ${String(input.emotion).trim()}` : "",
    String(input.style || "").trim() ? `말투: ${String(input.style).trim()}` : "",
    String(input.context || "").trim() ? `맥락: ${String(input.context).trim()}` : "",
    speed < 0.95 ? "조금 천천히 말해 주세요." : speed > 1.05 ? "조금 경쾌하게 말해 주세요." : "",
  ].filter(Boolean).join("\n");

  return {
    text,
    language,
    speaker,
    instruct: instruction,
    speed,
    format: String(input.format || "wav").toLowerCase(),
  };
}

async function sha256(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function cacheKey(input: ReturnType<typeof normalizeInput>, env: Env) {
  const version = env.CACHE_VERSION?.trim() || "qwen3-v1";
  return `audio:${version}:${await sha256(JSON.stringify(input))}`;
}

async function isCircuitOpen(endpoint: GpuEndpoint, env: Env) {
  const state = await env.CIRCUIT_STATE.get<CircuitState>(`cb:${endpoint.name}`, "json");
  return Boolean(state?.openUntil && state.openUntil > Date.now());
}

function markCircuitOpen(endpoint: GpuEndpoint, reason: string, env: Env, ctx: ExecutionContext) {
  const fallbackCooldown = numberEnv(env.DEFAULT_CIRCUIT_COOLDOWN_SECONDS, 90, 15, 1800);
  const cooldownSeconds = Math.max(15, Math.min(endpoint.cooldownSeconds ?? fallbackCooldown, 1800));
  const state: CircuitState = {
    openUntil: Date.now() + cooldownSeconds * 1000,
    reason: reason.slice(0, 180),
  };
  ctx.waitUntil(
    env.CIRCUIT_STATE.put(`cb:${endpoint.name}`, JSON.stringify(state), {
      expirationTtl: cooldownSeconds,
    }),
  );
}

async function fetchWithTimeout(endpoint: GpuEndpoint, payload: object, env: Env) {
  const fallbackTimeout = numberEnv(env.DEFAULT_ENDPOINT_TIMEOUT_MS, 25000, 2000, 55000);
  const timeoutMs = Math.max(2000, Math.min(endpoint.timeoutMs ?? fallbackTimeout, 55000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("tts_timeout"), timeoutMs);
  try {
    return await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "audio/wav, audio/mpeg, audio/ogg, audio/*",
        ...(endpoint.token ? { authorization: `Bearer ${endpoint.token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function serveCached(key: string, env: Env) {
  const hit = await env.AUDIO_CACHE.getWithMetadata<CacheMetadata>(key, {
    type: "arrayBuffer",
    cacheTtl: 60,
  });
  if (!hit.value) return null;
  return new Response(hit.value, {
    status: 200,
    headers: {
      "content-type": hit.metadata?.contentType || "audio/wav",
      "cache-control": "public, max-age=31536000, immutable",
      "x-bible-friend-tts-provider": hit.metadata?.provider || "cache",
      "x-bible-friend-tts-endpoint": hit.metadata?.endpoint || "cache",
      "x-bible-friend-tts-cache": "HIT",
    },
  });
}

async function synthesize(request: Request, env: Env, ctx: ExecutionContext) {
  if (!authorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);

  let raw: TtsRequest;
  try {
    raw = await request.json<TtsRequest>();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }

  let input: ReturnType<typeof normalizeInput>;
  try {
    input = normalizeInput(raw, env);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_request";
    return json({ ok: false, error: code }, 400);
  }

  const key = await cacheKey(input, env);
  const cached = await serveCached(key, env);
  if (cached) return cached;

  const pool = endpoints(env);
  if (!pool.length) {
    return json(
      { ok: false, error: "no_gpu_endpoints", fallbackSuggested: true },
      503,
      { "x-bible-friend-tts-cache": "MISS" },
    );
  }

  const failures: Array<{ endpoint: string; reason: string }> = [];
  for (const endpoint of pool) {
    try {
      if (await isCircuitOpen(endpoint, env)) {
        failures.push({ endpoint: endpoint.name, reason: "circuit_open" });
        continue;
      }

      const response = await fetchWithTimeout(endpoint, {
        text: input.text,
        language: input.language,
        speaker: input.speaker,
        instruct: input.instruct,
        speed: input.speed,
        format: input.format,
      }, env);

      if (!response.ok) {
        const reason = `http_${response.status}`;
        failures.push({ endpoint: endpoint.name, reason });
        markCircuitOpen(endpoint, reason, env, ctx);
        continue;
      }

      const audio = await response.arrayBuffer();
      if (audio.byteLength < 44) {
        failures.push({ endpoint: endpoint.name, reason: "invalid_audio" });
        markCircuitOpen(endpoint, "invalid_audio", env, ctx);
        continue;
      }

      const contentType = response.headers.get("content-type") || "audio/wav";
      const maxCacheBytes = numberEnv(env.MAX_CACHE_BYTES, 8 * 1024 * 1024, 64 * 1024, 25 * 1024 * 1024);
      if (audio.byteLength <= maxCacheBytes) {
        const ttl = numberEnv(env.CACHE_TTL_SECONDS, 2592000, 60, 31536000);
        ctx.waitUntil(
          env.AUDIO_CACHE.put(key, audio, {
            expirationTtl: ttl,
            metadata: {
              contentType,
              provider: response.headers.get("x-bible-friend-tts-provider") || "qwen3",
              endpoint: endpoint.name,
              createdAt: new Date().toISOString(),
            } satisfies CacheMetadata,
          }),
        );
      }

      return new Response(audio, {
        status: 200,
        headers: {
          "content-type": contentType,
          "cache-control": "private, max-age=0",
          "x-bible-friend-tts-provider": response.headers.get("x-bible-friend-tts-provider") || "qwen3",
          "x-bible-friend-tts-endpoint": endpoint.name,
          "x-bible-friend-tts-cache": "MISS",
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "fetch_failed";
      failures.push({ endpoint: endpoint.name, reason });
      markCircuitOpen(endpoint, reason, env, ctx);
    }
  }

  return json(
    { ok: false, error: "gpu_pool_unavailable", fallbackSuggested: true, failures },
    503,
    { "x-bible-friend-tts-cache": "MISS" },
  );
}

async function endpointStatus(env: Env) {
  const pool = endpoints(env);
  const result = await Promise.all(pool.map(async endpoint => {
    const circuitOpen = await isCircuitOpen(endpoint, env);
    if (circuitOpen) return { name: endpoint.name, ok: false, state: "circuit_open" };
    if (!endpoint.healthUrl) return { name: endpoint.name, ok: true, state: "configured" };
    try {
      const response = await fetch(endpoint.healthUrl, { signal: AbortSignal.timeout(3000) });
      return { name: endpoint.name, ok: response.ok, state: response.ok ? "ready" : `http_${response.status}` };
    } catch {
      return { name: endpoint.name, ok: false, state: "unreachable" };
    }
  }));
  return result;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "bible-friend-tts-gateway",
        cache: "workers-kv",
        endpoints: endpoints(env).map(item => item.name),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/voice/status") {
      if (!authorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
      return json({ ok: true, endpoints: await endpointStatus(env) });
    }

    if (request.method === "GET" && url.pathname === "/api/voice/voices") {
      if (!authorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
      return json({
        ok: true,
        voices: [
          { id: "Sohee", language: "Korean", engine: "qwen3-tts", description: "따뜻한 한국어 여성 음성" },
        ],
      });
    }

    if (request.method === "POST" && (url.pathname === "/api/voice/speech" || url.pathname === "/tts")) {
      return synthesize(request, env, ctx);
    }

    return json({ ok: false, error: "not_found" }, 404);
  },
} satisfies ExportedHandler<Env>;
