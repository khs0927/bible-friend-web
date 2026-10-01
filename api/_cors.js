// CORS for the Bible Friend Android app (Tauri), which loads this client from
// its own origin and calls the deployed API cross-origin. Files starting with
// "_" are not deployed as Vercel functions; this is imported by the handlers.

const APP_ORIGINS = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"];

/** @param {string | undefined} extra comma-separated origins (CORS_ALLOWED_ORIGINS) */
export function allowedOrigins(extra = process.env.CORS_ALLOWED_ORIGINS) {
  const configured = (extra ?? "")
    .split(",")
    .map(o => o.trim())
    .filter(Boolean);
  return new Set([...APP_ORIGINS, ...configured]);
}

/**
 * Sets CORS headers for allowed origins. Returns true when the request was a
 * preflight that has been answered and the handler should stop.
 * @param {{ method?: string, headers: Record<string, string | string[] | undefined> }} req
 * @param {{ setHeader(name: string, value: string): unknown, statusCode: number, end(): unknown }} res
 */
export function applyCors(req, res, origins = allowedOrigins()) {
  const origin = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (typeof origin !== "string" || !origins.has(origin)) return false;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, accept, trpc-accept, x-trpc-source");
    res.setHeader("Access-Control-Max-Age", "600");
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}
