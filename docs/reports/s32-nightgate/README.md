# s32-nightgate

## Final acceptance

The final curated night gate contains 12 rows: the seven-animal L8-zoo lineup with separate actor crops/checks and two controls, the isolated L8-zoo lion regression proof, and the production L10-night Mega, each on low/high and WebGL2/WebGPU at game zoom 1.5. All 12 rows ran under one-browser reservations in **1.4 minutes** (20/20/23/19 seconds per batch), with no missing work. Idle, walking and hit samples are retained. Individual animal scenes remain available for diagnosis.

The gate deliberately exits 1 on the current broken renders: isolated lion standard deviation 10.3–10.4 < 14; lineup gorilla 11.4 < 14 on every combination. Daylight reference minima were lion 38.78 and gorilla 51.87. Isolated infected dog/regular controls passed at 15.38/23.02; grouped controls also pass the size-qualified gate (body diagonals 1.66/1.71 m). The metric records every actor regardless of eligibility, and gates body diagonals >= 2 m on luma spread and distinct 5-bit RGB buckets per crop pixel (floor 0.005). Crop backgrounds can influence this diagnostic; the isolated lion row preserves the calibrated proof.

Evidence: `test-results/s32-nightgate-acceptance/summary.md` and per-row `metrics.json` / `sheet.jpg` (untracked). Opened lion, gorilla, dog, Mega and final lineup sheets; all final lineup subjects are visible. No raw captures are committed. The zoo night failures remain untriaged, so a render fix must genuinely clear the gate.

Typecheck and lint passed; focused gate-tools tests passed 8/8; `npm run test:gate` passed 107 tests across 27 files in 87.7 seconds, with the total collection at 150/150 cases. Final fixture changes affect JSON and documentation only; no renderer or sim/stat code changed. Setup, JSON execution and diff checks passed. This final acceptance supersedes the chronological progress notes below.

## Cause

The curated Scene Lab deploy gate did not include L8 animal bosses under the `L8-zoo` preset or the L10 Mega under `L10-night`. The existing zoo boss specifications used daylight presets, so the flat, pale night renders were not measured by the gate.

## Changes in this worktree

- Added ten candidate night scenes: seven infected animal bosses, the production Mega pursuit, and dog / regular infected controls. The boss scenes use the game camera at zoom 1.5 and script idle, walking, then hit states where the fixture supports those states.
- Added 40 gate rows spanning both quality tiers and both backends.
- Added a Scene Lab diagnostic that records luminance standard deviation and distinct 5-bit RGB buckets within the actor's projected bounds crop.
- Documented the new check in `docs/qa/deploy-gate.md`.

## Before / after measurements

| Measurement | Before | Current candidate |
| --- | --- | --- |
| Night boss rows in curated gate | 0 | 40 rows across 10 scenes |
| Lion / gorilla night crop luminance standard deviation | Not captured | Not measured: headless Scene Lab could not start |
| Lion / gorilla distinct colour buckets | Not captured | Not measured: headless Scene Lab could not start |
| Dog / regular infected night controls | Not captured | Not measured: headless Scene Lab could not start |
| Gate runtime increase | 0 | Not measured |

The current JSON thresholds (10 luminance levels and 8 distinct buckets) are provisional. They are not calibrated evidence and do not yet prove the required lion/gorilla failures or dog/infected passes. The capture and contact-sheet review remain required.

## Checks

- `npx tsc --noEmit`: pass.
- `npm run lint`: pass.
- `git diff --check`: pass.
- Scene spec JSON parse and gate-list audit: pass (40 rows, 10 scene names, evenly split between WebGL2 and WebGPU).
- Requested headless Scene Lab capture (SCENE_PORT 4912): blocked; browser pool failed to bind `127.0.0.1:4329` with `EPERM`.
- `npm run test:gate`: failed under host load at the 240-second budget; L4 contact, world systems, and navigation tests timed out. No passing suite result is claimed.
- Required slim-worktree command: blocked writing the shared `.git/worktrees/s32-nightgate/config.worktree` (`Operation not permitted`).

This report records incomplete work. Do not treat this candidate as a calibrated or accepted gate until captures run, thresholds are calibrated, the contact sheets are opened, and the required checks pass.

## Full-access continuation

The required slim-worktree setup now succeeds. The four-row WebGL2 low calibration run completed in 39 seconds using one headless browser on SCENE_PORT 4912. Lion and gorilla contact sheets were opened and inspected.

- Lion: minimum crop luminance standard deviation 10.41; minimum distinct RGB buckets 101; provisional gate passes (incorrect for the intended regression check).
- Gorilla: minimum crop luminance standard deviation 7.80; minimum distinct RGB buckets 86; provisional gate fails.
- Regular infected: minimum crop luminance standard deviation 23.02; minimum distinct RGB buckets 79; provisional gate passes.
- Pet dog: measurement errors because PickBodies has no registered projected bounds. A real body-bounds fallback is required.

