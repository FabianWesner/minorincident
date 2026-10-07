# Crowd feel lane report

Branch: `lane/crowd-feel`. Main was merged into the lane through `8ee60c74` (lane merge `59fd0742`); overlapping combat reactions preserve `reaction.until`, ground deaths, matching moving step clips and incremental gait phase. Changes are committed on the lane; integration into main and deployment remain with the orchestrator.

## Changes and causes

- `713c48cd`: human heel plants, incremental distance phase, quaternion/TRS clip fades, authored material sides, permanent bodies, dropped accessories and fallen-prop recovery.
- `87876a75`: quality/density changes retain existing pedestrians and pets; future top-ups spawn off-screen. There is no pedestrian recycling, so the 60-second recently-seen protection is unconditional.
- `7a696c5d`, `65b9cf1c`: production worker foot metrics, longer pool-retention exercise and animal before/after metrics.
- `aa852e96`, `76c76c6c`: corgi/infected-dog paw plants; moving attacks, staggers and crawlers use matching locomotion; scaled figure reach is respected. Stationary reactions use their authored reaction and its actual sim duration. Animation remains presentation-only.
- `62427f75`: flock members retain individual dead-bird positions; frozen corpses retain dismemberment masks. Flock culling bounds cover individual bird positions.
- `4f607e96`: common-worker LOD1/LOD2 rebuilt from closed source solids, welded at imported seams and given smooth corner normals. `pal_uiDark` hair/brows/cloth no longer receive the pupil emissive flag. The grey shard defect required this glow correction and the mesh/normal rebuild; preserving DoubleSide alone did not fix it.
- `f5efa70b`: settled corpses use growing 128-instance static pages with baked final death geometry and complete computed bounds. They release AI records after 120 ticks and retain IDs/poses for the level; no AI, motion response or physics is retained. Off-screen pages can be culled without undersized animated bounds.
- `45d7710c`, `e1a817a8`: E07 includes presentation/permanence guards and four-angle worker evidence.
- `1f260b4f`: horde culling uses an explicit off-screen actor. Corpses remain in the draw measurements until an explicit level reset; the 30-draw and no-individual-mesh requirements remain.
- `26d63bea`: killed perched/clinging cats become visible grounded corpses; the living-only ambush reveal path previously left killed perched cats hidden forever.
- `37df1fc2`: changing gore invalidates frozen limb geometry and rebuilds bodies from their retained identities; unit coverage restores a removed head, and the return browser guard checks all 20 bodies through Off/Full changes. Full unit/E07/smoke gates were rerun after this change.
- `38d18ca6`: corpse-return browser guard uses the actual walking controller, stays inside the finite arena floor, waits 60 seconds away, and verifies both travel distances and grounded height.
- `39cf8e65`: W2+ parks existing traffic at its current pose instead of deleting cars; displaced-prop guards require the same identity/pose through all five decay transitions. Current Grove pushables retain all 88 authored identities at every tier.
- `b0e8fa9b`, `84c24ad1`, `45f078f7`, `e05bffd6`: fair single-slot browser waiting, stable lock inodes (`lockf -k`) and internal simulation locks for verify/smoke. npm verify/smoke/e2e commands were not wrapped externally.

The cadence cap had lengthened the *distance-to-phase stride divisor*, while the authored foot travel stayed fixed. Contact correction now holds each supporting heel/paw in world space and uses a reach-limited support phase. Dividing lifetime distance by a changing stride also jumped phase during speed changes; phase now integrates distance increments. Matrix interpolation between opposing rotations could collapse a rigid part; clip fades now interpolate TRS and retain the displayed pose on interruption.

## Measurements

Evidence: `test-results/epics/E07/crowd-feel/`.

| Stance clip, maximum across production human looks, headings and scales | Before cm | After cm |
| --- | ---: | ---: |
| npc-walk, 1.4 m/s | 6.983 | 0.164 |
| civ-flee, 4 m/s | 13.167 | 0.340 |
| infected-frail, 4.7 m/s | 25.147 | 0.167 |
| infected-lurch, 5.1 m/s | 22.219 | 0.333 |
| infected-sprint, 5.6 m/s | 13.164 | 0.501 |

`feet.json` contains all 40 rows: civilian man, civilian woman, lab tech and common-worker LOD1; scales 1 and .7; both feet and headings 0/45/90 degrees. Each row measures authored stance versus corrected stance, sampled over 95% of the reach-limited support phase. Baseline numbers use the authored capped atlas without contact correction, rather than an old binary with different asset geometry.

Corgi walk/trot/gallop: **5.918 / 15.759 / 23.205 cm before → less than 0.001 cm after**. `corgi-feet.json` records support fractions and sample coverage. The production instanced infected-dog paw guard also passes its 3 cm limit.

L1 accident, seed 1, game follow camera, 60 seconds:

