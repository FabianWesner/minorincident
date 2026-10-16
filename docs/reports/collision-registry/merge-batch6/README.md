# Collision registry merge onto batch 6

Base: `8718d0fb1`; collision lane: `d6536bc6d`. Integration is confined to `lane/merge-collision`; no deployment or merge into main.

The package script conflict retains main's `telegraph-*` and `interior-cull-*` families and adds all `collision-*` scenes plus `alphas-at-the-tank` to the regular matrix. The automatic CrowdView merge preserves the dedicated telegraph renderer while retaining registry-aware contact poses; its obsolete `megaAlpha` import was removed. GameView preserves interior-cull controls alongside the collision lane's courier foreground rendering.

No difficulty data, specs, budgets, dependencies or static collision bake were changed. L5 changes inherited from the collision lane admit teleports/reveals through the registry and place followers in arrival order through the metro opening.

Validation and opened captures are recorded below. All heavy Vitest work runs on Hetzner, four workers maximum. Browser runs are headless, two workers maximum, through the shared locks, from a fresh production build. Canonical gate ports 3397/3393 were checked free before launch.

## Remote timing

The complete isolated timing project acquired both slots on `94.130.181.173` and ran all 26 files: **197 passed, one failed**. Zoo S2 high is **4.097124 ms >4 ms**, with all 200 actors, 20 zoo actors and 51 activations retained. The unchanged 100-actor low test passes. See [full log](evidence/isolated-timing.log) and [high proof](evidence/isolated-zoo-200.json). The first ordinary full-suite run also failed the L9 residency and 200-chaser director timing checks; both pass within the complete isolated project. Those failures are retained in its log rather than omitted.

Before the L7 correction below, `git diff lane/collision-s1 -- src/sim src/physics src/data tests/sim/performance/zoo-s2.test.ts` was empty. The subsequent L7 passenger correction is outside the Zoo fixture. Thus the 4.097 ms failure is a current budget miss on the incoming lane's identical simulation, not a new simulation change introduced by conflict resolution. S4's historical 3.804490 ms result does not supersede this new failed measurement. No timing acceptance is claimed for Zoo S2 high.

## Opened game-camera captures

Fresh production build; WebGPU high at zoom 1 and .5 opened for both requested scenes. In `collision-alpha-charge-registry`, red outlined charge chevrons appear in frames 15–45; the Alpha advances toward the courier in frames 60–90, knocks her down by frame105 beside the tank, and she rises by frame150. The Alpha remains beside the chassis after contact. Both opened rows report zero collision failures and pending admissions. Projection overlaps alone cannot measure penetration depth; the registry probes supply that evidence.

In `alphas-at-the-tank`, five Alphas begin behind the parked tank, round both ends by frames80–160, gather on the courier's side and continue telegraphs and attacks through frame480. Both high rows record eight attacks. Zoom1 shows the whole tank and the encounter; zoom.5 crops the courier and several bodies, limiting full-scene review, while making the near-side hull and moving limbs easier to see. Black cells after the final labeled frame are unused sheet cells.

## Corrections exposed by adding the full collision catalog

The initial catalog also exercises scenes outside S4's previous six-family selection. `collision-l5-metro-ingress` reports stationary residents' shins crossing the raised station floor. Its inherited base fixture omitted production `LevelFiveAftermath.spawnStation()`'s explicit `floorY = .15`. The fixture now assigns the same height to all 24 residents, preserving every resident, position, follower, travel assertion and zero clipping limit. Original failing sheets/metrics are in `evidence/metro-before/`.

`collision-l7-courier-queue` reaches the bus departure (final bus x=40) but the hidden courier stays at x=-69.62994. The cleanup phase republishes the stale player physics body after the departure driver writes her entity transform. The driver now synchronizes that body with the bus on each drive tick. The existing departure test additionally checks that the courier finishes at the bus's x/z. Original failed max-X rows, with the bus trace showing completed departure, are retained in `evidence/l7-before/`. Its existing [0,45] courier movement assertion is unchanged.