These results replace the earlier socket-access blocker. Calibration, dog bounds, colour-bucket share, body-size eligibility, fixture pose verification, the full matrix, final checks and commit remain unfinished. Evidence is under test-results/s32-nightgate-calibration (untracked captures).

## Daylight calibration

Added daylight reference scenes for lion and gorilla. Both completed on WebGL2 low: minimum luminance standard deviations were 38.78 (lion) and 51.87 (gorilla), versus 10.41 and 7.80 at night. The infected dog night control completed and passed with minimum 15.38, while the regular infected night control had minimum 23.02. Raised the provisional luminance threshold from 10 to 14. Recorded colour-bucket share and posed body extent for further eligibility calibration. Full matrix and final validation remain pending.

## First complete night tier

All ten WebGL2 low rows ran to completion in 93 seconds (one browser). Elephant and gorilla failed luminance; dog and regular infected passed. The first run exposed lion's longest-axis extent as 1.97 m; body-size reporting now uses the bounds diagonal, so the next run must re-prove lion eligibility and failure. Added gate-run --filter support for running the curated night rows directly. Colour-bucket gating now compares distinct bucket count / crop pixel count (floor 0.005). Runtime is above the desired added-matrix budget and still needs optimization; other backend/tier combinations remain unrun.

## Verified size-rule regression proof

Re-ran the four controls with diagonal body extent and bucket-share gating. Completed in 38 seconds: lion FAIL (10.4 < 14), gorilla FAIL (7.8 < 14), infected dog PASS, regular infected PASS. The dog contact sheet was opened. Evidence: test-results/s32-nightgate-size-proof. Added explicit idle/walk/hit timeline to the production Mega fixture and reduced its duration to 90 frames; that revised Mega fixture still needs capture verification.

## Complete backend / tier matrix

The curated gate runner completed all 40 night rows with one browser per reservation: WebGL2 low/high and WebGPU low/high. No rows were missing. Lion (10.3–10.4) and gorilla (7.8) failed on all four combinations; dog, regular infected, zebra, and the revised Mega fixture passed on all four. Elephant, flamingo, lioness and monkey also failed the current threshold. The WebGPU high Mega sheet was opened. Total wall time was 5.5 minutes (batches 85/79/86/79 seconds), so the requested ~2-minute added runtime budget is not yet met. Current typecheck and lint passed before the final child-launch portability change; final recheck remains required. The runner now launches children through process.execPath with --import tsx, avoiding dependence on npm's PATH.

## Context reuse runtime experiment

Added opt-in catalog --reuse-session and enabled it for bounded gate batches. All 40 rows re-ran, with no missing work and unchanged regression verdicts. Wall time improved from 5.5 to 4.6 minutes (batch totals 73/62/75/65 seconds), still above the ~2-minute added runtime requirement. Context reuse alone is insufficient; scene reconstruction remains the dominant cost. Final checks and commit remain pending.

## Tool validation

Typecheck and lint passed. Focused gate-tools validation passed all eight cases with Vitest capped at two workers. Renamed the threshold field to colourBucketShareMin to state its unit correctly; the numerical threshold and observed results are unchanged. This commit remains a work-in-progress candidate: runtime target and a passing test:gate result are still outstanding.

## Passing full test gate

Re-ran npm run test:gate after the environment recovered from the earlier timeout. It passed: 27 files, 107 default-project tests, 87.7 seconds against the 240-second budget. Collection remains at 150/150 cases across projects. Typecheck, lint, focused gate-tools tests, full night matrix execution and capture review now have passing execution evidence; the deliberate night visual failures remain visible. The only unresolved acceptance constraint is reducing added scene-gate runtime from 4.6 minutes to approximately two minutes without reducing animal/pose/tier/backend coverage.

## Shared fixture candidate

Added a nine-subject L8-zoo lineup with separate per-actor crops/checks, plus the existing L10 Mega row. All eight tier/backend rows completed in 1.1 minutes, meeting the runtime target. Opened the WebGPU high lineup; adjusted positions to screen axes after the first version clipped the regular control. The reframed candidate ran all eight rows again in 1.1 minutes. It still needs final review: lion's grouped crop passes on some combinations despite the established isolated lion failure, so grouped crop contamination/lighting must be resolved before acceptance. Individual per-species scenes remain available, and the earlier 40-row isolated proof remains valid. Grouped fixture/list changes are not yet committed.

## Separated lineup

Moved the courier away from measured crops, enlarged the synthetic slab to contain its position, and returned zoo actors to idle at frame 31 after the walking sample. The eight shared-fixture rows completed in 0.9 minutes across both backends/tiers, with gorilla failing and both controls passing. The grouped lion remains sensitive to the changed composition; retained its proven isolated regression row on all four combinations instead of changing thresholds. The resulting 12-row list still needs its final measured run, documentation counts, validation and commit.
