# VFX stunning — implementation and evidence

Status: **committed WIP; deployment gate incomplete**. Seven pooled improvements are implemented. The reviewed shader matrix predates the final cover/contact spawn refinements; those refinements still need browser capture and remote unit verification. Native E18 timing and the blast-hitch comparison remain unmeasured. No deployment or merge.

## Research and changes

[Research](research.md) surveyed the requested techniques and selected seven improvements that reuse existing materials and fixed pools: ballistic spark ribbons, short muzzle stars/cover glints, expanding coherent dust, a feathered pressure ring, radial scorch, rising ember trails, and directional blood droplets. WebGL2 and WebGPU use the same TSL graphs. No external assets, dependencies, copied artwork or new licences.

`FxPool` adds discrete masks and camera-plane ballistic alignment. `Vfx` reduces muzzle/continuous-fire particle density and adds bounded metal contact feedback from existing vehicle events and actual cover-query endpoints. `Blasts` uses the same dust/spark/scorch slots and fixes ember height on raised ground. The existing noise fire, lit smoke volumes, detached metal, hit-stop and distance based shake remain the foundation.

Low quality keeps the new silhouettes with 512 general particle slots, 120 volume puffs and reduced emission rates; high uses 2048 and 400. Fire emitter bursts drop from 24 to 8 high / 6 to 2 low, muzzle flashes use fewer fragments, and contact bursts emit 12 / 3 sparks. Sparks/flash emission follows flash reduction. Full/Reduced/Off gore and retained bodies use the existing policy. No damage, difficulty, simulation, L5, post effects, lighting or weather changes.

## Reproduction

Scenes are automatically discovered in `tests/scenes/catalog/vfx-*.json` by `scene:catalog --matrix --filter 'vfx-*'`. They cover barrel explosion, rifle, shotgun, cover impacts, Molotov/fire at night, Alpha melee hit, gore, vehicle wreck and actual APC/metal contact. Damage gates prevent the combat fixtures from passing with empty swings. The first fixture drafts exposed a wrong axe identifier and missing aim input; both were corrected before the final comparisons.

`tools/scenelab/vfx-stunning.ts before|after` runs the nine scenes at high/low, zoom 1/.5, WebGL2/WebGPU with one headless browser. `VFX_DIST` serves an immutable build, `VFX_BACKEND` / `VFX_FILTER` limit a batch. Run after a fresh build through `tools/e2e-lock.sh` with unique SCENE_PORT/E2E_PORT. Baseline is the unchanged initial build; comparison builds are isolated from active captures. Timing is Scene Lab CPU sim + render submission, not GPU frame time.

## Visual review

I opened the eight backend/tier/zoom overview sheets and the explosion, gore, cover and vehicle contact sequences. After the last sheet regeneration I reopened WebGL2/high/1 and WebGPU/low/.5, shown below. These are actual game-camera captures, composed side by side; they do **not** depict the final cover-ray fix or the final low-tier contact lift.

| Backend / tier | Zoom 1 | Zoom .5 |
| --- | --- | --- |
| WebGL2 high | [comparison](sheets/webgl2-high-z1.jpg) | [comparison](sheets/webgl2-high-z0.5.jpg) |
| WebGL2 low | [comparison](sheets/webgl2-low-z1.jpg) | [comparison](sheets/webgl2-low-z0.5.jpg) |
| WebGPU high | [comparison](sheets/webgpu-high-z1.jpg) | [comparison](sheets/webgpu-high-z0.5.jpg) |
| WebGPU low | [comparison](sheets/webgpu-low-z1.jpg) | [comparison](sheets/webgpu-low-z0.5.jpg) |

| Effect sequence | What I saw / remaining limitation |
| --- | --- |
| [Explosion](sheets/vfx-explosion.jpg) | The baseline ring is a solid geometric band; the new ring feathers into the floor. High-tier sparks form bright short arcs around the unchanged hot core. Low retains the softened ring with fewer sparks. |
| [Rifle](sheets/vfx-rifle-impact.jpg), [shotgun](sheets/vfx-shotgun-impact.jpg) | A narrow muzzle star replaces the fuzzy circular flash; yellow tracers remain readable at both zooms. The existing pale shotgun impact frame remains visible. |
| [Cover](sheets/vfx-rifle-cover.jpg) | The dumpster and penetrated Alpha are visible. These captures exposed the missing hard-surface feedback for destructible ray victims. The subsequent near-entry fix is committed but its new glints are **not captured**. |
| [Molotov/fire](sheets/vfx-molotov-fire.jpg) | The orange flame and light remain readable at night. High smoke resolves into rounded gray puffs; low retains a simpler orange/gray column. Fewer fire particles reduce the bright haze. |
| [Alpha hit](sheets/vfx-alpha-hit.jpg), [gore](sheets/vfx-gore.jpg) | Red droplets read as directional strokes rather than a fuzzy red spot. The fallen body and blood on the floor remain in the later frames. |
| [Vehicle wreck](sheets/vfx-vehicle-crash.jpg) | The burning red shell, panels and established fire column remain visible. The change is subtler than the blast ring. |
| [Vehicle contact](sheets/vfx-vehicle-contact.jpg) | The APC rolls over the sedan in both builds. Early contact sparks are obscured by the overlapping hoods, especially on low. The final upward lift needs a new capture; visibility is not claimed. |