The corrected L7 departure suite passes **9/9** remotely; [run log](evidence/l7-fix.log).

The four corresponding WebGPU low sheets were opened too. The charge timing, knockdown and recovery and the tank-flanking sequence match high quality. Low uses visibly simpler Alpha head/hand/body geometry. Close zoom still crops the courier from the tank scene. All eight requested WebGPU tier/zoom rows for these two scenes pass.

## Complete remote unit/sim/levels run

The exact requested `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/levels tests/sim --maxWorkers=4` completes all 480 files: **3,014 passed, 11 skipped, four failed**. [Full log](evidence/full-remote.log). Failures: director p95 4.657852 ms, L9 residency p95 4.094983 ms, Zoo S2 high p95 4.109742 ms and one L5 shotgun 30-second timeout. The complete isolated timing project clears the first two; Zoo S2 remains red as above. The unchanged shotgun file passes **6/6** in isolation in25.41 seconds, including the permanent-kill/two-shell Alpha case: [isolated log](evidence/l5-isolated.log). No damage, HP, weapon, concurrency or timeout value was changed.

All ten per-level registry invariants pass, including stationary full audits. Continuous L1→L9 campaign and the continuous newbie L1→L6 campaign pass. The eleven skips include the seven macOS lock tests, two explicit L4 probe cases and two optional offline audio checks on this Linux runner.

## Full canonical browser invocation

The exact requested `gate-browser.sh` reports typecheck/lint/build zero, smoke six Node and31 browser passes. The expanded WebGPU matrix completes **818/828** in42m52s. Its ten failures are exactly the metro floor fixture (both tiers at1/1.5) and hidden L7 passenger (both tiers at.5/1/1.5), corrected above and queued for final-build reruns. The original results remain in [matrix.json](evidence/matrix.json). Browser selection and final-source focused checks follow below.

The canonical Playwright selection finishes **119 passed, one flaky, zero failed/skipped** in16m14s. [JSON](evidence/canonical-browser.json), [script log](evidence/canonical-gate.log). `L4 war: mouse WASD stick webgl high zoom0.5` passes its configured retry: the first attempt clicked a drawn infected (ID153), so input correctly emitted an attack target instead of the fixture's assumed ground move. Its [first trace/context](evidence/l4-click-first/) is retained; no click behavior or assertion was weakened. The final bundle was rebuilt after the L7 correction; focused matrices and an isolated exact-case rerun use that bundle.

## Final-build focused WebGL

**60/60 pass**, high/low × zoom1.5/1/.5 across the ten selected families, from the rebuilt corrected bundle; [index](evidence/final-webgl2/index.md). All metro clipping counts are0, all six L7 courier max-X values are40. I opened all16 WebGL sheets for charge, tank, metro and L7 at the requested tiers/zooms1/.5. The charge and tank sequence matches the WebGPU observations above. Metro followers climb the steps, gather inside and the shutter closes. Its close camera shows the doorway and part of the group; the24 deeper residents are not all visible together. The L7 follower steps around the courier and boards, then the camera takes the departure shot, the bus passes the fire-lit street, and the ending deliberately fades to black. The courier is hidden aboard, so the max-X probe supplies her travel evidence rather than a visible passenger mesh.

Bulky per-frame metrics are retained losslessly as `metrics.json.gz`; index JSONs and sheets remain directly readable. The46MB first-click trace stays in ignored Playwright output, with its path/size/SHA256 committed in `evidence/l4-click-first/trace-location.json` alongside the error context.

## Final-build focused WebGPU

