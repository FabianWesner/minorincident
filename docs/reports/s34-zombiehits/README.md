# S34 zombie hits and attacks

**Goal met.** Ordinary infected now retain readable attack strike/recovery while moving and react visibly to hits. All visual evidence is reviewed; final code and scene gates pass.

## Cause and change

Ordinary infected left the simulation attack state on the strike tick. The renderer selected standing-only windup/swing clips, hiding the strike and recovery during moving lunges. Bullet reactions inherited the simulation's one-tick stagger and disappeared before a readable flinch.

The renderer now keeps attack presentation through 27 recovery ticks (0.45 s), following the Alpha approach. Bite-lunge, two-hand swipe, ground grab and riot shove gestures layer over locomotion. Dogs retain their embedded gather/spring/bite through recovery, with a 12 cm presentation-only spring arc. Fractional render time can precede the simulation strike by less than one tick; recovery caches bridge that boundary instead of deleting the strike.

Light hits have a directional 0.30 s visual recoil with a quick rise, independent of simulation stagger. Standing humanoid melee hits select authored left/right stagger clips. Moving/crawling figures retain their upper-body reaction; animals recoil through their deforming body/neck branch. Heavy knockdown/get-up behavior remains intact. Successive MG hits reset the short envelope, producing separate recoil/reset poses.

Nurse IK used stale bind-offset directions after retargeted animation changed joint offsets. The solver now uses current joint directions and lengths. Crawl/gallop contacts now match displayed gait and movement distance; dogs retain their declared paw soles and articulated contacts, and crawlers receive contact correction. Scene Lab now measures crawl and closes contacts across excluded knockdown/get-up gaps. The grounded threshold remains 1.2 cm; no test tolerances changed.

The audit's turned-person fixtures also replaced explicit `npc.*` appearances with random outbreak dressing. Scene Lab now preserves explicit looks, so the man, elderly and guard rows test their requested models.

No simulation stats, attack timing, damage, AI or replay state changed. Existing instanced meshes and pose atlases are reused; no draw calls were added.

## Matched measurements

All 24 final after rows pass day/night × low/high × WebGL2/WebGPU at game zoom 1.5. Both tiers and backends agree on these p95 values:

| Actor | Before day / night (cm) | After day / night (cm) | Limit |
| --- | ---: | ---: | ---: |
| Nurse | 4.4 / 1.5 | 1.8 / 1.8 | ≤ 3 cm |
| Crawler | 63.4 / 63.4 | 1.4 / 1.4 | ≤ 3 cm |
| Dog | 93.4 / 102.3 | 0.3 / 0.6 | ≤ 3 cm |

These runs use the same corrected measurement method on both source versions. Archived r31 measurements used a different contact summary and are not substituted for the matched baseline. Nurse night was already within the limit; it remains within the limit after the change.

All **136 main before/after pairs** have equal draw-call p50/p95/max, equal recorded simulation trajectories (frame/position/speed), and equal final simulation state, health, position and travel distance. All **22 supplementary pairs** also have equal draw-call summaries, simulation trajectories and final simulation results. Example: nurse day is 23/29/30 draw calls before and after, night 21/27/30. Exact foot rows and comparison counts are in [measurements.json](measurements.json).

## Opened visual evidence

All **272 main composites plus 44 focused composites** (952 strips) were opened and described in [visual-review.json](visual-review.json). Every entry has its renderer signature, exact frame windows and reviewed-image SHA-256. Final manifest validation found 316/316 matching records, with no missing/stale source signatures, windows or image hashes. Every capture's Scene Lab checks passed. Raw captures remain outside Git.

The main matrix covers 17 groups × day/night × low/high × WebGL2/WebGPU × before/after. Groups: nurse, crawler, dog, brute, armored, butcher, bloated, screamer, sprinter, suit/office, native BBQ, firefighter, hazmat, riot, turned man, turned elderly and turned guard. Each composite includes walk, attack and gun-hit strips at native game-camera pixels, zoom 1.5.

