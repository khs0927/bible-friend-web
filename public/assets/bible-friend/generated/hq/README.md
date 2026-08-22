# Bible Friend HQ Generated Assets

This folder is the source registry for the individual high-resolution visual assets used by the Bible Friend Figma UI.

Quality rules:
- Keep each icon/illustration as an individual source asset.
- Preserve transparent PNG when the source provides alpha.
- Do not reuse a cropped sprite/sticker sheet as a production icon source.
- Do not convert production source assets to JPEG.
- Prefer the original source URL listed in `sources.json` until the binary sync workflow has copied the files into this folder.
- The Figma source nodes are listed in `sources.json`; the UI screens reuse those native Figma image hashes without recompression.
- Resolution-independent UI controls are stored as individual SVG files under `../vector/`.

Figma file: https://www.figma.com/design/cqQhO3opkgUmaEgOPAEUt3
Figma HQ PNG source frames: `45:40` through `45:49`
Figma HQ vector source board: `50:23`
Figma transparent icon-pack screen: `54:23`

The workflow `.github/workflows/sync-bible-friend-hq-assets.yml` is retained as the binary mirroring path for copying the original PNG bytes into this repository when GitHub Actions execution is available.