**60/60 pass**, same ten families and full tier/zoom matrix; [index](evidence/final-webgpu/index.md). All metro clipping counts are0 and all L7 courier max-X values are40. I opened all16 corresponding WebGPU charge/tank/metro/L7 sheets at zoom1/.5 in both tiers. They show the same choreography and framing limits as WebGL; low simplifies Alpha geometry and foliage, while the charge corridor, knockdown, regrouping, boarding and departure remain readable. Combined final focused result: **120/120**, zero failed rows or console errors. This is a final-source focused rerun resolving the original ten matrix failures; the complete828-row matrix was not rerun after correction.

### Opened final capture manifest

- webgl2 `collision-alpha-charge-registry`: [high z1](evidence/final-webgl2/collision-alpha-charge-registry@high-z1/sheet.jpg), [high z0.5](evidence/final-webgl2/collision-alpha-charge-registry@high-z0.5/sheet.jpg), [low z1](evidence/final-webgl2/collision-alpha-charge-registry@low-z1/sheet.jpg), [low z0.5](evidence/final-webgl2/collision-alpha-charge-registry@low-z0.5/sheet.jpg)
- webgl2 `alphas-at-the-tank`: [high z1](evidence/final-webgl2/alphas-at-the-tank@high-z1/sheet.jpg), [high z0.5](evidence/final-webgl2/alphas-at-the-tank@high-z0.5/sheet.jpg), [low z1](evidence/final-webgl2/alphas-at-the-tank@low-z1/sheet.jpg), [low z0.5](evidence/final-webgl2/alphas-at-the-tank@low-z0.5/sheet.jpg)
- webgl2 `collision-l5-metro-ingress`: [high z1](evidence/final-webgl2/collision-l5-metro-ingress@high-z1/sheet.jpg), [high z0.5](evidence/final-webgl2/collision-l5-metro-ingress@high-z0.5/sheet.jpg), [low z1](evidence/final-webgl2/collision-l5-metro-ingress@low-z1/sheet.jpg), [low z0.5](evidence/final-webgl2/collision-l5-metro-ingress@low-z0.5/sheet.jpg)
- webgl2 `collision-l7-courier-queue`: [high z1](evidence/final-webgl2/collision-l7-courier-queue@high-z1/sheet.jpg), [high z0.5](evidence/final-webgl2/collision-l7-courier-queue@high-z0.5/sheet.jpg), [low z1](evidence/final-webgl2/collision-l7-courier-queue@low-z1/sheet.jpg), [low z0.5](evidence/final-webgl2/collision-l7-courier-queue@low-z0.5/sheet.jpg)
- webgpu `collision-alpha-charge-registry`: [high z1](evidence/final-webgpu/collision-alpha-charge-registry@high-z1/sheet.jpg), [high z0.5](evidence/final-webgpu/collision-alpha-charge-registry@high-z0.5/sheet.jpg), [low z1](evidence/final-webgpu/collision-alpha-charge-registry@low-z1/sheet.jpg), [low z0.5](evidence/final-webgpu/collision-alpha-charge-registry@low-z0.5/sheet.jpg)
- webgpu `alphas-at-the-tank`: [high z1](evidence/final-webgpu/alphas-at-the-tank@high-z1/sheet.jpg), [high z0.5](evidence/final-webgpu/alphas-at-the-tank@high-z0.5/sheet.jpg), [low z1](evidence/final-webgpu/alphas-at-the-tank@low-z1/sheet.jpg), [low z0.5](evidence/final-webgpu/alphas-at-the-tank@low-z0.5/sheet.jpg)
- webgpu `collision-l5-metro-ingress`: [high z1](evidence/final-webgpu/collision-l5-metro-ingress@high-z1/sheet.jpg), [high z0.5](evidence/final-webgpu/collision-l5-metro-ingress@high-z0.5/sheet.jpg), [low z1](evidence/final-webgpu/collision-l5-metro-ingress@low-z1/sheet.jpg), [low z0.5](evidence/final-webgpu/collision-l5-metro-ingress@low-z0.5/sheet.jpg)
- webgpu `collision-l7-courier-queue`: [high z1](evidence/final-webgpu/collision-l7-courier-queue@high-z1/sheet.jpg), [high z0.5](evidence/final-webgpu/collision-l7-courier-queue@high-z0.5/sheet.jpg), [low z1](evidence/final-webgpu/collision-l7-courier-queue@low-z1/sheet.jpg), [low z0.5](evidence/final-webgpu/collision-l7-courier-queue@low-z0.5/sheet.jpg)