Before: humanoid windups generally fall directly into idle, crawler attacks stay nearly flat, and gun effects/health loss have little persistent body recoil. Dog bite motion already exists, but its recovery ends early. After: arm reaches/swipes and shield shove persist after contact, crawler raises a hand into a ground grab, dog gathers/springs/bites/settles, and head/chest or animal body recoil changes the silhouette. Night retains readable outlines with less surface detail. High-quality bloated smoke partly obscures surface detail; its outline and recoil remain visible.

Focused evidence:

- **20 MG composites:** nurse, crawler, dog, brute and turned man, before/after day/night. Two-tick sampling avoids aliasing gun cadence. After poses repeatedly reset and recoil; nurse torso pitch varies by about 12° and brute by about 15° within the sampled burst. Dog body/neck changes are visible although the humanoid torso metric does not measure that branch. Crawler's last samples include its existing lethal fall.
- **12 moving-attack composites:** sprinter, screamer and dog, before/after day/night. The selected moving frames record 4.92 m/s, 0.57 m/s and 4.91 m/s respectively. Sprinter windup layers over advancing legs; screamer retains its raised-arm recovery as walking resumes; dog retains its embedded bite/recovery. Exact speeds and frames are in the manifest and measurements file.
- **12 original close-view composites:** nurse, crawler and dog, before/after day/night, including bat and heavy-hit frames. Nurse selects `stagger-left` at frames 517/522/528, then `flung`/`knockdown` for the heavy hit. Crawler and dog visibly react to the bat, but die later in that sequence, so their frame-600 rows do not demonstrate a live heavy reaction. The original fixed close camera misses the early approach in the centre crop and crops some limbs; whole-body walking acceptance uses the complete game-camera matrix.

For entry `<configuration>/<scene>`, the opened composite is `test-results/s34-pairs/<configuration>/<scene>/review.jpg`; individual `strip-*.jpg` files and raw frames are beside it. Only frames named in `windows.json` constitute the final evidence. Crops preserve native pixels with no brightness or pose edits.

## Reproduction

`tools/qa/s34-capture.ts` serves the current renderer or Git baseline `e2db4c7e^` through Vite source overrides, without checking out files. It uses one headless Scene Lab browser via `tools/e2e-lock.sh`, port 4928, day `L1` and night `L8-zoo`. All main fixtures preserve their game camera, seed and combat inputs. Windows are calibrated from simulation state because night delays some approaches by approximately 114 ticks; the same saved windows serve both source versions and all tiers/backends. No fixture specs were edited.

```sh
SCENE_PORT=4928 E2E_UNITS=1 S34_SIDE=after S34_TIER=low S34_BACKEND=webgl2 \
  S34_TYPES=nurse,crawler,dog sh tools/e2e-lock.sh npx tsx tools/qa/s34-capture.ts
python3 tools/qa/s34-strips.py test-results/s34-pairs/after-webgl2-low
```

Use `S34_BURST=1` for the isolated initial MG, `S34_MOVING=1` for calibrated moving attacks, or `S34_CLOSE=1` for original close fixtures with bat/heavy frames. Burst mode changes only the fixture's scripted firing duration, with the same gun and unmodified infected stats.

## Validation

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass, including final capture tooling |
| `npm run lint` | Pass |
| `npx vitest run tests/shared/render-contracts.test.ts --maxWorkers=2` | 14/14 pass; assertions folded into existing cases |
| `npm run test:gate` | 107/107 pass on final renderer `25b9d576`, 116.0 s; 150-case accounting and 240 s budget respected |
| `SCENE_PORT=4928 E2E_UNITS=1 npm run scene:gate -- --jobs 1` | **62/62 pass**, 0 known, 0 not run, 9.3 min on final renderer `25b9d576` |
| Main/focused capture checks | 316/316 pass; all reviewed-image receipts match |
| Draw calls / simulation | 136/136 main and 22/22 focused pairs equal |

Logs are `test-results/s34-typecheck.log`, `s34-lint.log`, `s34-focused.log`, `s34-test-gate-final.log`, `s34-scene-gate-final.log` and the per-configuration capture logs. Full gate artifacts are in `test-results/scene-gate/`. Production renderer source has remained unchanged since `25b9d576`; later work is capture tooling and evidence only.

The exhaustive matrix and its refresh after the fractional-tick correction exceeded the initial approximately two-hour estimate. No raw captures, forbidden reference assets or specs are committed.
