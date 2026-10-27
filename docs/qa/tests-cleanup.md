# Test suite cleanup

Branch: `lane/tests-cleanup`. Baseline: `ea20915a2` (2026-10-27).

This report lives under `docs/qa/` because the task reserves `docs/reports/` and `test-results/` for another cleanup lane. Raw command logs and JSON measurements are captured outside the checkout under `/tmp/tests-cleanup-*`.

## Commands and partition

Baseline: `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4` (default and JSON reporters added for measurement).

`npm run test:gate` selects every untagged unit/sim/level/headless QA invariant assertion; `npm run test:nightly` selects `@nightly` assertions from that same inventory. Worker limit: four. Timing files retain serial execution ahead of functional tests. Browser smoke remains a separate headless, at most two-worker check, with `E2E_PORT=4701 SCENE_PORT=4702`.

The baseline completed all assertions: **659 files, 4,073 cases, 4,048 passed, 16 failed, 9 skipped; 4,419.21 s** on a shared remote runner. Its launcher returned exit 2 after writing the complete JSON because an in-flight launcher edit was reverted; this is separate from the 16 recorded assertion failures. Launcher files are now unchanged and frozen during runs. Final gate/nightly measurements remain pending.

## Redundancy decisions

| Removed work | Same fixture and assertion intent retained by | Unique checks preserved |
| --- | --- | --- |
| `tests/levels/L9-campaign.test.ts`: complete female campaign, seed 1, L1→L9 | `tests/levels/L10-campaign.test.ts`: same newCampaign, runLevel policy, seed, completion callback and nine-level prefix | Selected axe after the L9 reset moved into the retained n=9 assertions; save validation, world aftermath, L5 occupants, L6→L8 rosters, APC durability/identity, racks, abilities, sheltered passengers, lost rockets and transport cleanup already matched. `T-E31-20` / `@E31-AC20` now identify the retained test. |
| Complete-policy case of `tests/levels/L6-campaign.test.ts`: seed 1 L1→L6 | The same complete seed-1 segment in `L10-campaign.test.ts` | Completion of all six levels, carried L5 racks and survivor names checked in the L6 callback, plus actual station occupant IDs. `T-E24-08` / `@E24-AC08` now identify the retained test. The newbie policy's distinct 870–1590 s campaign band stays nightly. |

The short `tests/levels/L9.test.ts` adds ordinary-input standalone crossing completion to the gate, without replaying L1→L8. Similar names across static unit, gameplay sim and real browser layers were not treated as duplication.

## Coverage matrix

Paths are relative to `tests/`. All rows retain their existing assertion thresholds and negative controls unless a failure decision below explicitly explains a fixture correction.

| Contract / PO checklist | Gate owners | Nightly or separate retained owner |
| --- | --- | --- |
| L1 completion, story/input, forecourt, bike, pickup and checkpoint rules (E19) | `levels/L1.test.ts`, `levels/story-bots.test.ts`, `levels/l1-*.test.ts` | L1 portion of `levels/L10-campaign.test.ts`; real input `e2e/levels/L1.spec.ts` |
| L2 completion, boarding, alarms, escape/deaths, bridge pressure and continuity (E20) | `levels/L2.test.ts`, `levels/L2-*.test.ts`, `levels/continuity.test.ts`, `sim/missions/l2-*.test.ts` | L2 portion of the retained full campaign; `e2e/levels/L2.spec.ts` |
| L3 completion, squad, 15 s evacuation, bridge and checkpoints (E21) | `levels/L3.test.ts`, `levels/L3-*.test.ts`, `sim/missions/l3-*.test.ts` | L3 portion of the full campaign; slow evade diagnostics when tagged |
| L4 completion, collapse beats/casualties, safe plaza, alarm, MG, cellar, caps and respawn (E22) | `levels/L4.test.ts`, `levels/L4-collapse.test.ts`, `levels/L4-*.test.ts`, `levels/controls-content.test.ts` | L4 portion of the full campaign; browser `e2e/levels/L4.spec.ts` / L4 PO and movement specs |
| L5 completion, exact rescue fates, shotgun, metro occupants/closing doors (E23) | `levels/L5.test.ts`, `levels/L5-*.test.ts`, `levels/l5-po-*.test.ts`, `levels/l5-travel.test.ts` | L5→L6 racks and IDs in the retained full campaign |
| L6 completion, casualty/escape ratio, gates, power, infection, headlamp, navigation and arsenal (E24) | `levels/L6.test.ts`, `levels/L6-protection.test.ts`, `levels/l6-*.test.ts` | Complete L1→L6 prefix in full campaign; newbie segment in `levels/L6-campaign.test.ts` |
| L7 completion, starting-roster rescue ≥60%, checkpoints, departure and exact passengers (E29) | `levels/l7-audit.test.ts`, `levels/l7-checkpoints.test.ts`, `levels/l7-departure.test.ts`, `sim/missions/l7-*.test.ts` | L6→L7→L8 actual roster identity in full campaign |
| L8 completion, 60 s calm, internal breaches, animals and exact APC transfer (E30) | `levels/L8.test.ts`, `sim/npc/zoo-companion.test.ts`, `sim/vehicles/apc.test.ts` | Actual L7 roster→zoo→crossing in full campaign |
| L9 completion, 0-HP driving floor, forced crash, axe reset and corgi (E31) | `levels/L9.test.ts`, `sim/l9-*.test.ts`, `sim/vehicles/apc-durability.test.ts`, `sim/vehicles/l9-terrain-speed.test.ts` | `T-E31-20` in full campaign retains the real L8 APC/roster/arsenal handover |
| L10 completion, seven regions, pursuit, charge radius/timing, boss gate, mist, epilogue and one credits victory (E32) | `levels/L10.test.ts`, `sim/levels/l10-*.test.ts`, L10 unit contracts | `T-E32-32` full campaign; independent newbie pacing in its retained suite |
| Collision, admission, actor presence, seats, accessories, supports and all-level invariants | `qa/invariants/*.test.ts`, `levels/collision-*.test.ts`, `levels/start-checkpoint-clearance.test.ts`, `levels/respawn-*.test.ts`, `sim/world/*.test.ts` | Actual rendering in `qa/invariants/rendering/scene-lab.spec.ts` and Scene Lab matrix |
| Combat, AI, weapons, vehicles, deterministic state and save migration | `unit/`, `sim/combat/`, `sim/ai/`, `sim/vehicles/`, `unit/progression/`, `sim/progression/` | Five-minute spawn/reuse/corpse retention soak and campaign continuity |
| Render contracts: assets/LODs, materials, poses/feet, markers, UI, tier/zoom and native budgets | `unit/assets/`, `unit/render/`, `unit/tooling/`, headless QA contract tests | Existing `e2e/`, `visual/`, `perf/`, QA rendering and Scene Lab checks remain separate deploy/release layers |

