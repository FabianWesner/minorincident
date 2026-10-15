# L10-Q2 Scene Lab consolidation

The matrix adds three missing finale timelines and reuses five shipped fixtures.
The mist scene now includes every zoo species plus dog/cat/crow/Alpha/runners and four
healthy controls. Numeric gates cover charge bands and pause/resume, explicit
once-only release, cure front/deaths/control health, rendered fan rotation,
playable movement/survivors/pull-out and visible title/credits. The seam fixture
reverses over its existing production terrain boundary. Gameplay is unchanged.

Scene Lab previously restored ending mission state without the campaign state
required by CampaignUI, and fixed stepping did not update that presentation.
The harness now attaches the existing campaign preset and updates its existing
UI after a fixed tick. The catalog also now honors trailing npm-script options;
previously `npm run scene:matrix -- --backend webgl2` silently kept WebGPU. Title/credits gates check visible UI, as well as mission
phase. `hud: true` also now mounts/updates the normal HUD; previously only
`megaHud` did so, leaving the minigun heat bar absent. Every mounted frame must
show its heat meter, within one percentage point of the simulation heat.
Checkpoint reconstruction suppresses a prior completed research recording in
these later fixtures; it had obscured the player for the first 15 seconds. No spec criteria or budgets changed.

## Reproduction

Build first (`npm run build`). Browser runs use headless Metal, a private
`SCENE_PORT`, `SCENE_SERVER=preview`, and `tools/e2e-lock.sh`, at most two
sessions. The Q2 selection is:

```
l10-minigun-heat,l10-cure-install-defend,l10-cure-mist,qa-l10-*,l10-region-seam
```

`npm run scene:matrix -- --filter '<selection>' --backend webgpu` and the
same command with `--backend webgl2` cover both qualities at zooms 0.5/1/1.5.
The default matrix retains all its existing entries. A single-slot catalog run
can use `E2E_UNITS=1 npm run scene:catalog -- --matrix --jobs 1 --backend webgpu --filter '<selection>'`.

The charge-radius fixture restores an active device with the courier exactly
25 m away, holds there, then runs outside and returns. The original installation
scene covers explicit activation input. The seam scene requires >110 m of
actual movement and a maximum X beyond 810 m; staying still cannot pass. The
mist requires populated rendered smoke puffs and zero per-tier cap violations,
alongside the authoritative front/death checks.

`npx tsx tools/scenelab/l10-q2-negative.ts webgpu` (under the browser lock) runs
broken charge/mist inputs and requires named gate failures. Both negative
specs inherit their production gates; they cannot appear in normal catalog
runs. Unit evaluator controls also reject each surviving species and injured
healthy actor independently.

## Validation and visual review

Final WebGPU sweep: 39/48 pass. WebGL2 sweep plus the corrected mounted-HUD
predicate rerun: 39/48 pass. All three new catalog fixtures pass every tier/zoom;
nine reused-fixture rows fail the unchanged zero-placeholder gate. All rows
stay under 300 draws / 500k triangles (observed maxima 86 / 277,203), and the
cure smoke pool never exceeds its 400/120 per-tier cap. These are renderer
counters, not native frame-rate measurements.

`typecheck`, `lint`, fresh production build and six focused Hetzner QA tests
pass. The full Hetzner unit suite passed 1,451 tests (seven skipped); the six
new tests ran separately after the last changes. Full sim/levels finished: 1,312 passed, two skipped, one 120 s timeout in the
unchanged high-tier Mega-arrival calibration. That case passed in 114.7 s with
both remote slots reserved (no timeout/budget changes). Real WebGL2 and WebGPU
negative controls reject both missing release and missing charge activation
through their named gates. `npm run verify -- E32` was started with remote sim
and bounded browser/quiet-run admission; 154 selected remote checks and all 57 browser tests pass. The overall command was stopped (exit 143) while its quiet-run performance
batch awaited admission/preflight. No performance test started. Browser-slot
waits across recapture and verification batches had exceeded 30 minutes, so
the lane released its own process group instead of extending the wait. The
quiet batch lasted about four minutes, below the 20-minute reservation cap.
Native E18 frame-time, sim-time and heap budgets remain **unmeasured** by Q2;
the renderer counters above do not establish them. No second quiet batch ran.

## Larger issue to carry to Q6

The high charge rows draw a console LOD1 stand-in when LOD0 is selected (one
frame in the initial sweeps, 100 in a cold WebGL rerun). All six seam rows draw
`bld.cure-security-post` and `veh.police-sedan` LOD2 while LOD1 is selected;
173–296 frames in the initial sweeps. The gate remains **zero**. Renderer tier
promotion/loading needs investigation on the existing real-time LOD walk
probe: accelerated Scene Lab stepping can amplify asynchronous load latency.
The unchanged minigun fixture also records 1–7 high-tier stand-in frames,
although its original expectations do not include a zero-placeholder gate.
This row does not change global preload or residency behavior. The complete
Q2 deploy gate is therefore **blocked** until those reused scenes pass.

The first remote sim sync failed on a copied cache `.git/index.lock`. The
worktree-specific cache lock was removed only after confirming no Git process
was running on that runner; retry synced successfully.

## Capture evidence

Final sheets and raw metrics: `test-results/epics/E32/l10-q2/webgpu-final/`
and `test-results/epics/E32/l10-q2/webgl2/`. The committed `matrix.json`
contains all 96 final row summaries; `captures/` preserves their contact sheets
in this commit, `captures.md` links each sheet, and `review.md` records the inspection.
The final GPU sweep completed its high tier before a helper incorrectly applied
the 30-minute admission cap to total run time. All 24 low rows were then
recaptured with admission-only timeout handling; manifests use completed metrics.
No aborted-row errors are counted as fixture failures.
