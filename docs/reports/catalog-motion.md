# Catalog motion review

Lane: `catalog-motion`. Baseline: `81afbd5a`. Implementation commit: `48469afb`. No scene setup or existing expectation was changed. No deployment.

The requested baseline `test-results/scene-catalog/index.md` was absent in this worktree and the main checkout. A production build of the untouched baseline was captured with `SCENE_SERVER=preview SCENE_PORT=3357 npm run scene:catalog -- --out test-results/catalog-motion-before`. The untouched baseline artifacts are retained in that directory.

## Changes

- Kick poses retain their authored leg rotations. A sole contact correction lifts the pelvis only by the amount a heel or toe penetrates the floor.
- Companion follow steering anticipates the courier's velocity and accelerates when the courier departs. Warnings still play, but holding position yields to a departing courier. The companion's separation radius covers its full 1.67 m body.
- Ambulance and bus far tyres use 16 circumference segments and fewer sidewall rings; the ambulance tyre is centred on its axle. Existing LOD2 budgets remain 2,000 triangles: ambulance 1,868, bus 1,876. Previously the bus's six-sided tyre varied in support radius by 8.7 cm, and the ambulance's eight-sided tyre by 4.7 cm. Per-face ground settlement converted this into one-frame hub pops.
- Added corgi contact and running lag measurements to Scene Lab. Contact compares the drawn corgi trunk/head/muzzle capsules with the courier's body, including both legs. Running lag is projected along the courier's velocity while speed exceeds 2.5 m/s. Both gates require actual samples.

## Contact-sheet review

Before sheets supplied in the scheduler scratchpad were opened:

- `fight-kick-vs1`: f140/f300 show the kick extension and other cells show recovery/knockdown. The 2.2 cm sole penetration is too small to judge confidently from the 320 px tiles; the floor-contact metric locates it. Fighting bodies stacking is outside this lane.
- `fight-kick-vs3`: f144/f336 show kick extensions, with overlapping fighting silhouettes in several other cells. The 2.3 cm sink likewise needs the per-frame sole probe.
- `ped-walk-all`: all five civilian appearances remain distinct; the running woman moves farther than the walkers. A static sheet cannot prove a 7–15 cm planted-foot slide. The per-frame sole track is required.
- `corgi-follow`: f270–360 show the dog crowded against the courier's legs during a turn and departure.
- `corgi-behaviour`: f456–570 show the dog's head/body in the courier's legs; f285–342 and f684–798 lose the dog at the edge or entirely outside the view.
- `car-firetruck-drive`: f180–255 show the three moving vehicles. A one-frame hub pop is not reliably visible in snapshots taken 15 frames apart; the wheel metric and the rotating-tyre probe establish the defect.



The initial trace run used the CLI's 1280×720 viewport. This promoted every pedestrian to LOD1 and passed without exercising the defective far solver. That is diagnostic evidence only; catalog acceptance uses the original 960×540 viewport and setup. Baseline pedestrians 1/2 used LOD2 throughout, and pedestrian 3 switched between LOD2 and LOD1. Their slide maxima were 7.6/12.9/15.0 cm. The far contact arc now keeps the foot still near the ground at toe-off and touchdown, retains the arriving world contact, and releases planted shoe orientation during a reversal. World contacts and shoe headings now transfer between near/far solvers and between LOD batches; fading the leg solve toward the baked stride had moved planted shoes during these transitions.

The 1280×720 diagnostic sheets show:

