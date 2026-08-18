# Growth RPG — mobile GPT tool and asset decision

## Final architecture

The Growth experience deliberately uses two rendering modes.

- Growth dashboard: 2D / 2.5D illustrated management UI.
- Adventure regions: realtime 3D RPG.

This gives the mascot the polished illustrated look of the concept mockups without forcing a WebGL scene to run continuously on every Growth screen.

## AI-to-3D tools

### 1. Open-source worker — preferred

Use `AI3D_WORKER_URL` for a remote open-source worker. The contract is intentionally small:

```text
POST /v1/image-to-3d
GET  /v1/jobs/:jobId
```

Implementations can use TripoSR, InstantMesh, TRELLIS or another open model. The Bible Friend app does not need to know which model is behind the worker.

### 2. Tripo — optional hosted fallback

The server adapter follows Tripo's official v2 OpenAPI. Tripo is useful for image-to-model and multiview-to-model generation when a hosted service is acceptable. A generated temporary URL must never become the permanent game asset URL; the GLB is downloaded, validated and copied to persistent storage immediately.

### 3. Runtime

The game standard is GLB / glTF 2.0. The Growth RPG first looks for the generated Bible Friend GLB and equipment GLBs. Missing or invalid files fall back to the lightweight procedural player so a failed model-generation job never breaks gameplay.

## Background elements

Do not generate the entire world as one giant AI model. Use a modular environment kit:

- terrain/path tiles
- house and chapel shells
- doors/windows
- tables, chairs, beds, shelves
- Bible, bread, grapes, cups, candles
- trees, bushes, flowers, fences, lamps
- rocks and desert props
- NPC base characters

Unique hero assets can be AI-generated. Repeated environment pieces should be reusable CC0 assets or low-poly procedural meshes. This gives better mobile memory usage, consistent scale, easier collision setup and far smaller downloads.

Recommended CC0 sources to evaluate for the modular kit are Poly Haven and Kenney. Any imported asset is normalized to the Bible Friend warm-cartoon material palette before shipping.

## Region plan

### 말씀의 집

A compact interior/exterior hub. Interactive Bible table, prayer corner, spiritual-meal table and exit door. This is the first fully polished 3D vertical slice.

### 평안의 길

Village-kit reuse plus NPCs. Core interactions are greeting, encouragement and helping rather than combat.

### 광야

Procedural terrain plus reusable rocks/cacti. Distant temptation/enemy figures can remain low-cost silhouettes. Encounters use Scripture proclamation, faith shield and prayer choices.

### 회복의 마을

Reuse the village kit with a fountain/plaza and more NPC interaction points. Focus on comfort, prayer and service.

## Mobile budgets

- first zone payload: target <= 12 MB compressed
- player: target <= 30k triangles
- typical attachable equipment: target <= 5k triangles each
- hero/equipment textures: 1K typical
- repeated props: 512px typical
- instancing for repeated trees/flowers/fences
- selective realtime shadows
- capped device pixel ratio

## Mobile GPT development workflow

```text
ChatGPT mobile
 -> GitHub branch/tree commit
 -> Vercel Preview
 -> visual/runtime QA
 -> merge only after gate
 -> AI-3D worker job
 -> validated GLB
 -> S3-compatible/R2 asset storage
 -> runtime auto-load
```

Custom MCP apps are not currently available inside the ChatGPT mobile app, so development is orchestrated through connected GitHub/Vercel tools. The game-side AI3D worker itself remains a normal remote HTTP service and can later be wrapped by MCP when mobile custom-app support changes.

## YouTube validation

A current Tripo image-to-3D tutorial was reviewed as an external workflow reference. The useful lesson for Bible Friend is not the UI of that service but the production sequence: clean reference image -> model generation -> inspect topology/textures -> export -> optimize for the target runtime. For the mascot, the supplied front / 3-quarter / side / back reference sheet is preferable to a random single image because identity consistency matters more than generation speed.
