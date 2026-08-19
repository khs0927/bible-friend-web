# WordLight Kotlin Full-Stack QA Report

Date: 2026-08-19

## Managed deployment

- Vercel deployment: `dpl_AAXkGp6Q5j2o5gHPhieuB6ajKthh`
- Git branch: `feature/kotlin-wordlight-preview`
- Git commit: `1c1a12baa64d0b017b06672519794d98ca256cc7`
- Runtime: Vercel Container → Eclipse Temurin JRE 21 → Ktor/Netty
- Deployment state: `READY`

## Build verification

Vercel managed build completed successfully:

- `:web:compileProductionExecutableKotlinJs`
- `:web:jsBrowserProductionWebpack`
- `:web:jsBrowserDistribution`
- `:server:processResources`
- `:server:jar`
- `:server:installDist`
- `BUILD SUCCESSFUL`
- Produced `wordlight.js` and packaged it into the Ktor server distribution.

## Runtime verification

Vercel runtime logs confirmed:

- Java 21 runtime
- Ktor application started successfully
- Server responding on platform-assigned port
- `GET /api/health` → `200 OK`

## Responsive visual QA

The same Kotlin UI layout and deployed CSS were rendered in Chromium at the target viewports.

### Desktop

- Viewport: 1440×1200
- 8 topic cards rendered
- 6 featured verse cards rendered
- No horizontal overflow
- Hero, daily verse, topics, verse grid, meditation note and footer visually verified

### Mobile

- Viewport: 390×844
- 8 topic cards rendered in single-column mobile layout
- 6 verse cards rendered in single-column mobile layout
- No horizontal overflow
- Search, daily verse card, topics, verse list and meditation note remain readable and touch-friendly

## Kotlin logic checks

A Kotlin/JS-compiled test copy of the repository logic returned:

- Health payload: `ok=true`
- Bootstrap: 6 featured verses / 8 topics
- Search `사랑`: 4 results
- Topic `평안`: 3 results

## Notes

The repository remains a Draft PR so the existing `main` application is not changed until review. Bible verse text is currently demo content; production launch should connect a licensed Bible dataset/API.