- Both kick scenes retain the kick extensions, recovery poses and knockdowns (vs1 f140/f300; vs3 f144/f336). Sole sinking is 0 cm. No new apparent vertical hop at the sampled frames; the centimetre correction remains hard to judge at tile size.
- `corgi-follow`: f330 shows a separate head/body beside the courier; f390–450 keeps the dog close behind. At f270/f360 camera projection still places the dog behind the courier silhouette, but the measured body/leg capsules do not penetrate.
- `corgi-behaviour`: f270–360 and f690–810 keep the corgi visible during the runs. At f480–540 the corgi is behind the standing courier in camera projection; its nose/body no longer pass through the drawn legs. Overlap is 0 cm and running lag peaks at 2.82 m.
- Vehicles retain their body silhouettes and road contact through f180–255. The sheet cannot establish a one-frame pop; measured maximum hub spike is 1.7 cm and tread clearance is 0.1 cm.
- Pedestrians retain all five appearances, walk/run travel and the runner's reversal. This larger viewport's all-LOD1 result is not accepted as the far-LOD fix.

## Original catalog viewport review (960×540)

The five already-passing scenes were first opened from `test-results/catalog-motion-targeted/<scene>/sheet.jpg`. All six relevant sheets were then reopened from the final full run at `test-results/scene-catalog/<scene>/sheet.jpg`; the observations below also hold for those final sheets:

- Both kick sheets retain the authored extension and recovery. In vs3 the bodies still stack during fighting, as they did before; this lane does not claim to fix that. The small sole lift does not create an obvious hop in the sampled cells.
- `corgi-follow` f270–360: the dog turns with a distinct body beside/behind the courier. At f270/f360 their silhouettes overlap in projection; the dog is behind the legs, with no capsule penetration. It stays visible throughout the sheet.
- `corgi-behaviour` f285/f342 and f684/f741/f798: the corgi stays in frame behind the running courier. At f456/f513 it is still partly occluded by the standing courier in projection. At f570 its head is visibly separate. The new spatial overlap gate is 0 cm and running lag is 2.82 m.
- `car-firetruck-drive` f180–255: tyre and body silhouettes remain intact; the tyre sidewalls were simplified within the existing triangle allowance. A static 15-frame sheet cannot establish the absence of a one-frame pop. The per-frame wheel gate is 1.7 cm against the unchanged 3 cm limit.

- Final `ped-walk-all` f0–570 retains all five appearances and the original travel paths; the running woman approaches the far/right edge at f418 and reverses, returning by f570. At f266/f304 the feet remain visible through the LOD transition. There is no obvious planted-foot snap or collapsing figure in the sampled cells. A static sheet cannot establish slide magnitude: original-viewport per-frame maxima for the three formerly failing figures are now 1.7/2.1/1.1 cm. Their LOD exposure is unchanged (ped1/2: 600 far frames each; ped3: 275 far and 325 mid frames).

Only new gates were added to the three authorized QA scene specs: 1 cm kick sink, 1 cm corgi/courier overlap, and 4 m running lag. No existing threshold was raised, removed or bypassed.

