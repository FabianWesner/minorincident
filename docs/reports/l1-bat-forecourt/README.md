# L1 bat forecourt — PO 2026-10-15

**QA BLOCKED — not ready for integration.** Implementation is committed; the escape/pressure simulations and final visual/performance gates have not run. No measured before/after attacker count or escape time is claimed.

Scope: intake #3 (cannot leave the garage), #5 (bench blocks the bicycle), #4b (spread the horde, keep its population), and #3's unrelated-building transparency note. Source: `epics-pipeline/po-bugs-1015.md`; the binding #4b quote is “Overall L1 is fine, keep the nr of Zombies; just don#t put them all to the place where I get the baseball stick, since I cannot freely move there and cannot escape”.

## Changes

- `f03a2c655`: the rotated physics footprint of displaced furniture cannot occupy the garage's required fence opening. Physics motion, explicit placement and checkpoint restoration return an obstructing prop to its authored home before its blocker is published. Other prop movement remains physical. The navigation regression tips a bench through four orientations and restores a blocked saved pose.
- `390a5715e`: three local pursuers may approach the courier at the bat forecourt. Excess approaches are distributed over the existing street groups. The rule ends outside the garage area; civilian fights outside it continue. Population, spawn counts/caps, damage, speeds and recovery tuning are unchanged. The regression uses checkpoint `bat`, seed 1, courier `(22.94,35.60)`, 28 live infected and a toppled bench, on both quality tiers. It measures stationary pressure, then walks to the bicycle with 90 HP and normal damage, requiring a fence crossing and bicycle interaction within 20 seconds.
- `3aa041b05`: solid see-through eligibility follows the particular placement between camera and courier, across all LODs. Other placements sharing its material stay opaque. Window power and occlusion share an instance buffer to preserve the portable WebGPU vertex-buffer limit, and immutable vertex arrays remain shared. Short drawn LOD props also stay opaque when their manifest height is taller (the recycling-bin case found by the unchanged zero-cut-low-props matrix gate). The focused regression [fails on the original source](seethrough-before.txt) because the unrelated neighbour remains eligible, and [passes after the change](seethrough-after.txt).

## Validation

| Check | Result |
| --- | --- |
| Typecheck / lint / fresh production build | Pass |
| Focused visibility regression | 1/1 pass; same regression fails on the original source because the unrelated neighbour is eligible for the cut |
| Bench connectivity, checkpoint restoration, 28-infected pressure and bicycle escape regressions | Unmeasured: remote job queued for over 30 minutes without starting |
| Full unit / sim / level suite | Unmeasured: runner capacity exhausted; timing reservation released, then functional run also could not acquire capacity |
| First WebGL2 matrix | 0/12: six bench cases flagged one short recycling-bin LOD; crowd ring hit a collider and subsequent scene loads failed. These findings led to the drawn-height correction and 28 navigation-checked spawn points in `25d03f6b4` |
| Corrected WebGL2 matrix | Did not acquire browser slots before its bounded retry expired |
| WebGPU matrix | Did not acquire browser slots; cancelled after the cumulative browser wait reached the 30-minute policy limit |
| L1 browser checks / `verify E19` / E18 frame and sim budgets | Unmeasured; no budget or test threshold was relaxed |

All three Hetzner runners were full. Autoscaling tried all three regions and failed with **Primary IP limit exceeded**; see [runner log](remote-functional.txt). The [short regression log](remote-regressions.txt) never reached a Vitest run. Browser slots were held by another lane's quiet-run reservation waiting for Mac load to fall. The [WebGL2 retry](webgl-retry.txt) and [WebGPU attempt](webgpu.txt) did not start a corrected scene. This lane's waiting jobs were cancelled and its reservations released before handoff.

Scene Lab catalog: `tests/scenes/catalog/l1-bat-forecourt-bench.json` and `l1-bat-forecourt-crowd.json`. Both use the game camera, the shipped Grove layout and production L1 simulation rules. The crowd scene retains all 28 infected at either quality tier. The bench scene tips the shipped bench into the gap and exercises the production clearance guard. The requested matrix covers high/low, zoom 1.0/0.5 (plus the standard far zoom) on WebGL2 and WebGPU.

## Capture review

I opened all four requested WebGL quality/zoom bench sheets from the diagnostic run. The courier becomes visible as the garage opens; the neighbouring house keeps its opaque wall and roof. The picket-fence opening is clear, and the bench stays beside the public road after the displacement command. At zoom 0.5 the courier and corgi are large enough to read individually; at zoom 1 the street, fence and garage apron remain visible together. Low quality has simpler foliage/shadows, with the same opening and prop position.

| Diagnostic capture | Zoom 1.0 | Zoom 0.5 |
| --- | --- | --- |
| High | [sheet](diagnostic-webgl2/bench-high-z1.jpg) | [sheet](diagnostic-webgl2/bench-high-z0.5.jpg) |
| Low | [sheet](diagnostic-webgl2/bench-low-z1.jpg) | [sheet](diagnostic-webgl2/bench-low-z0.5.jpg) |

These captures precede the final recycling-bin correction and explicit bicycle fixture. They are diagnostic evidence, not acceptance captures of the final candidate. The [first matrix index](diagnostic-webgl2/index.json) preserves its failures. The corrected scenes also place the courier's bicycle outside the fence at `(24.8,32.9)`; that final fixture has not been captured.

## Remaining validation commands

Run the short regressions first when a runner slot is available. Measure `maxAttackers` and `PO bike escape seconds` from their output; verify 28 remain alive, both quality tiers pass, and the courier crosses the fence before bicycle interaction. For the before measurement, use the same tests/fixture on an isolated checkout of `f03a2c655^`.

```sh
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/levels/l1-bench-exit.test.ts tests/levels/l1-forecourt.test.ts tests/levels/L1.test.ts --maxWorkers=2
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4

# Fresh build first; run the two matrices as separate batches.
npm run build
SCENE_SERVER=preview SCENE_PORT=34871 E2E_UNITS=2 npm run scene:catalog -- --matrix --filter 'l1-bat-forecourt-*,seethrough-*' --backend webgl2 --jobs 2 --out test-results/l1-bat-forecourt/webgl2-final
SCENE_SERVER=preview SCENE_PORT=34873 E2E_UNITS=2 npm run scene:catalog -- --matrix --filter 'l1-bat-forecourt-*,seethrough-*' --backend webgpu --jobs 2 --out test-results/l1-bat-forecourt/webgpu-final

E2E_PORT=34875 sh tools/e2e-lock.sh npx playwright test levels/L1.spec respawn-bat --project=chromium --workers=2 --retries=1
E2E_PORT=34877 sh tools/perf/quiet-run.sh npx playwright test tests/perf/l1-budgets.spec.ts tests/perf/l1-street-budgets.spec.ts --project=chromium --workers=1
MI_VERIFY_REMOTE_SIM=1 E2E_PORT=34879 npm run verify -- E19
```

Keep the existing 20-minute quiet-run reservation limit and 30-minute browser-slot wait limit. Release between batches. The timing project in the full remote suite must also finish before claiming E18 sim budgets.
