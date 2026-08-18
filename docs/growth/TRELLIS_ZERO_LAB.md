# TRELLIS.2 ZeroGPU validation lab

This repository includes a deliberately isolated browser lab at `/trellis-zero-lab.html`.

Validation order:
1. preprocess the approved Bible Friend front reference,
2. connect to Microsoft `microsoft/TRELLIS.2` ZeroGPU with the official Gradio JS client,
3. generate at 512 resolution for the first free test,
4. let `@gradio/client` retain the `gr.State` 3D latent inside the same session,
5. call `extract_glb` with only the public decimation/texture parameters (100k faces / 1024 texture),
6. require `<model-viewer>` to load the resulting GLB,
7. capture and compare front/side/back views against the approved character sheet,
8. only after visual review may the model replace `/assets/growth/3d/character/bible-friend-base.glb`.

Why state is not passed manually: Gradio clients keep `gr.State` automatically for sequential calls in the same client session. Passing the latent as a visible API argument is incorrect for this Space.

The optional Hugging Face token is read only from the browser input and is never sent to the Bible Friend backend or persisted by this page.

This page is an asset-production lab, not a player-facing route.