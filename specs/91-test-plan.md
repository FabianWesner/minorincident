# 91 · Test Plan

This file puts the [test concept](90-test-concept.md) into practice. It lists the suites, commands, environments, the traceability from epics to tests, the milestone gates, and the release checklist.

## 1. Commands

| Command | Contents | Target duration |
| --- | --- | --- |
| `npm run typecheck` / `lint` | L0 static | < 1 min |
| `npm run test:unit` | all Vitest unit tests | < 1 min |
| `npm run test:sim` | all sim tests incl. scenario tests (no full-level bot runs) | < 5 min |
| `npm run test:levels` | bot playthroughs: `complete` ×20 seeds and `newbie` ×20 per available level (sim-runner, parallel workers) | < 15 min |
| `npm run test:balance` | `test:levels` + the balance band report + the TTK table | < 20 min |
| `npm run test:e2e` | Playwright desktop Chromium (WebGL) | < 10 min |
| `npm run test:e2e:mobile` | Playwright mobile emulation projects | < 5 min |
| `npm run test:e2e:webkit` | WebKit smoke | < 5 min |
| `npm run test:e2e:webgpu` | local only, headed with a real GPU | manual trigger |
| `npm run test:visual` | photo-spot goldens | < 10 min |
| `npm run test:perf` | deterministic counters + sim timing + bundle size | < 10 min |
| `npm run test:smoke` | §3 smoke suite | < 3 min |
| `npm run test:regression` | everything tagged for epics marked done (`specs/status.json`) | < 30 min |
| `npm run verify -- <E|M>` | epic- or milestone-scoped selection + smoke | varies |
| `npm run layouts:build` | Blender layout scripts → layout GLBs + layout JSON (cached by source hash) | ≈ 30–120 s per district |
| `npm run assets:build` / `assets:validate` / `assets:turntable` | E17 tools (headless Blender → GLB → gltf-transform; validate in Node) | build ≈ 5–30 s per asset |

Tests carry tags in their titles: `@E05`, `@E05-AC03`, `@smoke`, `@visual`, `@perf`, `@slow`, `@mobile`. `tools/verify.ts` builds the selection from these tags for Vitest (`-t`) and Playwright (`--grep`).

## 2. CI pipeline

```
stage 1  static     : typecheck, lint, schema + manifest + inventory-sync validators, assets:validate + layout cross-validation on the committed GLBs/JSON;
                       where Blender is available: assets:build/layouts:build --changed + hash check against the committed files
stage 2  fast       : test:unit, test:sim
stage 3  browser    : test:smoke, test:e2e (sharded ×4), test:e2e:mobile, test:visual
stage 4  gameplay   : test:levels (nightly + on changes to src/sim, src/levels, src/data)
stage 5  perf       : test:perf (nightly + on src/render, src/assets changes)
nightly             : test:balance full report, full-campaign bot (E24-AC08), webkit smoke
```

Artifacts from every stage are uploaded: `test-results/**` and Playwright traces on failure.

## 3. Smoke suite (`@smoke`, must always pass)

| ID | Check |
| --- | --- |
| S-01 | App boots with `?test=1`, `__SS__.ready` resolves, no console errors |
| S-02 | Title → character select → L1 start via mouse-only clicks; cursor alone does not move, click ground walks and stops, RMB ground attacks without movement |
| S-03 | `loadLevel` L1–L6 (with progression presets): each loads in ≤ 10 s, with a non-empty frame screenshot |
| S-04 | 600 ticks of the `complete` bot in L1 without errors; the player moves ≥ 10 m |
| S-05 | Determinism: 1800 ticks of the `combat-arena` script give the expected golden state hash |
| S-06 | One weapon of each category fires and hits in `combat-arena` |
| S-07 | Vehicle enter, drive 50 m, exit in `drive-course` |
| S-08 | Save → reload → continue |
| S-09 | Mobile emulation boots and shows the touch HUD |
| S-10 | Unload/reload of L1 ×3 leaves no leaked entities or bodies |
| S-11 | Tab hidden or window blur → AudioContext suspended, music paused, game paused; return → audio resumes, game stays paused |

## 4. Environments matrix

| Environment | Used for | Gate level |
| --- | --- | --- |
| Node 22 (sim-runner) | unit, sim, levels, balance, sim perf | blocking |
| Blender 5.2 LTS headless (`BLENDER_BIN`) | asset builds and determinism | blocking for asset changes |
| Chromium headless + SwiftShader WebGL2, 1600×900 DPR 1 | e2e, visual, counter perf | blocking |
| Chromium mobile emulation (Pixel 7, iPhone 14, portrait and landscape) | touch, layout, low tier | blocking |
| WebKit headless | smoke | nightly, non-blocking until M4 |
| Firefox headless | smoke | nightly, non-blocking until M4 |
| Local headed Chrome + GPU (WebGPU) | WebGPU parity, frame-time perf | per milestone, recorded |
| Real devices (1× iOS, 1× Android mid-range) | E18-AC08 fps, touch feel | M4, manual, recorded |

