# s97 — L6 balance: keep the pressure, stop the massacre

## Result

The native complete policy passed seeds 1–3 at HIGH and LOW with the 8-second L6 pressure interval. All six routes completed; deaths were 0–1; saved survivors averaged **60.9%**, with a **48.3%** minimum. Each full 30-second window after the first hatch closed had at least **2 group attack starts**. The minimum was 2 (seed 3), with a minimum of 3 across HIGH seeds 1–2. The partial final windows are shorter than 30 seconds and are reported separately by the raw receipt; they are not counted as full cadence windows.

The sole gameplay-data change is `src/data/l6.ts`: `pressure.intervalS` changed from 12 to 8 seconds. Zombie health, damage, speed, attack rate, and all HIGH/LOW population caps remain unchanged. The native probe was extended to exercise both tiers, report completion/deaths/saved share/window cadence, and fail when a goal threshold is missed.

## Baseline and after

Baseline used the same native probe, complete policy, seeds, tiers, and 30-second window boundaries with the original 12-second interval. HIGH and LOW produce identical simulation results in this native harness, so each seed row is repeated across both tiers.

| Tier | Seed | Completed before → after | Deaths before → after | Saved before → after | Minimum full post-closure window before → after |
|---|---:|---|---:|---:|---:|
| HIGH | 1 | Yes → Yes | 0 → 1 | 20/29 (69.0%) → 19/29 (65.5%) | 2 → 3 |
| HIGH | 2 | Yes → Yes | 0 → 0 | 16/29 (55.2%) → 14/29 (48.3%) | 2 → 17 |
| HIGH | 3 | Yes → Yes | 0 → 0 | 24/29 (82.8%) → 20/29 (69.0%) | 2 → 2 |
| LOW | 1 | Yes → Yes | 0 → 1 | 20/29 (69.0%) → 19/29 (65.5%) | 2 → 3 |
| LOW | 2 | Yes → Yes | 0 → 0 | 16/29 (55.2%) → 14/29 (48.3%) | 2 → 17 |
| LOW | 3 | Yes → Yes | 0 → 0 | 24/29 (82.8%) → 20/29 (69.0%) | 2 → 2 |
| **All runs** | — | **6/6 → 6/6** | **max 0 → max 1** | **mean 69.0% → 60.9%; minimum 55.2% → 48.3%** | **minimum 2 → 2** |

Before, seed 2 ended 9.0 seconds into its final partial window with 0 attacks; seed 3 ended 14.2 seconds into its final partial window with 1. After, partial tails were 11.4–26.6 seconds and contained 4–20 starts. No full 30-second post-closure window fell below 2 in either run set.

Raw before/after ledgers: [baseline-native.json](baseline-native.json) and [final-native.json](final-native.json) (retained with this report; regenerate with `L6_TIERS=high,low L6_SEEDS=1,2,3 L6_POLICIES=complete node --import tsx/esm tools/qa/l6-pressure.ts`).

## Checks

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- Native balance probe across HIGH/LOW × seeds 1–3 — PASS; 6 runs, 0 balance failures.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L6 --maxWorkers 2 --out test-results/s97-final-threat` — L6 skilled and passive routes complete, 0 passive flags. Command exits 1 only for `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, because this invocation selects L6 alone.
- `sh tools/remote/run.sh "$PWD" -- npm test` — PASS on runner `46.225.66.90`: 27 files passed, 106 tests passed / 1 skipped; unchanged 150-case inventory; 223.3 s within the 240 s budget. The earlier unavailable-runner attempt was superseded by this successful run.

## Browser QA needed

No browser or real-input QA was run, per task instructions. The native probe verifies the requested simulation route and cadence; it does not establish human-play feel, visual readability, or WebGPU/WebGL behavior.
