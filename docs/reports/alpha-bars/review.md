# A-S4: shared health-bar view

Scope: the health-bar portions of E07-AC06 and E07-AC19, plus E07-AC12/E18 counters. No move, Alpha asset, campaign, or simulation balance changes. `InfectedDef.bar` opts an archetype into the shared pool. Lion, gorilla and flamingo enable it now; A-S1 and zoo roster lanes must set `bar: true` on their new definitions. The runner fixture exercises the contract before Alpha arrives.

The three unlit instanced layers read live simulation HP and use the displayed crowd geometry's rigid-part bounds, pose blend and instance transform. Static geometry raycasts supplement navigation colliders, which omit roofs. Bars composite after DOF/bloom with inline color conversion, preserving the game image. The fill clamp is shared with the actual HP HUD in `Hud.ts` (the epic names `GameUI.ts`, which does not own that fill). Contrast requires the documented bar palette rather than the HUD's original red.

## Coverage and evidence

`tests/unit/health-bars.test.ts` covers eligibility, 15 m boundary, damage, neutral zoo rejection, hidden/dead/recoverable states, fill clamp, viewport dimensions, contrast and animated bounds/stale-frame rejection. `tests/e2e/health-bars.spec.ts` tests real damage in one presentation frame, camera anchor error ≤2 px, recovery/permanent death, same-id infection, range/frustum/house occlusion, all three shipped zoo species on both tiers, PNG contrast and game-image preservation. Dedicated browser config uses one worker; all browser runs use the lock and headless Metal WebGL2. No tolerance was loosened.

Reviewed game-camera PNG pairs:

- [Desktop before](before-1600.png) / [after](after-1600.png), [portrait before](before-390.png) / [after](after-390.png), [landscape before](before-844.png) / [after](after-844.png): half-filled bars remain above the runner, clear of its silhouette. Desktop inner size64×8, phones48×6 CSS pixels; 2px outline and minimum2px gap. Sampled contrasts5.776:1,3.086:1,17.824:1. The white body is the existing damage flash. Ground/courier/pedestrian remain visible after compositing.
- Zoo pairs `zoo-before/after-{1600,390,844}.png`: lion, gorilla and flamingo each have a separate 50% bar above their different bounds; healthy pedestrian has none. Existing low-tier fur/feather detail is jagged; bar borders remain sharp.
- Occlusion pairs `occlusion-before/after-{1600,390,844}.png`: the roof hides the enemy bar; moving behind the house reveals it. An occluded active enemy has no floating indicator through the roof.
- [Motion start](motion-before.png) / [end](motion-after.png): inspected the Scene Lab contact sheet at frames0,30,60,90,120 as well. The actor turns, chases, lies down briefly at90, then rises; the bar follows the displayed body, independently of velocity/facing. No clipping, sunk bar, detached invisible-but-active bar, or visible bar jitter. The motion probe records existing pose lift19.3cm, sink0cm, slide p95 0.5cm (max24.4cm at scripted transition frame5), and one jitter frame; the bar change does not alter grounding or animation. All six Scene Lab high/low runs pass: clipping0, undrawn actor frames0. The reviewed intermediate sheet was deleted; only before/after PNG pairs are retained.
- Perf pairs `perf-before/after-{high,low}.png`: all200/100 flagged actors draw. Bars overlap in the deliberately dense ring; this is a pool stress scene, not a claim of readable labels for200 overlapping bosses.

## Performance

| Measurement | High,200 flagged | Low,100 flagged | E18 limit high/low |
| --- | ---: | ---: | ---: |
| Draws including bars | 34 | 28 | 600 /300 |
| Triangles including bars | 362450 | 226496 | 1500000 /500000 |
| Retained JS heap, CDP after GC | 106.20MB | 66.61MB | 400 /250MB |
| Extra bar draws /triangles | 3 /1200 | 3 /600 | fixed shared pool |
| Sim p95, remote horde benchmark | 2.804ms | 1.121ms | 4 /6ms |

These are isolated scene counters and retained heaps, not a full L6 memory or real-device FPS certification. The paused capture's single-frame FPS is not a frame-time benchmark. The bar scene adds no asset download. WebGPU/manual real devices were not run; browser automation remains headless.

## Validation

Dedicated browser5/5 pass; Scene Lab6/6 pass; scoped unit3/3 pass; typecheck, lint and production build pass. Full unit807/809: unchanged baseline failures T-E09-01-wreck and T-E17-04, both missing doorL/doorR in veh.fire-engine.wrecked:lod0. Pristine baseline804/806 has the identical two failures; the one temporary baseline worktree was removed. Logs retained here. Remote horde benchmark3/3 pass. Remote E07 verification could not create its job snapshot because the runner disk filled; local E07 verification result is recorded in report.md and verify.txt.