| Renderer continuity | Before | After |
| --- | ---: | ---: |
| Frames sampled | 3,601 | 3,479 |
| On-screen figure samples | 20,227 | 19,331 |
| Moving infected samples | 5,478 | 5,348 |
| Civilian samples | 2,660 | 2,255 |
| Brief 1–3-frame disappearance events/minute | 0 | 0 |
| Sustained disappearance / duplicate draw events | 0 / 0 | 0 / 0 |
| Unexplained recently-seen sim departures | not recorded | 0 |

The PO blink was **not reproduced** in the baseline submission probe. Counts come from each instance's renderer submission (`onAfterRender`), not pixel occlusion/readback. These guards detect missing handovers, culling and duplicate submissions; the separate opposing-rotation unit guard detects pose collapse. Pixel-level visibility through occluders is not claimed. On-screen is the inner 90% of NDC; legitimate building/refuge escape is an explicit sim cause. Baseline and after captures use the same seeded setup, but browser scheduling changes precise frame coverage.

Permanence: the final browser guard walks over 60 m away, waits 3,601 ticks, and walks back using the actual controller; it verifies grounded height and outbound/return distances as well as the 20 corpse IDs/submissions. **20/20 IDs and 20/20 submissions pass**: outbound/waited distance **67.284 m**, grounded y **0.705 m**, return error **1.53 cm**. All 20 remain submitted through gore Off/Full cache rebuilds. A separate simulation guard teleports 65 m in Grove to isolate age/distance cleanup. The return still is `after/corpse-return.png`. The pooling run retained **4,350 corpses** at 300 seconds while recycling **350** brain records. Dropped hand props, uncollected weapons, fallen physics props and dead flock members have separate guards.

Worker delivered totals: **5,236 LOD1 / 4,174 LOD2 triangles**, within existing **6,000 / 5,000** caps; validation has zero errors. Crowd-bake guards cover all three tiers and four clips at four frames: one rigid owner per triangle, max posed edge < .9 m, max area < .15 m², authored material sides, no generated-collapse marker on repaired tiers and no dark-hair emissive flag. `topology.json` and `worker-delivery.json` contain the values.

