# Bible Friend HQ Generated Assets

This folder is the source registry for the individual high-resolution visual assets used by the Bible Friend Figma UI.

Quality rules:
- Keep each icon/illustration as an individual source asset.
- Preserve transparent PNG when the source provides alpha.
- Do not reuse a cropped sprite/sticker sheet as a production icon source.
- Do not convert production source assets to JPEG.
- Prefer the original source URL listed in `sources.json` until the binary sync workflow has copied the files into this folder.
- The Figma source nodes are listed in `sources.json`; the UI screens reuse those native Figma image hashes without recompression.

Figma file: https://www.figma.com/design/cqQhO3opkgUmaEgOPAEUt3

The workflow `.github/workflows/sync-bible-friend-hq-assets.yml` is retained as the binary mirroring path for copying the original PNG bytes into this repository when GitHub Actions execution is available.