## 5. Traceability: epics → tests

Every acceptance criterion `E<NN>-ACxx` has a test `T-E<NN>-xx` with the tag `@E<NN>-ACxx`. The files are:

| Epic | ACs | Layers | Primary test files |
| --- | --- | --- | --- |
| E01 Foundation | 11 | static, unit, sim, e2e | `tests/unit/core/*.test.ts`, `tests/sim/determinism.test.ts`, `tests/e2e/harness.spec.ts` |
| E02 Rendering | 12 | e2e, visual, vision, unit | `tests/e2e/camera.spec.ts`, `tests/visual/lookdev.spec.ts` |
| E03 Input | 18 | e2e, sim, unit | `tests/e2e/input-{mouse,keyboard,touch}.spec.ts`, `tests/sim/recorder.test.ts` |
| E04 Survivor | 11 | sim, unit, e2e, visual, vision | `tests/sim/player.test.ts`, `tests/visual/survivor.spec.ts` |
| E05 Combat | 14 | sim, unit, e2e | `tests/sim/combat/*.test.ts`, `tests/e2e/combat-wiring.spec.ts` |
| E06 Weapons | 10 | unit, sim, e2e, visual | `tests/unit/data/actions.test.ts`, `tests/sim/weapons.test.ts` |
| E07 Infected | 19 | sim, perf, e2e, vision | `tests/sim/ai/*.test.ts`, `tests/perf/horde.spec.ts` |
| E08 Civilians/Corgi/Escort | 17 | sim, e2e, vision | `tests/sim/npc/*.test.ts` |
| E09 Vehicles | 11 | sim, e2e, visual | `tests/sim/vehicles/*.test.ts`, `tests/e2e/driving.spec.ts` |
| E10 World | 12 | static, unit, sim, visual, vision, perf | `tests/unit/districts.test.ts`, `tests/unit/layout-crossval.test.ts`, `tests/visual/districts.spec.ts` |
| E11 Interactables | 9 | sim, visual | `tests/sim/interact/*.test.ts` |
| E12 Missions | 10 | unit, sim, e2e | `tests/sim/missions/*.test.ts`, `tests/e2e/mission-ui.spec.ts` |
| E13 Progression | 9 | unit, sim, e2e | `tests/unit/progression/*.test.ts`, `tests/e2e/save.spec.ts` |
| E14 HUD/Menus | 11 | e2e, visual, vision | `tests/e2e/menus-{mouse,keyboard,touch}.spec.ts`, `tests/e2e/hud.spec.ts` |
| E15 VFX | 10 | sim, e2e, visual, vision | `tests/e2e/vfx.spec.ts`, `tests/visual/vfx.spec.ts` |
| E16 Audio | 21 | unit, sim, e2e, static | `tests/unit/audio/*.test.ts` |
| E17 Assets | 11 | static, unit, e2e, visual, vision | `tools/assets/validate.ts`, `tests/unit/assets/*.test.ts`, `tests/e2e/turntable.spec.ts` |
| E18 Performance | 9 | perf, e2e, manual | `tests/perf/*.spec.ts` |
| E19 L1 | 13 | sim, e2e, vision, perf | `tests/levels/L1.test.ts`, `tests/e2e/levels/L1.spec.ts` |
| E20 L2 | 12 | sim, e2e, vision | `tests/levels/L2.test.ts`, `tests/e2e/levels/L2.spec.ts` |
| E21 L3 | 9 | sim, e2e, vision | `tests/levels/L3.test.ts`, `tests/e2e/levels/L3.spec.ts` |
| E22 L4 | 11 | sim, e2e, vision, perf | `tests/levels/L4.test.ts`, `tests/e2e/levels/L4.spec.ts` |
| E23 L5 | 11 | sim, unit, perf, e2e, vision | `tests/levels/L5.test.ts`, `tests/e2e/levels/L5.spec.ts` |
| E24 L6 | 11 | sim, unit, e2e, perf, vision, visual | `tests/levels/L6.test.ts`, `tests/levels/campaign.test.ts` |
| E25 Lighting | 16 | static, visual, e2e, sim, perf, vision | `tests/visual/lighting/*.spec.ts`, `tests/sim/power.test.ts`, `tools/assets/validate.ts` (light anchors) |
| E26 Props/Barricades | 16 | static, sim, perf, e2e, visual, vision | `tests/sim/props/*.test.ts`, `tests/sim/barricades.test.ts`, `tests/visual/barricade-ui.spec.ts` |
| E27 Explosions/Fire/Smoke | 15 | unit, sim, visual, e2e, perf, vision | `tests/sim/explosions.test.ts`, `tests/visual/blast-sequence.spec.ts`, `tests/visual/smoke.spec.ts` |
| E28 Weather | 12 | sim, visual, e2e, perf, vision | `tests/sim/weather.test.ts`, `tests/visual/weather.spec.ts` |
| **Total** | **351** | | |

