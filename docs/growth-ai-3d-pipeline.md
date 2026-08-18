# Bible Friend Growth — Mobile GPT AI-to-3D Pipeline

## Product rule

- **성장 홈:** 2D/2.5D illustrated UI for speed, readability, and low mobile GPU cost.
- **모험 지역:** explorable 3D RPG scenes.
- **One character identity:** the same Bible Friend design must be preserved across 2D art, 3D model, equipment, animation, and UI portrait.

## Mobile-only orchestration

```text
ChatGPT Mobile
  -> GitHub (source of truth)
  -> image concept generation
  -> AI-3D provider adapter
      -> Tripo (optional hosted provider)
      -> TripoSR / InstantMesh (open-source worker option)
  -> GLB validation/optimization
  -> Bible Friend asset manifest
  -> 3D RPG runtime
  -> Vercel preview / mobile QA
```

The user should never need Blender on the phone. ChatGPT/GitHub orchestrate jobs and the game consumes optimized GLB assets.

## Character pipeline

1. Generate a canonical front / 3/4 / side / back character sheet.
2. Keep costume silhouette, hair shape, face proportions, cream tunic, blue sash, and sandals stable.
3. Create an image-to-3D task.
4. Prefer a game-friendly low-poly result for mobile. Tripo P-series is suitable when a face limit is required.
5. Export/use **GLB** as the runtime master format.
6. Run topology/size validation and optional Draco/KTX2 compression before publishing.
7. Add rig and animations (idle, walk, run, pray, read, encourage, shield, sword, hurt/recover, celebrate).

## Equipment pipeline

Each equipment item uses the existing stable IDs:

- `belt_truth`
- `breastplate_righteousness`
- `shoes_peace`
- `shield_faith`
- `helmet_salvation`
- `sword_spirit`
- `crown`

Each ID has tiers `0..5`. Generate equipment as separate attachable GLB files when possible so the base character is not regenerated for every combination.

Suggested output paths:

```text
client/public/assets/growth/3d/character/bible-friend-base.glb
client/public/assets/growth/3d/equipment/shield_faith/lv1.glb
client/public/assets/growth/3d/equipment/shield_faith/lv2.glb
...
client/public/assets/growth/3d/equipment/crown/lv5.glb
```

## Environment strategy

Do **not** generate one giant background mesh. Split the world into reusable modules:

- terrain / path
- house / chapel shell
- door / window
- table / chair / bed / shelf
- Bible / bread / grape / cup / candle
- tree / bush / flower / fence / lamp
- rocks / desert props
- NPC character set

This reduces download size and lets the same assets appear in multiple regions.

### 말씀의 집

Hybrid approach: reusable house GLB + furniture props + procedural floor/lighting. Interactive hotspots: Bible table, prayer corner, spiritual meal, exit door.

### 평안의 길

Reusable village kit: path pieces, fences, trees, flower clusters, small homes, fountain, lamp posts, NPCs. Missions: greet, encourage, help.

### 광야

Procedural terrain + reusable rocks/cacti + lightweight shadow-enemy silhouettes. Avoid expensive full character models for distant enemies. Gameplay uses Scripture proclamation / shield / prayer choices.

### 회복의 마을

Reuse village kit with fountain/plaza variations and more NPC interaction points.

## Tripo adapter

`server/ai3d/tripo.ts` implements an optional server-side Tripo adapter. It uses `TRIPO_API_KEY`; never expose this key to the browser. The adapter creates an async image-to-model job and polls task status until a GLB URL is ready.

Hosted generation is optional. The same orchestration contract can be backed by an open-source TripoSR or InstantMesh worker later.

## Runtime performance budget

Target iPhone/Android mobile browser first:

- initial growth home: no 3D engine required until entering a region
- each zone initial GLB payload target: <= 12 MB compressed
- player character: <= 30k triangles for first release
- each equipment item: <= 5k triangles typical
- repeated props: use instancing
- textures: prefer 1K for hero/equipment, 512px for repeated props where possible
- cap device pixel ratio in realtime 3D
- render shadows selectively

## Release gates

1. `pnpm test`
2. Vite production build
3. Vercel preview READY
4. `/growth-game` visual check on iPhone-sized viewport
5. `/growth-adventure/home` movement and interaction check
6. no fatal/error runtime logs from growth routes
7. production deploy only after preview passes
