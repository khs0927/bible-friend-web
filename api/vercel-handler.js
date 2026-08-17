// Vercel function discovery marker.
// Bundle cache generation: 2026-08-17T15:08Z-gemini-tts-deep-fix
// `pnpm run vercel-build` replaces this file with the fully bundled API handler
// before the deployment artifact is packaged. Updating this marker intentionally
// invalidates Vercel's function-source cache when server/API source changes.
export default function handler(_req, res) {
  res.status(503).json({ ok: false, error: "api_bundle_not_built" });
}