A static test (`tests/unit/traceability.test.ts`) parses every `specs/epic-*.md` acceptance table and fails if any AC ID has no tagged test **once that epic is marked in progress or done** in `specs/status.json`. The specs and the tests can therefore not drift apart.

## 6. Level test template (applies to E19–E24)

Each level suite contains:

1. **Graph walk:** `completeObjective()` from start to `level.completed` (structure).
2. **Completion:** `complete` bot × `SEEDS_20` with a 100% pass expected (from the level's progression preset).
3. **Difficulty band:** `newbie` bot × `SEEDS_20`; rate, median time, and deaths within the level's bands.
4. **Checkpoint restore:** kill the player right after each checkpoint; restore matches the snapshot.
5. **Fail paths:** each fail reason (timeout, escort, convoy) triggered on purpose leads to the retry screen; the retry works.
6. **Caps:** max concurrent infected ≤ the level cap, at both quality tiers.
7. **Browser playthrough:** the `complete` bot in Playwright at time scale 4 (driving 2), one seed, with screenshots at all of the level's photo spots and no console errors.
8. **Vision review** of the level's photo spots (checklists A, D, E).
9. **Perf counters** at the level's heaviest photo spot.

## 7. Milestone gates (entry and exit)

| Milestone | Entry | Exit (all blocking) |
| --- | --- | --- |
| M0 | specs approved | E01 done; E02-AC01–05, E03-AC01–08 pass; E17-AC01–03 pass; smoke S-01, S-05 pass |
| M1 | M0 exit | E04, E05, E06[M1], E07[M1 archetypes: runner, crawler], E08 (civilians, corgi), E25[M1: emissive + light field + sun shadows + hero lights, AC02–07, AC13], E26[M1: push/kick/sleep/explosion impulse, AC01–08], E10 (D-RES, D-MAIN, D-SHOP pharmacy), E11[M1], E12, E14[M1], E15[M1], E17 P0, E19 all ACs; smoke green; human playtest #1 on L1 (3+ players) done |
| M2 | M1 exit | E06[M2], E07[M2], E08 escorts, E09, E13, E16[M2], E17 P1, E20, E21, E26 all (barricades), E27[M2: small/medium/car explosions, smoke grenade, fire]; campaign bot L1→L3; human playtest #2 |
| M3 | M2 exit | E06[M3], E07 all, E10 all tiers, E17 P2, E22, E23, E24, E25 all (reflections, beams, key-frame reviews), E27 all (mega blasts, columns), E28 all (weather); full-campaign bot on 10 seeds; balance report all green |
| M4 | M3 exit | E18 all incl. real devices; WebKit/Firefox smoke blocking; accessibility (E14-AC09) green; no open P1 bugs; final human playtest; release checklist §8 |

## 8. Release checklist (M4)

- [ ] All suites green on the release commit. Recorded numbers: pass counts, balance medians, perf counters.
- [ ] Full-campaign bot: 10/10 seeds complete; `newbie` campaign time 30–60 min.
- [ ] Visual goldens reviewed; no pending `--update-snapshots` without a review.
- [ ] Vision reviews present for every level and district photo spot (`review.md` per epic).
- [ ] Asset inventory: all P0–P2 assets at `final`; P3 at ≥ `integrated` or cut, with the cut documented.
- [ ] Real-device fps logs stored (E18-AC08).
- [ ] Licenses: `THIRD_PARTY_NOTICES.md` (Bruno MIT, Three.js, Rapier, Howler, fonts, audio CC0) complete.
- [ ] Settings verified: blood Off/Reduced/Full, shake, flash reduction, aim assist, text size, rebinding.
- [ ] Save migration tested from every save version shipped in a pre-release.

## 9. Defect handling

A failing test produces a bug with the test ID, seed, `.ssrec` recording, screenshots or traces, and the expected vs. actual values. Severity:

- **P0:** crash, soft-lock, determinism break, level not completable.
- **P1:** wrong gameplay rule, band violation, perf budget breach.
- **P2:** visual or vision-review failure.
- **P3:** cosmetic.

Bugs go in the project's issue tracker (the `issue-tracker` skill board) with the epic ID as a label.

## 10. Risks to the test approach

| Risk | Mitigation |
| --- | --- |
| Rapier float determinism differs between Node and browser WASM builds | Same package build in both; determinism tests in both; if they diverge, cross-environment tests compare only gameplay events, not transforms |
| SwiftShader rendering differs from real GPUs | Goldens only from the CI setup; real-GPU checks handled by the local WebGPU suite and the vision review |
| A bot that is too smart hides difficulty problems | The `newbie` profile, calibrated against human playtests (§12 of the test concept) |
| Vision review leniency | Strict [must] items, mandatory justification, comparison sheets saved; a human spot-checks 10% of reviews per milestone |
| The test API leaks into production | Dynamic import behind `?test`; a bundle check verifies that the `__SS__` string is absent in the prod build (static test) |
