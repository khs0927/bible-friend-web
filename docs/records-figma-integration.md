# Records experience integration

The runtime records experience mirrors the approved Figma work in file `cqQhO3opkgUmaEgOPAEUt3` and uses the generated HQ source board `38:2`.

Runtime screens: Favorites, Favorite Detail, Favorites Management, Bible Verses, Verse Detail, Verse Search, Prayer, Prayer Writing, and Prayer Answers.

## Asset delivery

The active `RecordsExperience.tsx` resolves records visuals through `recordsAssets.ts`. The manifest maps the stable records asset names to the original durable CreativeClaw PNG URLs, so the app does not depend on a later workflow-generated local image tree. Original standalone PNG bytes remain PNG; the runtime does not resize them or convert them to JPEG.

The asset materialization workflow remains in the repository as a reproducible source-to-repo path, but runtime rendering is independently safe because every records image/background has a durable URL mapping.

## Persistence and navigation

Prayer entries persist the authored title, gratitude, prayer topic, prayer body, and category in localStorage and render those fields back in the prayer views. Favorites membership is also persisted and the displayed collection is derived from that stored membership.

Bottom-navigation handoff supports both buttons and anchors. Growth additionally falls back to `/growth-game` when an existing Growth navigation target is not found.

## Verification

During PR verification, a dedicated Vercel build ran `client/src/records/recordExperienceState.test.ts` together with the project's existing targeted tests: 5 test files / 28 tests passed, followed by successful Vite production and API esbuild bundles. After that verification, `package.json` was restored byte-for-byte to `main` so this records-only PR does not activate the unrelated Growth CI path solely because of a package-script change. The final runtime build therefore uses the repository's normal Vercel build command.

The repository-wide `pnpm check` currently reports pre-existing type errors in Growth/audio code outside this records integration, so it is tracked separately rather than used as the records merge gate.