## Cost and validation

[Cost per effect](costs.md) records CPU submission p95 plus peak draws/triangles for every effect/backend/tier; [raw summary](scene-costs.json) includes both zooms and cold maxima. These concurrent shared-Mac runs measure Scene Lab sim + render submission, **not GPU frame time or E18 native certification**. General-pool capacity and draw topology are unchanged. Activating previously idle particle/decal pools in the new contact scene adds two active draws: high 54→56, low 49→51. High WebGPU contact CPU p95 is 15.7→16.2 ms. Explosion zoom-1 CPU p95 ranges 1.4–2.1 ms after, against 1.6–1.9 ms before. Its WebGL2/high cold maximum is 60.6 ms versus 57 ms; this does not establish equal blast hitch. No performance improvement is claimed.

| Check | Result and scope |
| --- | --- |
| Latest source | [Typecheck](typecheck.log), [lint](lint.log), [production build](build-sparks.log) passed through implementation revision `2cd64ab49`. |
| Initial shader matrix | Nine scenes × two backends × two tiers × two zooms: 72 cases per build completed with zero console errors. This was before the later dumpster/contact refinements. |
| Saved comparison artifacts | **132/144 raw cases pass**, zero console errors. Twelve cover rows retain the obsolete draft expectation of 300 HP; captured HP is 265, matching existing MG penetration. Four WebGPU after rows still show an older cover fixture. The current exact-265 fixture has not been rerun. These mixed revision captures are explicitly not final-head certification. |
| E15/E27 browser gates | **19 passed, 2 failed**. All ten E27 checks passed. Both E15 failures reproduce unchanged on baseline; details below. These gates precede the final spawn refinements. |
| Broad deploy browser batch | **42 passed, 53 failed, 5 not run** out of 100 ([log](browser-deploy-gate.log)). The failed cases report Chromium launch/bootstrap error 141; this is a failed/incomplete gate, not evidence of gameplay correctness. Smoke checks S-01/S-10 passed before the browser failure. |
| Latest cover/contact capture | Unmeasured. Replacement batches exceeded the 30-minute slot wait limit; when admitted, Chromium failed `bootstrap_check_in` with error 141 ([log](before-cover-impact.log)). No further batch was started. |
| Remote unit/sim/levels | No completed result. Initial runner disappeared during upload; focused VFX job queued, then SSH reconnects failed. The serialized full retry ended with runner API TLS EOF / no runner available ([focused log](remote-vfx.log), [final retry](remote-regression-final.log)). No local Vitest sweep was substituted. |
| E18 and blast hitch | Unmeasured: no authorized quiet window was available. Budgets and existing tests are unchanged. Native high/low timing must still use `tools/perf/quiet-run.sh` after 06:00 or explicit authorization, at most 20 minutes per reservation with release between batches. |

Four new high/low unit cases cover bounded vehicle contact emission, pool reuse, expiry, disabled VFX, static cover, destructible cover near-entry, and unchanged simulation state. They are committed but lack a completed remote result. Final follow-up commands must rerun those plus full unit/sim/levels through `sh tools/remote/run.sh "$PWD" -- <cmd>`, rebuild, capture cover/contact across both backends/tiers/zooms through `tools/e2e-lock.sh`, and complete the unchanged deploy gate. The browser must remain headless with unique ports and at most two workers. No quiet-run reservation was taken at night. No atmosphere hook is required; distortion and extra muzzle lights remain deferred pending measured render-pass/light cost.

## Vehicle follow-up retained for the next lane

The APC-on-sedan roll/overlap exists in the unmodified baseline: [baseline full sequence](sheets/vehicle-roll-before.jpg) and [comparison full sequence](sheets/vehicle-roll-after.jpg), WebGL2/high/zoom .5, frames 0–180. I opened both. The APC drives onto the sedan and the wheel/body presentation separates during the roll; this is visible in both sequences. At the end the APC tilt reaches 35.5° and the sedan reaches 177.5°. [Recorded state](vehicle-followup.json) compares all eight backend/tier/zoom cases: vehicle metrics are identical before/after in 8/8 cases. The orchestrator explicitly assigned the physics/presentation issue to a follow-up lane; this change only supplies spark feedback.

## Browser regression comparison

The unchanged E15/E27 browser gates completed with **19 passed, 2 failed** ([log](browser-vfx.log)); all ten E27 checks passed, including seven beats, flash reduction, car panels, smoke readability and transient pool recovery. Both failures reproduce against the immutable pre-change build ([baseline log](browser-baseline-regressions.log)): `T-E15-lifecycle` expects 2 textures and sees 5 after unload (stable across cycles), and `T-E15-03` expects 1 decal but sees 4 after droplet landings. The baseline shockwave radius test passes. No assertions, budgets or existing tests were changed.

The tall dumpster fixture also checks the existing MG penetration: the Alpha ends at exactly **265 HP** in both builds. Destructible cover is an environment ray victim, so the view now recognizes it as a hard impact and places dust/glints at the ray-entry surface. This changes only the visual endpoint; damage/penetration stays in the sim.
