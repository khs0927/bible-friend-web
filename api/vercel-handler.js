// Vercel function discovery marker.
// `pnpm run vercel-build` replaces this file with the fully bundled API handler
// before the deployment artifact is packaged.
export default function handler(_req, res) {
  res.status(503).json({ ok: false, error: "api_bundle_not_built" });
}
