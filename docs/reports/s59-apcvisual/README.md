# s59 APC visual fixes

## Render changes

- **Rear roof part:** runtime ray picks identify the reported bracket as the loose weapon rack in `L9Props`. It used latest simulation position and yaw while the APC used interpolated position and full chassis rotation. Attached rack now uses the same interpolation and pitch/roll. Across alpha 0/.25/.5/.75/1, original relative translation spans **0.2599866 m**, fixed **0.000001718 m**, in all four backend/tier configurations.
- **Flames:** the replacement APC armor roof inherited the transparent glass material, with depth writes disabled despite opacity one. Roof now has an opaque, depth-writing material. Flame cards draw before transparent glass and retain depth testing. The roof blocks fire while windshield glazing draws over flames behind it.
- **Ramp tyres:** terrain contact fitting pulled front wheel pivots down by **2.058 m** toward the road beneath the ramp (local Y -1.419). Fitting now applies only to supported tyres and only lifts penetration, preserving the suspension pose (local Y 0.639 in the matching overpass frame).
- **Red marks:** blood coverage is applied in the existing vehicle paint shader. Dents/cracks are appended to the roof geometry draw range. No separate coplanar blood decal draw is introduced. Ridden APC reveal is disabled, so courier x-ray is not causing the seated cab artifact.

No gameplay changes; `LevelNineDriving.ts` unchanged. No mesh/draw added. Controlled flame matrix measures **43 draws before and after** in all eight rows.

## Opened before/after evidence

All below are under `test-results/s59-apcvisual/`:

- `fire-full-matrix.jpg`: 16 cells, before/after × WebGL2/WebGPU × high/low × zoom 1/1.5. Opened: the old flame tongue overlays armor; fixed armor rejects it and glazing retains the visible fire behind the windshield. Every row passes console/backend/quality/draw checks.
- `overpass-matrix.jpg`, `ditch-matrix.jpg`, `wreck-pile-matrix.jpg`, `embankment-matrix.jpg`, `creek-bank-matrix.jpg`: each opened, four backend/tier before/after pairs. Old tyre loss is visible at each sampled ramp lip; after tyres remain visible. All r33 captures report actual airborne poses and zero page errors.
- `rack-before-after.jpg` and `rack-after-matrix.jpg`: opened. Rack alignment matches the measured interpolation improvement above.
- Raw `night-before-*` / `night-after-*`: r33 tool uses explicit authored `L9-crossing` preset, static zoom 1/1.5, air and landing zoom 1.5, all four backend/tier configurations. Raw `fire-before-*` / `fire-after-*`: both zooms and all configurations.
- `roof-picks/meta.json`: runtime identification of rack mesh. `night-*/meta.json`: physics wheel contacts/suspension, rendered wheel positions and rack interpolation matrices.

The flame fixture includes a fire inside the cab and an infected in the fire behind/beside it. Scene Lab fixture files are `tools/qa/s59-apcvisual/fire-z1.json` and `fire-z1.5.json`.

## Checks and limitations

- Typecheck and lint passed after rack fix (`typecheck-final.log`, `lint-final.log`).
- Full scene gate: **62/62 passed**, zero known/not-run, 14.4 minutes (`scene-gate.log`, `test-results/scene-gate/`). This run preceded the rack interpolation fix; controlled rack matrices above cover that later change.
- Prescribed remote `sh tools/remote/run.sh "$PWD" -- npm test` failed twice by reservation/test timeout, 240.5/241.4 s against 240 s; it is **not green** (`remote-test.log`, `remote-test-final.log`). No assertion failure reported before termination, but the suite did not finish.
- Earlier local `npm test` passed 107 tests/27 files in 211 s. Fresh local run finished **106 passed / 1 failed** in 208.6 s: `tests/engine/navigation.test.ts:121` exceeded its existing 30-second timeout (33.7 s). No simulation files changed. Log: `local-test-final.log`.
- Headless only, one browser via `tools/e2e-lock.sh`, ports 4961/4962. Owned servers stopped after capture runs. No push/deploy/merge.

Opened all five ramp matrix sheets: before tyres disappear at sampled ramp lips, after tyre silhouettes remain visible in all four configurations. Rack drift is 0.2599866 m before versus 0.000001718 m after in every configuration.

Remote suite timeout and the fresh local navigation timeout remain unmet acceptance checks. Visual evidence and source fixes are committed; do not represent this report as a green remote acceptance run.

Targeted recheck of the only local failure: `node node_modules/vitest/vitest.mjs run tests/engine/navigation.test.ts --project default --configLoader runner --maxWorkers=1` passed **4/4**, 30.15 s total, existing per-test timeout unchanged (`navigation-recheck.log`). This supports contention sensitivity; it does not replace the required full green suite. Render-only constraints rule out changing navigation or raising budgets. A healthy dedicated CPU runner/window is needed to finish full-suite acceptance; the execution-budget blocker has recurred across remote retries and the local full run.
