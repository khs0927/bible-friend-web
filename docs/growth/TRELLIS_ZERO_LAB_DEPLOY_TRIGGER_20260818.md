# Production validation trigger

Purpose: trigger one Vercel production deployment for the corrected TRELLIS.2 ZeroGPU lab after the previous commits were rejected by the Hobby build-rate window.

Runtime behavior: none.

Validated implementation before this retry:
- PR #22 merged.
- Preview build passed 25 tests and Vite/API bundling.
- `@gradio/client` session state handling corrected: `gr.State` stays internal and `extract_glb` receives only decimation target + texture size.
- Fal paid fallback remains disabled (`fal-ai/trellis/multi` is $0.02/run).

Expected validation route: `/trellis-zero-lab.html`.
