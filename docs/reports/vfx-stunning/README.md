# VFX stunning — implementation and evidence

Status: implementation complete; QA in progress. No deployment or merge. Native E18 timing and the blast-hitch comparison require the permitted quiet window and are not claimed here.

## Research and changes

[Research](research.md) surveyed the requested techniques and selected seven improvements that reuse existing materials and fixed pools: ballistic spark ribbons, short muzzle stars/cover glints, expanding coherent dust, a feathered pressure ring, radial scorch, rising ember trails, and directional blood droplets. WebGL2 and WebGPU use the same TSL graphs. No external assets, dependencies, copied artwork or new licences.

`FxPool` adds discrete masks and camera-plane ballistic alignment. `Vfx` reduces muzzle/continuous-fire particle density and adds bounded metal contact feedback from existing vehicle events and actual cover-query endpoints. `Blasts` uses the same dust/spark/scorch slots and fixes ember height on raised ground. The existing noise fire, lit smoke volumes, detached metal, hit-stop and distance based shake remain the foundation.

Low quality keeps the new silhouettes with 512 general particle slots, 120 volume puffs and reduced emission rates; high uses 2048 and 400. Fire emitter bursts drop from 24 to 8 high / 6 to 2 low, muzzle flashes use fewer fragments, and contact bursts emit 12 / 3 sparks. Sparks/flash emission follows flash reduction. Full/Reduced/Off gore and retained bodies use the existing policy. No damage, difficulty, simulation, L5, post effects, lighting or weather changes.

## Reproduction

Scenes are automatically discovered in `tests/scenes/catalog/vfx-*.json` by `scene:catalog --matrix --filter 'vfx-*'`. They cover barrel explosion, rifle, shotgun, cover impacts, Molotov/fire at night, Alpha melee hit, gore, vehicle wreck and actual APC/metal contact. Damage gates prevent the combat fixtures from passing with empty swings. The first fixture drafts exposed a wrong axe identifier and missing aim input; both were corrected before the final comparisons.

`tools/scenelab/vfx-stunning.ts before|after` runs the nine scenes at high/low, zoom 1/.5, WebGL2/WebGPU with one headless browser. `VFX_DIST` serves an immutable build, `VFX_BACKEND` / `VFX_FILTER` limit a batch. Run after a fresh build through `tools/e2e-lock.sh` with unique SCENE_PORT/E2E_PORT. Baseline is the unchanged initial build; comparison builds are isolated from active captures. Timing is Scene Lab CPU sim + render submission, not GPU frame time.

## Visual review

Final side-by-side sheets and per-effect costs are recorded below after QA completes. Early review: the baseline ring is a solid geometric band; the new ring feathers into the floor. Bright ballistic streaks give the blast a readable direction, and the existing fireball/afterfire timing stays legible. The close gore view shows the body still on the ground with accumulated blood; no corpse is removed.

## Validation and limitations

Typecheck/lint/build logs are adjacent. Heavy unit/sim/level checks run on Hetzner; browser checks use fresh production builds on this Mac, headless Metal, at most two workers and shared browser locks. No quiet-run reservation has been taken at night. E18 limits are unchanged; Scene Lab draw/triangle checks are evidence for these isolated effects only. Native frame p95, GPU cost and blast hitch are unmeasured until an authorized quiet batch (maximum 20 minutes, release between batches). No atmosphere hook is required; distortion and extra muzzle light sources were deferred in the research because their render-pass/light cost needs measurement.

## Vehicle follow-up retained for the next lane

The APC-on-sedan roll/overlap exists in the unmodified baseline: [baseline full sequence](sheets/vehicle-roll-before.jpg) and [comparison full sequence](sheets/vehicle-roll-after.jpg), WebGL2/high/zoom .5, frames 0–180. I opened both. The APC drives onto the sedan and the wheel/body presentation separates during the roll; this is visible in both sequences. At the end the APC tilt reaches 35.5° and the sedan reaches 177.5°. [Recorded state](vehicle-followup.json) compares all eight backend/tier/zoom cases: vehicle metrics are identical before/after in 8/8 cases. The orchestrator explicitly assigned the physics/presentation issue to a follow-up lane; this change only supplies spark feedback.

## Browser regression comparison

The unchanged E15/E27 browser gates completed with **19 passed, 2 failed** ([log](browser-vfx.log)); all ten E27 checks passed, including seven beats, flash reduction, car panels, smoke readability and transient pool recovery. Both failures reproduce against the immutable pre-change build ([baseline log](browser-baseline-regressions.log)): `T-E15-lifecycle` expects 2 textures and sees 5 after unload (stable across cycles), and `T-E15-03` expects 1 decal but sees 4 after droplet landings. The baseline shockwave radius test passes. No assertions, budgets or existing tests were changed.

The tall dumpster fixture also checks the existing MG penetration: the Alpha ends at exactly **265 HP** in both builds. Destructible cover is an environment ray victim, so the view now recognizes it as a hard impact and places dust/glints at the ray-entry surface. This changes only the visual endpoint; damage/penetration stays in the sim.
