# PO #32 / #37 — shotgun power and physics debug

Implemented the two fixes. Feature validation passes; repository gates retain **two unit and three E23 failures**, all reproduced with the original weapon/damage code from `7cf1b48bf`.

## Changes

- **#32:** PhysicsWireframe requires `?debug=physics`. `?debug` retains the debug panel, copy button and aim cone. Commit: `cc2334a15`. Its existing browser test now resets the saved character between fresh-profile branches; every assertion is retained.
- **#37:** shell damage **150 → 240**, spread **12° → 4°**, full damage through **8 m**, falling to 10% at **10 m**. Knockback **0 → 1.8 m**, stagger **0.3 → 0.65 s**. Eight pellets, 2 shots/s and 18 m maximum range stay in place. Each player shot adds a camera kick through the shared preference/flash-reduction path; it uses the existing muzzle flash and sound event (#36 owns audio).
- Current toughness is 1.5× the intake's base HP: firefighter **210**, Alpha **300**. Seven of eight close pellets deal 210; a centred Alpha shell deals 192 after its existing 0.8 multiplier, so two close shells deplete HP. **Alpha recovery retains E07's existing rule.** Ordinary human shotgun victims stay dead in L5–L10; L10 was missing from the previous exception.
- Enemy HP, toughness, resistances, speed, damage, populations and placements were not edited. The Mega Alpha's conventional-damage floor is retained. No specs, assets or protected directories were edited.

## Validation

| Check | Result |
| --- | --- |
| Typecheck, lint, fresh production build | Pass |
| Focused shotgun sim | **6/6 pass**: all ordinary human roles (base HP ≤140), 2/8 m, L5/L10, 21-second permanence; Alpha shove/stagger/two shells; MG recovery retained |
| Full reference weapon TTK | Pass; shotgun armored/butcher **1.617 s**, gorilla **2.117 s** |
| Spread group of ten at 10 m | MG **6.033 s**, shotgun **14.617 s**: MG **2.423× faster** (required ≥1.5×) |
| Browser checks | Aim cone normal/explicit and shotgun pickup/ammunition HUD pass; pause debug/copy/negative branch passes after its profile reset fix |
| Final Scene Lab | **48/48 pass**, zero console errors: normal debug 18/backend, explicit physics 6/backend; high/low × zoom 1.5/1/0.5 on actual WebGL2 and WebGPU |
| Native L5 performance | Both existing tier tests pass; numbers below |
| Full unit sweep | **1499 passed / 3 failed / 7 skipped**; the old 200-damage assertion was then replaced by an exact 240 shotgun pin, and its data test file passed **3/3**. The other two failures reproduce on old code. |
| `npm run verify -- E23` | **58 passed / 3 failed**; all three failures reproduce on old code (below). |

The fixed-distance DPS fixture anchors its target so the new shove cannot change the measured distance. Three shotgun heavy-target TTK windows have faster, tighter expectations. The tuning guard now pins shotgun damage to **exactly 240**; all other weapons retain the 200 ceiling. Performance ceilings and spread-group requirements were not raised.

## Before / after bots

Seed 1, standard existing ordinary-input policies, independent level presets; all runs complete. Values are **simulation seconds**. `L5-complete` is the complete policy; other rows are newbie. Baseline restores the original catalog and Damage implementation in a private runner job; the candidate worktree is kept intact.

| Run | Before s | After s | Δ s | Deaths before → after |
| --- | --- | --- | --- | --- |
| L5 | 258.983 | 258.983 | +0.000 | 0 → 0 |
| L6 | 260.117 | 260.117 | +0.000 | 0 → 0 |
| L7 | 519.917 | 519.917 | +0.000 | 0 → 0 |
| L8 | 132.217 | 132.217 | +0.000 | 0 → 0 |
| L9 | 126.833 | 126.833 | +0.000 | 0 → 0 |
| L10 | 1570.017 | 1572.183 | +2.167 | 0 → 0 |
| L5-complete | 153.017 | 153.017 | +0.000 | 0 → 0 |

L5 newbie and complete outcomes/times/deaths are unchanged, as required by #29. L10 is **2.167 s slower (+0.14%)**, with no death change. These single-seed standard routes show no campaign speed-up; they are not an exhaustive balance battery. The L5 policy does not prefer the shotgun, so the close-hit and spread-group fixtures provide direct weapon coverage. The helper calls the existing `runLevel` library because the CLI allowlist omits L7.

## Native performance

Headless Chrome / ANGLE Metal, one worker, `tools/perf/quiet-run.sh`, isolated ports 34781–34784. Reservations were released between batches, with a gap; none lasted 20 minutes.

