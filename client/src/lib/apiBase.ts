// Where the client reaches the API. Empty on the web (same-origin `/api/...`);
// the Android app (Tauri) bundles this client and sets VITE_API_BASE_URL to the
// deployed server, e.g. https://bible-friend.vercel.app.
export function resolveApiBase(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/\/+$/, "");
}

export const API_BASE_URL = resolveApiBase(import.meta.env.VITE_API_BASE_URL);

export function apiUrl(path: string, base: string = API_BASE_URL): string {
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
