# S34 zombie hits and attacks

Acceptance is **in progress**. Renderer implementation and required code gates pass. The exhaustive matched visual matrix, focused moving/burst proof and final evidence aggregation are still being completed. Do not treat this checkpoint as goal completion.

## Cause

Ordinary infected left the simulation attack state on the strike tick. Selecting only the standing windup/swing clip hid the strike and recovery, especially during a moving lunge. Bullet reactions inherited the simulation's one-tick stagger and consequently disappeared before a readable flinch.

Nurse foot contacts used stale bind-offset directions in the limb solver after retargeted animation changed joint offsets. Crawler stride/contact handling did not match its crawl, and the Scene Lab metric excluded crawl entirely. Dogs mixed gallop poses with trot contact cadence/offsets, bypassed articulated paw correction on declared soles, and left their bite clip before its recovery. The in-place bite also needed a presentation-only airborne arc.

The audit's turned-person fixtures had another coverage bug: outbreak dressing replaced explicit `npc.*` looks with a random resident. The fixture now preserves its requested appearance before dressing. Production spawning and infected stats are unchanged.

## Change

- Keep a render-only attack phase through 27 recovery ticks (0.45 seconds), following the existing Alpha approach. Layer bite-lunge, two-hand swipe, ground grab and riot shove gestures over locomotion.
- Hold light-hit recoil for 0.30 seconds independently of simulation stagger, with a quick rise and direction in body space. Select authored left/right standing melee staggers by hit side; moving hits retain upper-body recoil. Existing heavy knockdown/get-up behavior remains.
- Apply animal recoil to the deforming body/neck branch so a dog hit changes its silhouette at game zoom. Preserve the embedded bite through recovery, with a 12 cm render-only spring arc.
- Use the current joint offsets for IK directions and lengths. Match crawl/gallop contact phase to the displayed gait and actual movement distance, retain declared paw soles, and solve crawler contacts.
- Measure crawl contacts and close a contact across excluded knockdown/get-up frame gaps. The 1.2 cm grounded threshold and all acceptance tolerances are unchanged. Existing test cases cover both genuine contiguous sliding and the excluded-frame gap.

No simulation stats, attack timing, damage, AI or replay state changed. The renderer keeps the existing instanced meshes and pose atlas.

## Matched measurements

The completed WebGL2 low/high game-camera rows currently give the following p95 values. Both tiers agree for these rows; WebGPU aggregation is pending.

| Actor | Before day / night (cm) | After day / night (cm) | Limit |
| --- | ---: | ---: | ---: |
| Nurse | 4.4 / 1.5 | 1.8 / 1.8 | ≤ 3 cm |
| Crawler | 63.4 / 63.4 | 1.4 / 1.4 | ≤ 3 cm |
| Dog | 93.4 / 102.3 | 0.3 / 0.6 | ≤ 3 cm |

These are matched runs using the same corrected measurement method on both source versions. The archived r31 numbers used a different contact summary and are not substituted for the matched baseline. Nurse night was already within the limit; the change fixes its failing day row while keeping night within the limit.

The earlier 24-row after matrix also passed all day/night × low/high × WebGL2/WebGPU rows. Its maximum p95 was nurse 1.8, crawler 1.4 and dog 0.3 cm. The current paired runs include the final stronger animal recoil and different screenshot/readiness windows; their current dog night value is 0.6 cm. Final acceptance will use the complete paired matrix.

All 34 completed low-WebGL2 pairs have identical draw-call p50/p95/max and identical final simulation state, health, position and travel distance. For example, nurse day is 23/29/30 draw calls both before and after; night is 21/27/30. Full 136-pair aggregation remains pending.

## Visual evidence and reproduction

`tools/qa/s34-capture.ts` serves the current renderer or Git baseline `e2db4c7e^` through Vite source overrides, without checking out files. It uses one headless Scene Lab browser through `tools/e2e-lock.sh`, on port 4928. All game fixtures retain camera zoom 1.5, seed and combat inputs, with day `L1` and night `L8-zoo`.

The night preset delays some approaches by about 114 ticks, so fixed timestamps missed attacks. Capture windows are calibrated from simulation state: four moving approach samples, windup start, final windup tick, strike+8 and strike+24, plus bullet-hit samples. The same saved windows serve both source versions and all quality/backend settings. No fixture specs were edited.

Example invocation:

```sh
SCENE_PORT=4928 E2E_UNITS=1 S34_SIDE=after S34_TIER=low S34_BACKEND=webgl2 \
  S34_TYPES=nurse,crawler,dog sh tools/e2e-lock.sh npx tsx tools/qa/s34-capture.ts
python3 tools/qa/s34-strips.py test-results/s34-pairs/after-webgl2-low
```

The full matrix covers 17 groups × day/night × low/high × WebGL2/WebGPU × before/after = 272 scene composites, each containing walk, attack and hit strips. Groups are nurse, crawler, dog, brute, armored, butcher, bloated, screamer, sprinter, suit/office look, native BBQ look, firefighter, hazmat, riot, turned man, turned elderly and turned guard.

Opened composites and per-strip descriptions are recorded in [visual-review.json](visual-review.json), together with source signatures and exact frame windows. For an entry key `<configuration>/<scene>`, the image is `test-results/s34-pairs/<configuration>/<scene>/review.jpg`; individual strips are beside it. Crops preserve native camera pixels; no brightness or pose edits are applied. Only the frames named in each `windows.json` constitute the matched matrix; other files can be historical captures.

Reviewed so far: all 68 low-WebGL2 before/after composites and all 34 high-WebGL2 after composites. High-WebGL2 baseline review and both WebGPU matrices are underway. Before strips show windups falling directly into idle and little sustained gun recoil. After strips show held post-strike gestures and backward chest/head reactions; crawler grab and dog spring/settle are distinct. Night retains the action silhouettes with less surface detail. High-quality discharge smoke partly covers bloated surface detail, while its silhouette and recoil remain visible.

Focused supplementary modes: `S34_BURST=1` isolates the initial MG with unchanged infected stats and samples every two ticks, avoiding aliasing the gun cadence. `S34_MOVING=1` selects an actual moving windup and records its speed. `S34_CLOSE=1` uses the original close fixture. These modes require their own opened-strip records before acceptance.

## Validation

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass, including capture tooling |
| `npm run lint` | Pass |
| `npx vitest run tests/shared/render-contracts.test.ts --maxWorkers=2` | 14/14 pass; assertions folded into existing cases |
| `npm run test:gate` | 107/107 pass on `167385ab`, 108.1 s, within 150-case accounting and 240 s budget |
| `SCENE_PORT=4928 E2E_UNITS=1 npm run scene:gate -- --jobs 1` | **62/62**, 0 known, 0 skipped, final renderer `008ad99d`, 9.2 min |

Logs: `test-results/s34-typecheck.log`, `s34-lint.log`, `s34-focused.log`, `s34-test-gate-final.log`, `s34-scene-gate-final.log`. Full scene-gate artifacts are in `test-results/scene-gate/`. Renderer source has remained unchanged since `008ad99d`; subsequent changes concern capture tooling and evidence only.

Historical investigations and superseded measurements remain available in the earlier report commits, particularly `217588c4`. No raw captures, forbidden reference assets or specs are committed.
