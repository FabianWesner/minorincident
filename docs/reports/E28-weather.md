# E28 weather lane report

Implementation commits: `978fd3f2`, `325d5956` (weather presentation, live lighting, authored blackout variants and remote sim verifier support).
Baseline: `cf758240`, branch `lane/e28`.

## Implemented

Seeded sim weather with campaign tables and overrides; wetness/drying, gust impulses, delayed lightning/thunder and minimap reveals; rain/fire/noise/grip/sight/speed modifiers; GPU rain and snow/ash; up-facing accumulation and bounded footprint atlas; height fog, light flashes and wet streaks and growing puddle masks; rain ripples, snow breath and wind streaks; foliage/grass gust strength; rain/gust/thunder sprite bank and weather reverb, snow/wet footsteps and rain on nearby metal cars; completed-level replay controls, paused weather control and HUD icon. Added weather-lab/storm-street, nine game-camera Scene Lab fixtures and one catalog entry for each.

## Validation

- Typecheck, lint and production build: **pass**, including the final presentation changes.
- Remote full unit suite plus weather sim: **422 passed**, 117 files (413 existing unit checks + 9 weather sim checks), capped at four workers.
- Remote weather/weapons/explosions regression: **90 passed, 6 skipped**; duplicate initial Molotov hazard damage was fixed by reusing the existing hazard spread path.
- Remote verifier sim selection: **15 passed, 968 skipped**, 192 files. `MI_VERIFY_REMOTE_SIM=1 E2E_SLOTS=1 E2E_PORT=3428 npm run verify -- E28` uses the existing remote runner for heavy Vitest and the normal local browser selection.
- Browser verifier: **47/47 passed** (21 weather checks + 26 smoke checks), no retries, across Chromium, mobile and WebKit; final verifier exited 0.
- Existing `tests/e2e/levels`: **19/19 passed** in the combined run; that run's only two failures were new weather gain timing and fog contrast assertions, both subsequently corrected and passing.
- Scene catalog: **9/9 passed**, zero console errors, all final game-camera sheets opened and reviewed.
- Browsers were headless, Metal WebGL2, own port 3428/3429, through the shared lock, at most two workers. WebGPU is not claimed as manually validated.

## Acceptance results

A passing capture-generation assertion does not replace visual approval. E28 remains **in-progress**.

| AC | Result | Test/evidence |
|---|---|---|
| 01 | Partial | T-E28-01/01b: identical Node/browser seeded weather stream and campaign keys; actual redesigned L6 night exit is missing. |
| 02 | PASS | T-E28-02: real pistol radius 20 m, Molotov duration ×0.6 and Rapier wheel friction ×0.85. |
| 03 | PASS | T-E28-03/03b: saturation ≥0.8 in 60 s, 90 s drying half-life; actual dry/wet material mask and reflections captured. |
| 04 | PASS | T-E28-04/04b/04c: positioned strikes, 40 m/30 tick reveal, distance-delayed thunder, reduced flash and scripted fire/blackout. |
| 05 | PASS | T-E28-05/05b: sight ×0.6; actual player mask vs 2 m ring contrast **3.175:1**, 7,585 player pixels. |
| 06 | PASS | T-E28-06/06b/06c: 20 spread trials on one seed, real gust prop displacement, smoke wind alignment within ±20°. |
| 07 | PASS | T-E28-07/07b: player/infected sim tracks and grip; actual up-facing roof **99.89%**, car top **99.31%** accumulation; track texels **14→61**. |
| 08 | PASS | T-E28-08/08b/08c: all weather kinds across all six mission graphs, both completed replay UI paths; first-play override ignored. |
| 09 | PASS | T-E28-09/09b: rain gain 0.3 at intensity 0.3, gust/delayed-thunder cue log and snow footsteps; offline RT60 clear **0.591 s**, fog **0.511 s**, snow **0.393 s**. |
| 10 | Partial | T-E28-10 high/low storm budgets pass; specified L5 pair-plaza and quiet before/after evidence unavailable. |
| 11 | PASS | T-E28-11/11b: HUD state and 6 m ray radius; actual ray precipitation pixels **10,730→3,099** with dither. |
| 12 | FAIL | T-E28-12-* generates all six required moods; reviewed checklist G fails wall-occlusion proof and atmospheric shafts. See committed review. |

## Performance

| Scenario/tier | Particles | Draw calls | Triangles | Browser heap |
|---|---:|---:|---:|---:|
| storm-street high | 20,000 | 92 | 217,917 | 364 MB |
| storm-street low | 6,000 | 92 | 52,105 | 225 MB |

These pass the tested E18 structural/heap gates. Nine isolated weather-lab catalog scenes range **47–52 draw calls / 201,568–281,568 triangles**.

**L1/L2/L3 before/after: not measured.** Baseline `cf758240` was built in a detached worktree and the paired headless regression runner prepared. The Mac stayed above load 3 (observed roughly 3.4–18), including the final ten-minute quiet-window wait, which exited 75. Busy-machine frame times are not accepted as regression evidence. `tests/perf/weather-regression.spec.ts` remains available for the eventual quiet comparison. The temporary baseline worktree was removed.

## Captures reviewed

Opened all nine final catalog `sheet.jpg` files (frames 0/60/120): clear, overcast, haze, storm, fog, snow, ash, rain, wind. Clear is brighter and more sharply shadowed than corrected overcast; haze has warm amber ground and long purple shadows; storm/fog/snow have blue ground, orange practical light pools and visible courier/threats; ash is lower density and gray-violet. Also inspected full-size fog player, snowy tracks, wet reflections, flash and scripted blackout captures. Blackout removes warm window/lamp lighting while the strike fire remains lit.

The reference `initial-drafts/weather-and-time-of-day-moods.png` was opened. Golden haze lacks its sun shafts; wet streaks are overly regular, footprint stamps coarse, and the fog hero fill too pale. Checklist G: **3/4 must, 2/3 should**; this fails the required every-must and ≥70% should gate. Scene loading tests are green without asserting vision approval.

Durable evidence: `test-results/epics/E28/catalog/`, `review.md`, selected numeric JSON files and verifier checks. Full-resolution diagnostic PNGs remain locally under the same epic directory.

## Deviations / remaining work

- L5 still has the legacy hold-line mission; the specified L5 pair-plaza is an E23 dependency. L4 pair-plaza is not substituted for that performance gate.
- L6 still has the legacy town/helipad mission; the night-exit anchor is an E24 dependency. Weather supports that anchor when supplied, but actual tunnel-to-exit integration is unverified.
- Photo weather selection uses paused game controls because this baseline has no separate photo mode.
- Quiet L1/L2/L3 regression comparison requires load <3; no before/after claim is made.
- AC12 needs an E25 wall-occlusion capture and atmospheric golden-hour shafts, plus art refinement of wet stripes/footprints/fog fill.

No mission logic, existing acceptance thresholds, dependencies or protected references were changed. Only the required Deviations section was appended to the epic. No multi-seed bot battery, deployment, push or main merge was performed. Feature HEAD before this evidence commit: `325d5956`; final lane HEAD is reported with delivery (a report cannot contain its own commit hash).