## Exact validation commands

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run build` — PASS.
- `SIM_WAIT=60 sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E07/crowd-feel/unit.json` — **270 passed, 0 failed, 82 files** after the final gameplay source changes and main merge. The final rerun also covers frozen-mask invalidation and the walking/settings browser guard. The earlier pre-audio-merge run also passed 266/266.
- `CROWD_CAPTURE=after E2E_PORT=3328 sh tools/e2e-lock.sh npx playwright test tests/e2e/crowd-feel.spec.ts --project=chromium --workers=1` — **3 passed, 0 failed** on the final corpse bounds and game-camera capture.
- `CROWD_CAPTURE=before E2E_PORT=3328 sh tools/e2e-lock.sh npx playwright test tests/e2e/crowd-feel.spec.ts --project=chromium --workers=1` — **2 passed** before the corpse-return guard was added. Early setup attempts without infected/civilian coverage were rejected and their raw recordings removed.
- `SIM_WAIT=60 sh tools/sim-lock.sh npx vitest run tests/sim/npc/permanence.test.ts tests/sim/ai/specials.test.ts tests/sim/ai/director.test.ts tests/sim/performance/horde.test.ts tests/sim/props.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=test-results/epics/E07/crowd-feel/sim.json` — **34 passed, 0 failed, 5 files**; chase p95 3.615 ms. Earlier targeted runs: 26/26 across the first four files; props 6/6; subsequent static/flock run 16/16. The new perched/clinging-cat guard passed with `SIM_WAIT=600 sh tools/sim-lock.sh npx vitest run tests/sim/ai/animals.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E07/crowd-feel/animals.json`: 10/10. Final consolidated command uses `--maxWorkers=1`.
- `SIM_WAIT=60 E2E_PORT=3329 npm run test:smoke` — **6 simulation + 23 browser checks passed, 0 failed**.
- `SIM_WAIT=60 E2E_PORT=3332 npm run verify -- E07` — **61 selected simulation/unit + 29 browser checks passed, 0 failed**. Chase p95 **1.639 ms**, budget 4 ms. `checks.json` records zero exit codes for every stage; `crowd-feel/verify-browser.json` preserves the browser results.
- `/Applications/Blender.app/Contents/MacOS/Blender -b --threads 2 --python tools/assets/rebuild-worker-lods.py`, then `npx tsx tools/assets/deliver-worker-lods.ts` — PASS, both runtime tiers validate before delivery. Blender used two threads; no render output was generated.

The consolidated 2-worker sim attempt passed 33/34 checks, with only the chase timing assertion failing at 6.515 ms while the full unit suite and browser checks ran concurrently; the E07 single-worker simulation phase passed 61/61 at 1.496 ms. The last browser attempt was invalidated by a local build replacing dist while a fixture loaded (ENOENT on dist/index.html); The attempt ended with 27 passed/2 failed browser checks; final validation is run sequentially with no intervening source/build changes. Earlier E07 attempts failed once on the default 30-second pooling-fixture timeout and twice on the 4 ms chase timing gate under shared load (5.673 / 4.435 ms). The pool fixture now explicitly allows 240 seconds and separates the recycling exercise from chasing; the 4 ms performance criterion was kept. One later attempt passed all 59 selected simulation/unit checks and 28/29 browser checks, but its horde fixture assumed fewer than 200 actors were in view. Corrected bounds legitimately kept all 200; the fixture now puts one known actor far off-screen and passes its targeted 2/2 browser checks. One original run reported 145 seconds for pooling; the later targeted run took 44.8 seconds. Cancelled queue waits were restarted for updated builds/lock handling and were not counted as passed checks.

## Before/after stills and vision review

Three L1 pairs: `before/still-1.png` ↔ `after/still-1.png`, `still-2.png` ↔ `still-2.png`, `still-3.png` ↔ `still-3.png`. These are temporal capture stills, not pixel goldens.

Worker comparison: `before/worker-crowd-close.png` ↔ `after/worker-crowd-close.png`; also `worker-horde.png` and tier hierarchy stills. Four-angle silhouette checks are `after/worker-angle-{45,135,225,315}.png`.

All stills are at most 1600 px wide. Retained videos are 1280×720 WebM, at most 15 seconds each. The final after video keeps the start of the measured outbreak interval so it includes fleeing civilians and chasing infected; the baseline retained video keeps its last 15 seconds. Raw long recordings, own failed-run traces, Blender intermediate outputs and the generated 146 MB dist build were removed after validation. Rebuild before running a preview again.

See `test-results/epics/E07/crowd-feel/review.md` for the image review.

## Spec changes, limits and remaining work

- E07 AC14's old 45-second/100-body cleanup directly contradicted the PO's whole-level permanence rule. It now requires persistent identities/static poses and recyclable AI records. Nurse revival retains its existing eligibility window and original ID.
- Infected caps and ambient density are future-spawn limits after a quality downgrade; existing figures stay. E18's immediate 200→100 deletion expectation was updated in its targeted transition guard. The older E08 campaign low-density fixture still assumes deleting an existing high-tier population; recommend separating initial density from quality-change retention rather than restoring deletion. That full E08 campaign fixture was not run in this lane.
- No new dependencies, asset-reference edits or simulation animation logic. Native WebGPU and full E18 frame/device budgets remain with their owning lanes; this lane ran headless WebGL2/Metal. Corrected palette uploads add presentation work; no claim of a full device-budget certification.
- Full E08 campaign and native WebGPU were not run. Main advanced with perf-horde/L3 after the validated `8ee60c74` cutoff; integration must retain both lanes’ changes in the shared crowd/quality files. Integration into main and deployment remain with the orchestrator.

## Files touched (coordination with perf-horde)

Animation/visibility: `src/render/CrowdView.ts`, `src/render/npc/CivilianCrowd.ts`, `NpcView.ts`, `RoutineProps.ts`, `src/render/GameView.ts`, `Materials.ts`; `src/render/characters/{GaitPhase,CrowdLocomotion,CrowdFigureProbe,CrowdPosePalette,GroundContacts,NpcAnimator,PawContacts,QuadrupedAnimator,StaticCorpses,bakeInfected,clips}.ts`; `src/assets/materials.ts`; `src/debug/testApi.ts`.

Permanence: `src/sim/ai/{InfectedSystem,SpawnDirector,types}.ts`, `src/sim/locomotion/AgentMotion.ts`, `src/sim/world/{EntityStore,types}.ts`, `src/sim/missions/Mission.ts`, `src/sim/npc/{Npcs,install}.ts`, `src/sim/outbreak/Outbreak.ts`, `src/sim/interact/PropSystem.ts`.

Assets: `assets/inf.common-worker/model.lod{1,2}.glb`, `public/assets/models/inf.common-worker.lod{1,2}.glb`. Tests: `tests/e2e/crowd-feel.spec.ts`; `tests/perf/horde.spec.ts`; `tests/unit/render/{crowd-feet,corgi-feet,crowd-topology,static-corpses}.test.ts`; `tests/sim/npc/{permanence,integration}.test.ts`; `tests/sim/ai/{animals,director,specials}.test.ts`; `tests/sim/performance/horde.test.ts`; `tests/sim/props.test.ts`. Tooling: `tools/{e2e-lock.sh,sim-lock.sh,verify.ts}`, `package.json`, `tools/assets/{rebuild-worker-lods.py,deliver-worker-lods.ts}`; E07 AC14 spec and selected evidence/report files.