| Tier | Median / p95 / max frame ms | Draw calls | Triangles | Existing limits |
| --- | --- | --- | --- | --- |
| High | 7.2 / 9.6 / 14.9 | 322 | 731134 | p95 ≤14 ms; max ≤50 ms; 600 draws / 1.5M triangles |
| Low phone emulation, 4× CPU throttle | 24.3 / 35.9 / 57.3 | 235 | 312168 | median ≤33.33 ms; max ≤80 ms; 300 draws / 500k triangles |

Native timing is WebGL2. Both backends pass the functional/counter matrix. Evidence: `test-results/shotgun-power/native-perf/l5-{high,low}.json` and `perf-conditions.jsonl`.

An initial broader all-level sweep was stopped after weather, L4, follower and high-horde timing failures; the required unit suite, feature tests and level comparisons were run separately. Its contended high-horde timings were not isolated and are **not claimed green**. Runner capacity was saturated and autoscaling failed at placement/IP limits. No budgets were relaxed.

## Inherited gate failures

| Gate | Failure | Old-code control |
| --- | --- | --- |
| Unit placement-solids | L4 sandbag pallet 66 overlaps privacy fence 147 | Same failure |
| Unit occluder-footprint | Mock view lacks `cutPlacements`; `.add` throws | Same failure |
| E23 `T-E23-09` | Follower measured 4.152 m/s against 3.9 limit | Same failure |
| E23 `T-E23-bots` | Low-tier fixture has one death instead of zero | Same failure |
| E23 PO #21 restore | Found survivor count 3 instead of expected 2 | Same failure |

Controls: `test-results/shotgun-power/baseline-l5-checks.json`, `baseline-remnants.json`. Other raw evidence: `unit.json`, `actions-unit.json`, `focused.json`, `e23-verify.json`, `shotgun-roles.json`, `ttk.json`, `baseline/`, `after/`. Repository gates remain red; this is not deploy approval.

## Visual review and captures

Reviewed game-camera sheets from both tiers, both zooms and backends. The firefighter flashes white on impact, moves backward and falls after one shell. The Alpha's bar drops on each shot, with a visible stagger/shove and second-hit fall. Muzzle flash/tracer and red impact particles read at zoom 1; low quality has fewer particles and simpler meshes. The 8 m close fixture centres the victim, cropping the distant courier. The Alpha's far boot edge crops after its second shove at zoom 0.5; zoom 1 frames its full fall. These are framing limits, not missing body geometry.

`debug=true` shows no collider rings. `debug=physics` visibly restores the capsule and ground-axis wire lines. The three new catalog scenes are included in `scene:matrix`.

| Scene | WebGL2 | WebGPU |
| --- | --- | --- |
| po-shotgun-impact, high, zoom 0.5 | [sheet](captures/po-shotgun-impact-webgl2-high-z0.5.jpg) | [sheet](captures/po-shotgun-impact-webgpu-high-z0.5.jpg) |
| po-shotgun-impact, low, zoom 0.5 | [sheet](captures/po-shotgun-impact-webgl2-low-z0.5.jpg) | [sheet](captures/po-shotgun-impact-webgpu-low-z0.5.jpg) |
| po-shotgun-eight-metres, high, zoom 0.5 | [sheet](captures/po-shotgun-eight-metres-webgl2-high-z0.5.jpg) | [sheet](captures/po-shotgun-eight-metres-webgpu-high-z0.5.jpg) |
| po-shotgun-eight-metres, low, zoom 0.5 | [sheet](captures/po-shotgun-eight-metres-webgl2-low-z0.5.jpg) | [sheet](captures/po-shotgun-eight-metres-webgpu-low-z0.5.jpg) |
| Alpha, high, zoom 1 | [sheet](captures/po-shotgun-impact-webgl2-high-z1.jpg) | [sheet](captures/po-shotgun-impact-webgpu-high-z1.jpg) |
| Courier, debug=true, high, zoom 1 | [sheet](captures/po-debug-courier-webgl2-high-z1.jpg) | [sheet](captures/po-debug-courier-webgpu-high-z1.jpg) |
| debug=true, high, zoom 0.5 | [sheet](captures/debug-info-webgl2-high-z0.5.jpg) | [sheet](captures/debug-info-webgpu-high-z0.5.jpg) |
| debug=physics, high, zoom 0.5 | [sheet](captures/debug-physics-webgl2-high-z0.5.jpg) | [sheet](captures/debug-physics-webgpu-high-z0.5.jpg) |

Full matrices: `test-results/shotgun-power/{webgl2-reviewed,webgpu-final,physics-webgl2,physics-webgpu}/index.{md,json}`.
