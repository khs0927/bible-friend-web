# TRELLIS.2 ZeroGPU validation lab

This branch adds a deliberately isolated browser lab at `/trellis-zero-lab.html`.

Validation order:
1. preprocess the approved Bible Friend front reference,
2. call Microsoft `microsoft/TRELLIS.2` ZeroGPU,
3. generate at 512 resolution for the first free test,
4. extract a 100k-face / 1024 texture GLB,
5. require `<model-viewer>` to load the resulting GLB,
6. only after visual review may the model replace `/assets/growth/3d/character/bible-friend-base.glb`.

The optional Hugging Face token is read only from the browser input and is never sent to the Bible Friend backend or persisted by this page.

This page is an asset-production lab, not a player-facing route.