## Final E18 browser checks and L4 rerun

The final-build batch passes **18** and fails **3** with no retries/skips:17 passing E18 checks plus the exact L4 configuration that was flaky in the canonical invocation. [Results](evidence/e18-core/results.json), [log](evidence/e18-core/run.log). All eight download combinations pass, max **14,888,472 bytes <15,000,000**. Auto quality, context restore, visibility, teardown and the other five scenario/tier counter rows pass.

E18 remains **RED**, with no threshold, count or scope change:

| Check | Measured | Limit |
| --- | ---: | ---: |
| Zoo S2 high isolated full timing |4.097124ms |4ms |
| L5-low triangles |522,675 (242 draws) |500,000 (300 draws) |
| High five-load heap growth |80.620228→97.583408MB,21.0408% |10% |
| Low five-load heap growth |69.120568→86.990816MB,25.8537% |10% |

The incoming S4 report also documents low-L5 triangles and both heap-growth failures, including its pinned batch-5 main heap baseline. The new merged measurements above are retained independently. No fresh batch-6 main baseline is claimed, and the exact522,675 overrun is not attributed to main without one. L5 difficulty stays frozen.

Both additional E18 mobile startup checks pass (Pixel7/iPhone14, portrait/landscape, touch and automatic low): [mobile results](evidence/e18-core/mobile-results.json). Complete E18 browser coverage is therefore **19 passed /three failed** across22 checks, plus the separate passing L4 rerun. Mobile admission waited about7minutes behind another lane's quiet reservation; no wait exceeded30minutes.

## Native timing admission and final status

**Fresh native desktop/horde/phone timing is UNMEASURED.** One bounded quiet batch was attempted, with the existing `quiet-run.sh` and a nonblocking `lockf` wrapper: [method](method/bounded-quiet.py), [admission log](evidence/native-admission.log), [stop record](evidence/native-admission.json). Its command selected the unchanged desktop, horde-budget, phone-base and device suites (one worker, headless native Metal, port3494). Every admission failed on a busy shared slot; no preflight condition record or frame sample was created. No reservation was held when the guard was stopped.

The binding fairness rule says to report unmeasured work after30minutes of slot waiting. Approximate cumulative waits were3minutes during initial smoke/matrix admission,6.4for the canonical browser selection,4.3for focused WebGPU,7.6for mobile and8.5for final native admission: about30minutes. Thus the last native attempt was stopped before its own30-minute per-command deadline; the historical S4 native results are not claimed as fresh evidence. No further quiet batch was chained. The batch wrapper also caps any admitted process group at1,140seconds plus10seconds termination grace, below20minutes; that cap was never exercised because admission never succeeded.

**Integration remains RED for E18**, not ready for an unconditional performance sign-off: Zoo S2 high, L5-low triangles and both heap-growth checks fail; fresh native timing is unmeasured. Typecheck/lint/final build pass; unique remote cases after isolated reruns are3,017passed /one remaining budget failure /11skipped; both final focused backends pass60/60, and the exact L4 flaky configuration passes on the final build. The canonical invocation itself retains119passes/oneflake and its initial818/828matrix result; all ten corrected rows pass in the final focused reruns. No deploy or merge into main was performed.

`npm run verify -- E18` is not claimed: its local full-Vitest path conflicts with the remote-only heavy-run instruction. Full Node unit/sim/levels and the complete timing project were run on Hetzner; browser constituents and the native admission outcome are recorded explicitly above. No epic status or criterion was edited.