## Validation

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm run build`: pass.
- `sh tools/remote/run.sh "$PWD" -- npm run test:unit`: 109 files, 390 tests passed (final implementation).
- `npx vitest run tests/unit/render/catalog-motion.test.ts --maxWorkers=4`: six regression tests passed: the two tyres, kick sole/pose preservation, far walking and both same-batch/separate-batch footwork transitions.

- `SCENE_PORT=3367 npm run scene:catalog`: **96/97 passed**, vs baseline 92/97. Comparing both JSON indexes by scene name gives **zero new red scenes**. The process exits 1 solely for the unchanged out-of-scope `inf-looks` sink (8.3 cm / 1 cm). `fight-kick-rack` inherits the new gate from `qa-courier-attack-kick.json` and also passes.

| Scene | Final metric | Gate limit |
| --- | --- | --- |
| fight-kick-vs1 | sink 0.4 cm | 1 cm |
| fight-kick-vs3 | sink 0 cm | 1 cm |
| fight-kick-rack | sink 0.1 cm | 1 cm (added) |
| ped-walk-all | slide 2.1 cm; sink 0 cm | 6 cm; 2 cm |
| corgi-follow | overlap 0 cm; running lag 2.80 m | 1 cm; 4 m (added) |
| corgi-behaviour | overlap 0 cm; running lag 2.82 m | 1 cm; 4 m (added) |
| car-firetruck-drive | wheel spike 1.7 cm; clearance 0.1 cm | 3 cm; 2.5 cm |

- `E2E_PORT=3377 npm run test:smoke`: six simulation smoke tests and **25 browser tests passed**.
- `E2E_PORT=3377 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L1.spec.ts tests/e2e/levels/L2.spec.ts tests/perf/l2-budgets.spec.ts tests/perf/l2-neighbor-budgets.spec.ts --project=chromium --workers=2`: **9 passed, 2 failed**. All three L1 checks, L2 campaign transition, high-tier L2 performance and four neighboring-level measurements passed. Failures: L2 real-input courier died before reaching `{-64,2}` (last position `{-63.94,-19.77}`); low-tier L2 peak median was 97.5 ms against 33.33 ms, with a 65.8 ms gate-close hitch against 50 ms. These failures are being checked against the untouched baseline and in serial.
- High-tier L2 performance: peak p95 **10.2 ms / 14 ms**, reveal **45.2 ms / 50 ms**, gate close **18.7 ms / 50 ms**, **239 / 600** view draws and **1,054,619 / 1,500,000** triangles.

### L2 baseline comparison (both builds, serial on the Mac)

An archive of untouched `81afbd5a` source/public assets was built in `test-results/catalog-motion-baseline-source`, using the same installed dependencies. The temporary archive/build was removed after retaining the results. These runs also use `tools/e2e-lock.sh`, headless Chromium and Metal.

- Baseline: `E2E_PORT=3378 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L2.spec.ts --project=chromium --workers=1 -g T-E20-18`: **1 failed**. The courier dies near `{-64.53,-21.28}` on the side route, then cannot travel to `{-31,30}`. The current build's courier dies in the same area, but fails on the preceding waypoint. This establishes a baseline playthrough failure; it does not establish identical combat outcomes.
- Current: `E2E_PORT=3379 sh tools/e2e-lock.sh npx playwright test tests/perf/l2-budgets.spec.ts --project=chromium --workers=1 -g low`: **1 failed** on the gate-close hitch, **79.5 ms / 50 ms**. Frame median **24.6 ms / 33.33 ms** passes, as do reveal **37.4 ms / 50 ms**, firefighter count 6, view draws **240 / 300** and triangles **384,734 / 500,000**.
- Baseline: the same low-tier command with `E2E_PORT=3380`: **1 failed** on firefighter count (**5 / 6**, before the performance assertions). Its recorded gate-close hitch is also over the existing limit (**66.5 ms / 50 ms**). Median **32.3 ms**, p95 **46.6 ms**, reveal **38.1 ms**, draws **241**, triangles **391,868**. Current p95 is **30.4 ms**. These are individual timing runs; they support no frame-time regression, but do not prove the larger current one-off gate hitch is harmless.

Proofs retained under `test-results/catalog-motion-l2-{current,baseline}-error.md`, `test-results/catalog-motion-l2-perf-low-{serial,baseline}.json` and `/tmp/catalog-motion-*.log`.

## Remaining acceptance limits

All four requested catalog groups pass, and the full catalog has no new red scene. All before/after sheets for the lane were reviewed. Existing gates and scene setups were preserved; only the requested QA gates were added. Unit/static/smoke checks and L1 browser checks are green.

**The entire requested validation set is not green.** L2 real-input already fails on the baseline. Low-tier L2 performance also fails baseline acceptance, and the current build still exceeds the gate-close hitch limit. No combat, level placement, gate, or test change was made to force those checks through. The unrelated baseline `inf-looks` catalog failure remains. These L2 failures need follow-up before claiming full acceptance; the numeric gate hitch in particular is still a limitation, despite lower steady frame times.

No other spec deviation, dependency addition, push, merge into main or deployment.

