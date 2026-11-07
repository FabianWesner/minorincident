# r2-l10perf — L10 first-use charge hitch

## Item status

| Item | Status | Evidence |
|---|---|---|
| L10 high first-use hitch near charge tick 260 | Cause fixed; post-fix perf pending | `CrowdView.loadBatch` warmed streamed living batches before preparing their sibling static corpse pages. The first settled body could therefore build a `corpse_*` palette graph during play. Prepared corpse pages now enter the same hidden compile queue after creation. Fix commit: `fd0c66b`. |

## Measurements

The prior `perf8` report measured the L10 high maximum at **250.0 ms** on the candidate and **216.6 ms** on PROD at charge tick **260**. Its CPU diagnostic saw material graph builds up to **32.7 ms** and identified late `corpse_pal_picketWhite` builds. These are the before numbers, not a post-fix result.

Post-fix maximum frame and cold load are **not measured**. The targets remain **≤66 ms** at the reported tick and **≤6 s** cold load. A fresh high-tier probe was attempted through `tools/perf/quiet-run.sh`; the browser-pool daemon could not bind its local socket (`listen EPERM`), and the legacy quiet path's process scan failed with `spawn EPERM`. The observed host load was 3.97; no 20-minute load interval was established. Do not treat the performance target as verified.

## Checks

- `npm run typecheck` — passed.
- `npx eslint src/render/CrowdView.ts src/render/characters/StaticCorpses.ts` — passed.
- `git diff --check` — passed.
- `sh tools/perf/quiet-run.sh node --import tsx /private/tmp/mi-l10-perf.mts` — not admitted; browser-pool socket bind failed with `EPERM`.
- `E2E_LEGACY=1 sh tools/perf/quiet-run.sh node --import tsx /private/tmp/mi-l10-perf.mts` — not admitted; quiet process scan failed with `spawn EPERM`.

No deploy or push.