## Failure triage and measurements

The initial inventory is **977 test/spec files**: 407 unit, 164 sim, 88 level, 218 E2E, 63 perf, 9 QA and 28 visual. The requested baseline runs the 659 unit/sim/level files. The new gate also includes the eight headless QA invariant files; the QA rendering spec remains a separate browser layer.

| Failure / classification | Root cause and action | Current evidence |
| --- | --- | --- |
| `T-E05-14` / `T-E06-10`, changed fixture (b) | Empty throwable triggers invoked Q-161's usable-weapon fallback. Twenty-two throwable/archetype rows measured fallback fist damage. Wait for charges and require every player attack to use the reference action. No TTK bands changed. | Corrected full reference table passed in the first focused remote batch. |
| Two house-resident cases, regression (a) and obsolete setup assumption (b) | The scripted aperture exemption survived exit admission, then disappeared when AI took control. Validate ordinary geometry without that exemption, retain queued identity, and keep walking a wider footprint out. Initial pending state is no longer required when the aperture admits the walk; actual clear exit, no pending/hidden actor, same identity/counts and no exemption are required. | Both cases passed twice remotely after the fix. |
| `T-E32-21-E3b` high/low, regression (a) plus changed driver fixture (b) | `stageNear` relocated the living boss at full charge: baseline jumps 274.77/280.58 m. Removed that forbidden teleport and its now-unused API/test. The calibration driver also followed the new moving `mega` marker away from the console; it now defends the console through both hold and boss objectives. | Removing teleport reduced approach steps to 0.0525 m. Corrected driver passed high/low twice remotely. Arrival band 135–145 s, stable boss ID, no teleport, no deaths and release checks remain. |
| Two `T-E32-20-perf` cases and `T-E32-01`, obsolete phase assertion (b) | Full charge completes `hold` and activates the separately authored `mega` objective. Require that exact transition and keep release pending while the boss lives. Charge remains exactly 3,600 ticks. | Functional graph passed; both finale performance cases passed in each of two isolated runs. |
| `T-E19-16c`, obsolete approach fixture (b) | The west facility boundary is a closed wire fence; the full bicycle footprint stops before the rider reaches the no-bike boundary. Exercise the mechanic through the actual lab gate and retain all dismount/parking/remount prohibitions. | Rerun pending. |
| `T-E22-09-shot-block-pistol`, fixture outside its valid range (b) | The civilian pistol was asked to acquire an Alpha 18 m away, outside its 8 m defence zone and 12 m gun range. Put that threat inside the defence zone and the crossing human between shooter/target. Preserve pending-shot suppression, zero friendly damage and firing after clearance. | Passed twice remotely. |
| `T-E08-13`, changed input fixture (b) | A new trigger-down edge on every tick invoked Q-161 after the pistol emptied. Hold automatic fire through reloads with no repeated down edge. Keep the 100 actual shots/hits and friendly-fire/finishing checks. | Passed twice remotely. |
| `T-E31-19-S4-200`, performance regression under investigation (a) | Serial Vitest files can still share a four-vCPU runner with another four-worker job. Extend the existing `timing-isolated.sh` with `--whole-run` for final gate/nightly measurements. No p95 budget or warmup/sample window changes. | Baseline 4.058 ms against 4 ms; isolated repeats still fail at 6.725 and 5.653 ms. Profiling pending; the 4 ms budget remains unchanged. |

The baseline's L3 file took **801.409 s**, including **344.604 s** for evade-only. Its ordinary complete case stays in the gate; slow diagnostics move nightly. L4's broad 25-case file took **1,667.322 s**; >60 s combat/collapse/checkpoint/newbie diagnostics move nightly while the 129.142 s ordinary completion case stays in the gate. The paired Alpha tier matrix is scheduled together. These are observed shared-runner times, not final gate measurements.

The completed baseline, remaining failure decisions, partition audit and final measurements are pending. No green claim is made from the interrupted local run or from the older review's 23-failure sandbox run.

Remaining baseline failures tracked explicitly: bicycle fence-side parking (two of 528 placements; extra valid orientations now searched before the overlapping fallback), post-remount riding distance (pose diagnostics added; threshold unchanged), risky road contact (driver missed the horde by 0.555 m; authored encounter waypoints now included), and Space with an empty SMG (Q-161 fallback fixture corrected to separate trigger edges). Updated focused verification is queued remotely. The review's historical L4 collapse boundary failure did not reproduce in the complete remote baseline; its original count/90-tick guard remains, with isolated repeats underway.
