# Code seams 2 — G02/G07 and S01–S04

Reference: `d595b84a0` (latest main, including L4 respawn and Scene Lab gate tooling); original capture/audio reference: `b55bfc632`. Branch: `lane/code-seams-2`.

SceneLab keeps runtime coordination while `missionFixtures.ts` owns five mission setup stages. AudioService keeps AudioGraph/playback ownership while `AudioEventMapper` owns the ordered event reactions and their policy state. L4 acquires required combat/infected capabilities at mission construction; optional features remain nullable. The profiler validates reflective methods without type assertions. CrowdLocomotion borrows one reusable named presentation input per batch (16 arguments → 3, no per-figure options allocation). VFX uses 20 discriminator entries and 19 guarded implementation handlers, preserving the feedback/disabled-effects prelude.

## File lines

| File | Before | After |
| --- | ---: | ---: |
| `src/debug/scenelab/SceneLab.ts` | 1755 | 1636 |
| `src/debug/scenelab/missionFixtures.ts` | 0 | 161 |
| `src/audio/AudioService.ts` | 1113 | 780 |
| `src/audio/AudioEventMapper.ts` | 0 | 390 |
| `src/sim/world/SimWorld.ts` | 433 | 443 |
| `src/sim/missions/LevelFourWar.ts` | 1399 | 1405 |
| `src/debug/performance/profileCpu.ts` | 55 | 56 |
| `src/render/characters/CrowdLocomotion.ts` | 351 | 361 |
| `src/render/CrowdView.ts` | 756 | 771 |
| `src/render/npc/CivilianCrowd.ts` | 609 | 639 |
| `src/render/vfx/Vfx.ts` | 559 | 623 |
| `tools/crowdfoot/harness.ts` | 130 | 133 |

## Evidence

- `npm run typecheck`, `npm run lint`, `npm test`: pass; 22 files / 85 unit cases. No tests changed or added.
- Type assertions in the touched runtime files: 98 → 95; none added.
- Audio: all 182 GameEvent types / 1,860 event/context cases dump identically before/after, including cue options, ordered side effects, and adapter policy state (`test-results/code-seams-2/cues-{before,after}.json`).
- Crowd footwork: seeded sweep matches main byte for byte across five body/scale cases; empty/combat/full capability probes pass.
- Structural proof: each VFX discriminator resolves to its original body, all five moved fixture bodies match after host-name normalization, the audio event body matches after port-name normalization, combat acquisition follows the installer, and the crowd solver body has identical tokens (`test-results/code-seams-2/structure.json`).
- L1/L4/L10 seed-1 completion bots against the original reference: all complete; hashes `aee81f05` / `cb0f4d73` / `5eb2f9cd` and complete JSON reports match byte for byte. Fresh before/after runs after the L4 merge also match complete JSON reports byte for byte: `aee81f05` / `3e0dd566` / `5eb2f9cd`. The subsequent main merge only changes QA tooling.
- Scene Lab: 10 scenes, WebGL2/Metal, high/low, authored zoom matrix; **56/56 capture hashes and gate outcomes identical**, 50 pass / 6 pre-existing coffee-prop failures on both sides. The exact reference combines the completed native reference rows (29) with the original shared reference rows (27); every row records its source in `evidence.json`. Lane high/aim-assist rows use native captures (31); the other low-tier rows use the latest shared batches (25). Two low-tier aim rows match across launch modes. Shared GPU repeats also show tiny aim-assist pixel differences between two main captures; repeatability across launch modes is not claimed. The full shared low-tier repeat has 28/28 equal gate outcomes and 26/28 equal captures; the two aim-assist differences also occur between unchanged-main repeats. No interrupted batches remained.
- `npm run test:smoke`: **6/6 pass**, 128 s, including genuine unflagged WebGPU. The saved browser launch log confirms the final WebGPU launch omits `--enable-unsafe-webgpu`. This completed before the main L4-only rebase; smoke scenes exercise L1.
- Perf A/B: pending for the orchestrator's quiet window, as allowed by the common brief. No per-frame object allocations were introduced for named crowd input.

Reproduction helpers: `node docs/reports/code-seams-2/structure.mjs`; `node --import tsx docs/reports/code-seams-2/cues.mjs`; `npx tsx docs/reports/code-seams-2/bots.ts`. Run each helper in the matching source checkout; the bot helper uses local source imports. Full raw receipts stay under `test-results/code-seams-2/`.

The image equivalence check caught a stale capability reference in the initial accessor slice: `installL1Outbreak` may replace combat. Commit `9cfc178cf` acquires it after installation; the previously differing close-zoom aim capture then matches main exactly. The shader-clock diagnostic was discarded without changing runtime or capture behavior.

Browser cleanup: exclusive reference-low was cancelled, no exclusive reservation remains, and the extra baseline worktree was removed. Further scene checks use direct catalog commands through shared pool admission, one browser and two scene names per batch. No timing claims: perf pending.
