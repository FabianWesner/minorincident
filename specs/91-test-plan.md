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
| `npm run test:e2e:webgpu` | manual WebGPU check only; automated real-GPU WebGL2 stays headless | manual trigger |
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
stage 3  browser    : test:smoke, test:e2e (sharded with ≤ 2 local Playwright workers), test:e2e:mobile, test:visual
stage 4  gameplay   : test:levels (nightly + on changes to src/sim, src/levels, src/data)
stage 5  perf       : test:perf (nightly + on src/render, src/assets changes)
nightly             : test:balance full report, campaign-segment bot (E24-AC08), L1→L9 bot (E31-AC20), webkit smoke
```

Artifacts from every stage are uploaded: `test-results/**` and Playwright traces on failure.

## 3. Smoke suite (`@smoke`, must always pass)

| ID | Check |
| --- | --- |
| S-01 | App boots with `?test=1`, `__SS__.ready` resolves, no console errors |
| S-02 | Title → character select → L1 start via mouse-only clicks; cursor alone does not move, click ground moves at run speed and stops, Alt+click walks, Shift+LMB attacks in place without movement, RMB cycles weapons |
| S-03 | `loadLevel` for each implemented level (currently L1–L6; add L7–L9 when their epic enters implementation), with progression presets: loads in ≤ 10 s with a non-empty screenshot; L9 first playable chunk rather than entire terrain must be ready |
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
| Manual WebGPU / headless real-GPU WebGL2 (Metal on macOS) | WebGPU parity, frame-time perf | per milestone, recorded |
| Real devices (1× iOS, 1× Android mid-range) | E18-AC08 fps, touch feel | M4, manual, recorded |

## 5. Traceability: epics → tests

Every acceptance criterion `E<NN>-ACxx` has a test `T-E<NN>-xx` with the tag `@E<NN>-ACxx`. The files are:

| Epic | ACs | Layers | Primary test files |
| --- | --- | --- | --- |
| E01 Foundation | 11 | static, unit, sim, e2e | `tests/unit/core/*.test.ts`, `tests/sim/determinism.test.ts`, `tests/e2e/harness.spec.ts` |
| E02 Rendering | 12 | e2e, visual, vision, unit | `tests/e2e/camera.spec.ts`, `tests/visual/lookdev.spec.ts` |
| E03 Input | 21 | e2e, sim, unit | `tests/e2e/input-{mouse,keyboard,touch}.spec.ts`, `tests/sim/recorder.test.ts` |
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
| E19 L1 (v2, 2026-10-06) | 26 | sim, real-input e2e, vision, perf | `tests/levels/L1.test.ts` (graph, bots, spread, checkpoints), `tests/sim/ai/l1-perception.test.ts` (cone, closest target, search, car alarm, speed tiers), `tests/sim/npc/l1-civilians.test.ts` (density, panic, bite, continuity), `tests/sim/l1-toys.test.ts` (bicycle, gates, dumpster, car wash, corgi), `tests/unit/layouts/d-grove.test.ts` (crossing time, routes, LOS blockers), `tests/e2e/levels/L1.spec.ts` (real-input playthrough, walk modifier, photo spots), `tests/perf/l1-transitions.spec.ts` |
| E20 L2 The Failed Rescue (2026-10-07) | 20 | sim, static, unit, visual, real-input e2e, vision, perf | `tests/levels/L2.test.ts`, `tests/e2e/levels/L2.spec.ts` |
| E21 L3 The Police Collapse (2026-10-07) | 21 | sim, static, unit, visual, real-input e2e, vision, perf | `tests/levels/L3.test.ts` (T-E21-01..18: graph, bots, handgun, gunfire, attack, squad, corridor, pressure, medkits, army zone, checkpoints; evade-only), `tests/unit/levels/l3-static.test.ts` (T-E21-11a/b/c layout, T-E21-15 dressing, T-E21-16 light, T-E21-17a army checkpoint), `tests/e2e/levels/L3.spec.ts` (T-E21-19 real-input playthrough and photo spots, T-E21-17b campaign hand-over to L4), `tests/perf/l3-budgets.spec.ts` (T-E21-21), Scene Lab `specs/scenes/qa-l3-*.json`; old L3 "Reach the Safe Zone" retired (its E12 deadline checks re-tagged `@L3-legacy` in `tests/sim/missions/adapters.test.ts`) |
| E22 L4 The Safe City Falls (updated 2026-10-11) | 20 | sim, static, unit, visual, real-input e2e, vision, perf | `tests/levels/L4.test.ts`, `tests/e2e/levels/L4.spec.ts` |
| E23 L5 Aftermath (updated 2026-10-11) | 19 | sim, static, unit, e2e (offline audio), real-input e2e, vision, perf | `tests/levels/L5.test.ts`, `tests/e2e/levels/L5.spec.ts` |
| E24 L6 The Subway (updated 2026-10-11) | 19 | sim, unit, visual, real-input e2e, vision, perf | `tests/levels/L6.test.ts`, `tests/levels/campaign.test.ts` |
| E25 Lighting | 16 | static, visual, e2e, sim, perf, vision | `tests/visual/lighting/*.spec.ts`, `tests/sim/power.test.ts`, `tools/assets/validate.ts` (light anchors) |
| E26 Props/Barricades | 16 | static, sim, perf, e2e, visual, vision | `tests/sim/props/*.test.ts`, `tests/sim/barricades.test.ts`, `tests/visual/barricade-ui.spec.ts` |
| E27 Explosions/Fire/Smoke | 15 | unit, sim, visual, e2e, perf, vision | `tests/sim/explosions.test.ts`, `tests/visual/blast-sequence.spec.ts`, `tests/visual/smoke.spec.ts` |
| E28 Weather | 12 | sim, visual, e2e, perf, vision | `tests/sim/weather.test.ts`, `tests/visual/weather.spec.ts` |
| E29 L7 The Ruined City | 20 | sim, unit, static, visual, real-input e2e, vision, perf | planned `tests/levels/L7.test.ts`, `tests/e2e/levels/L7.spec.ts`, `tests/perf/l7-budgets.spec.ts`, `specs/scenes/qa-l7-*.json` |
| E30 L8 The Zoo | 20 | sim, unit, static, visual, real-input e2e, vision, perf | planned `tests/levels/L8.test.ts`, `tests/e2e/levels/L8.spec.ts`, `tests/perf/l8-budgets.spec.ts`, per-move `qa-zoo-*.json` and `qa-l8-*.json` |
| E31 L9 The Crossing | 20 | sim, unit, static, visual, real-input e2e, vision, perf, manual | planned `tests/levels/L9.test.ts`, `tests/e2e/levels/L9.spec.ts`, `tests/perf/l9-budgets.spec.ts`, campaign extension and `qa-l9-*.json` |
| **Total** | **472** | | |

A static test (`tests/unit/traceability.test.ts`) parses every `specs/epic-*.md` acceptance table and fails if any AC ID has no tagged test **once that epic is marked in progress or done** in `specs/status.json`. The specs and the tests can therefore not drift apart.

### 5.1 PO 2026-10-11 changed/new test IDs (planned coverage)

Old IDs/tags are preserved so built compatible assertions remain. **A matching existing tag is structural coverage only; revised behaviors are pending until assertions are extended and pass.** E07 and E22 reopen; E29–E31 are `todo`, so traceability does not demand nonexistent implementation tests yet. This spec task only runs the traceability unit test and typecheck; level/browser/perf verification belongs to implementation.

| Epic | Changed existing T-ids | Required added assertions |
| --- | --- | --- |
| E07 | `T-E07-01`, `T-E07-05`, `T-E07-06`, `T-E07-14`, `T-E07-19` | 13 human/8 animal roster, Alpha resistance/line damage, shotgun/corpse permanence exception, shared bars, all 14 special moves with ≥ 0.6 s telegraphs/cooldowns and per-move scenes |
| E22 | `T-E22-09`, `T-E22-12`, `T-E22-13`, `T-E22-15` | civilian fire obstruction, 2–3 Alphas with bars/four moves and soldier concentration/broken E26 gaps, player alone in hardware basement |
| E23 | `T-E23-01`, `T-E23-04`, `T-E23-12`, `T-E23-15`, `T-E23-16` | basement shotgun/roles, 1–2 sparse Alphas, 20–30 metro occupants/physical ingress/closing doors, checkpoint ownership/roster |
| E24 | `T-E24-04`, `T-E24-08`, `T-E24-14`, `T-E24-17` | L5 exact station cohort and shotgun, segment regression, night→L7 handover/pair camera, zero credits/menu |

All unchanged T-E07/E22/E23/E24 ids remain required. Move tests use suffixes under the parent AC tag, so no spec-only fake test tags are added to code:

| T-id(s) | Parent tag | Required proposed Scene Lab scene(s) |
| --- | --- | --- |
| `T-E07-06-charge` | `@E07-AC06` | `qa-alpha-charge.json` |
| `T-E07-06-ground-slam` | `@E07-AC06` | `qa-alpha-ground-slam.json` |
| `T-E07-06-grab-throw` | `@E07-AC06` | `qa-alpha-grab-throw.json` |
| `T-E07-06-roar` | `@E07-AC06` | `qa-alpha-roar.json` |
| `T-E07-19-lion-pounce`, `T-E30-10-lion-pounce` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-lion-pounce.json` |
| `T-E07-19-lion-flank`, `T-E30-10-lion-flank` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-lion-flank.json` |
| `T-E07-19-gorilla-roar`, `T-E30-10-gorilla-roar` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-gorilla-roar.json` |
| `T-E07-19-gorilla-pound`, `T-E30-10-gorilla-pound` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-gorilla-pound.json` |
| `T-E07-19-gorilla-throw`, `T-E30-10-gorilla-throw` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-gorilla-throw.json` |
| `T-E07-19-elephant-charge`, `T-E30-10-elephant-charge` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-elephant-charge.json` |
| `T-E07-19-elephant-swipe`, `T-E30-10-elephant-swipe` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-elephant-swipe.json` |
| `T-E07-19-zebra-kick`, `T-E30-10-zebra-kick` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-zebra-kick.json` |
| `T-E07-19-zebra-stampede`, `T-E30-10-zebra-stampede` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-zebra-stampede.json` |
| `T-E07-19-flamingo-dive`, `T-E30-10-flamingo-dive` | `@E07-AC19`, `@E30-AC10` | `qa-zoo-flamingo-dive.json` |

Every move scene checks activation/impact/expiry and two activations separated by the cooldown, target/radius/wall boundaries, save/restore timers and phone health bars. `T-E30-15` additionally verifies every infected species' bar and zero bars on healthy animals. Scene files are implementation deliverables, not present/claimed passing in this specs-only commit.

| New T-id | AC tag | Scope (normative criterion is in the epic) |
| --- | --- | --- |
| `T-E29-01` | `@E29-AC01` | Graph (exit → rocket → route → corridor → bus departure) is structurally completable with 0–35 living followers, no fail timer or kill-all condition. |
| `T-E29-02` | `@E29-AC02` | `complete` finishes one seed from `L7-default`, no cheats, boarding ≥ 60 % of its starting followers (orchestrator default) |
| `T-E29-03` | `@E29-AC03` | L6→L7 preserves living survivor ids/state, health and acquired loadout |
| `T-E29-04` | `@E29-AC04` | Rocket pickup on a wrecked army vehicle is ≤ 5 m from exit and usable before first required combat |
| `T-E29-05` | `@E29-AC05` | 600 rocket shots produce no empty, reload, reserve, overheat or ammo HUD state |
| `T-E29-06` | `@E29-AC06` | One rocket kills ≥ 20/24 regular 60 HP infected within 3 m of impact within one blast-resolution tick and opens a ≥ 3 m gap |
| `T-E29-07` | `@E29-AC07` | Default Alpha fixture follows E07: 2 center rocket blasts, 3 close shotgun shells, 43 army-MG hits to HP depletion |
| `T-E29-08` | `@E29-AC08` | Over one run 4–6 Alphas and ≥ 400/200 regular infected arrive high/low |
| `T-E29-09` | `@E29-AC09` | Composition uses D-FAIR W6 |
| `T-E29-10` | `@E29-AC10` | W6 dressing meets §5.1 counts and exceeds W5 in fires, damaged/collapsed facades and wrecked military vehicles |
| `T-E29-11` | `@E29-AC11` | Living survivors follow actual opened paths behind the player |
| `T-E29-12` | `@E29-AC12` | Final corridor starts blocked by ≥ 120/60 regular infected + ≥ 2 Alphas |
| `T-E29-13` | `@E29-AC13` | A working bus stands at the corridor's far end |
| `T-E29-14` | `@E29-AC14` | `L7` is night, exit light matches L6 |
| `T-E29-15` | `@E29-AC15` | Music follows combat→departure phases |
| `T-E29-16` | `@E29-AC16` | Death after `night-exit`, `rocket`, `corridor` restores weapon ownership, living/dead/turned roster, W6, encounter/director state and bus progress without duplicated pickup/actors. |
| `T-E29-17` | `@E29-AC17` | Headless Playwright real mouse/keyboard completes exit→pickup→horde→bus→L8 on one seed with zero console errors and all §6 captures |
| `T-E29-18` | `@E29-AC18` | Pair-camera vision review A/D/E/G/H: recognizable Fairhaven, worst destruction so far, large rocket crowd clearance, Alpha human silhouette, followers escaping and receding burning skyline |
| `T-E29-19` | `@E29-AC19` | `perf-l7-final-horde` holds E18 high/low counters: draws ≤ 600/300, triangles ≤ 1.5M/500k, sim p95 ≤ 4/6 ms, infected ≤ 200/100, heap ≤ 400/250 MB |
| `T-E29-20` | `@E29-AC20` | In headless real-GPU WebGL2 desktop/phone profiles, peak-horde frame p95 ≤ 16.7/33.3 ms after warmup, transitions/blasts ≤ 50 ms desktop |
| `T-E30-01` | `@E30-AC01` | Graph (arrival/calm → internal breach → fight to vehicle → board/depart) is completable with 0–35 carried survivors, no kill-all objective or fail timer. |
| `T-E30-02` | `@E30-AC02` | `complete` finishes one seed from `L8-default` without cheats, ≥ 60 % of carried group survives (orchestrator default) |
| `T-E30-03` | `@E30-AC03` | L7 bus arrives at D-ZOO |
| `T-E30-04` | `@E30-AC04` | For exactly 60 active sim seconds after control returns there is no objective/waypoint/forced tutorial or scripted attack/conversion/breach |
| `T-E30-05` | `@E30-AC05` | Before breach, strong closed walls, ≥ 20 local civilians, ≥ 6 soldiers, ≥ 4 staff, ≥ 8 normal animals incl |
| `T-E30-06` | `@E30-AC06` | Outside-wall infected fixture cannot cross the perimeter or damage inside occupants during calm |
| `T-E30-07` | `@E30-AC07` | First breach begins at 60 s ± 1 tick, at ≥ 3 inside tunnel points ≥ 20 m apart within a 1 s window |
| `T-E30-08` | `@E30-AC08` | In unprotected seeded fixture, logged attack/bite target categories include civilian, soldier, staff and normal animal |
| `T-E30-09` | `@E30-AC09` | In isolated unprotected fixtures all five normal zoo species turn 2.5–3.5 s after bites, keeping id/location/species, adopting lion/gorilla/flamingo or derived elephant/zebra brain/appearance |
| `T-E30-10` | `@E30-AC10` | **All ten E07 zoo move rows** meet ≥ 0.6 s telegraph, exact cooldown/damage/range/radius/arc, knockdown/pin/stagger, roar/flank/herd expiry and wall/one-hit controls |
| `T-E30-11` | `@E30-AC11` | After breach regular infected, 3–5 Alphas over run, turned civilians and infected zoo animals coexist |
| `T-E30-12` | `@E30-AC12` | D-ZOO has ≥ 2 connected escape paths from each main enclosure, clear width ≥ 2.5 m |
| `T-E30-13` | `@E30-AC13` | Living group follows without teleport (> 1 m/tick) |
| `T-E30-14` | `@E30-AC14` | Escape APC has no mounted gun or firing action and valid driver/exit anchors |
| `T-E30-15` | `@E30-AC15` | Every infected zoo species and Alpha uses E07 world-space bar: damaged OR ≤ 15 m, fill within 1 %, one-frame update, phone ≥ 48×6 CSS px and ≥ 3:1 contrast, truthful occlusion/death |
| `T-E30-16` | `@E30-AC16` | Calm→breach→mixed-battle→engine phases emit appropriate music/ambience/telegraph captions |
| `T-E30-17` | `@E30-AC17` | Death after each checkpoint restores calm timer, breach progress, human/animal healthy/bitten/turned/dead state, weapons and group/vehicle roster without replaying or duplicating conversions. |
| `T-E30-18` | `@E30-AC18` | Headless real-input Playwright explores during calm, observes breach, fights to APC and loads L9 on one seed with zero console errors |
| `T-E30-19` | `@E30-AC19` | Vision review A/C/D/E/G on calm/outbreak pairs reads strong sanctuary then internal mass outbreak, normal→infected lion/gorilla continuity, mixed threats and armored escape |
| `T-E30-20` | `@E30-AC20` | `perf-l8-mixed-outbreak` high/low holds E18 draws ≤ 600/300, triangles ≤ 1.5M/500k, sim p95 ≤ 4/6 ms, heap ≤ 400/250 MB, 200/100 infected incl |
| `T-E31-01` | `@E31-AC01` | Graph starts seated in L8 APC and ends at next-city outskirts in vehicle or on foot, no fail timer, repair or kill-all gate |
| `T-E31-02` | `@E31-AC02` | L8→L9 retains vehicle id/current/max durability, player health/acquired arsenal and exact living roster, with driving control within 0.5 s and no reward/menu. |
| `T-E31-03` | `@E31-AC03` | APC model/action map has no mounted gun |
| `T-E31-04` | `@E31-AC04` | D-CROSSING has roads, countryside and dry driveable terrain, ≥ 3 connected routes ≥ 900 m, ≥ 2 viewpoints with ≥ 150 m clear sight lines, and next-city silhouette/guidance |
| `T-E31-05` | `@E31-AC05` | Driver leaves/rejoins roads, crosses open terrain and completes each route |
| `T-E31-06` | `@E31-AC06` | Every contact onset with active infected, including at < 0.5 m/s and downed infected, deducts exactly 10 durability once |
| `T-E31-07` | `@E31-AC07` | Stopped/surrounded hull fixture meets §5.3 targeting: 10 damage per attack, ≥ 0.6 s windup, cooldown ≥ 1 s per attacker |
| `T-E31-08` | `@E31-AC08` | Durability bar current/max equals state within one render frame on 1600×900 and 390×844, contrast ≥ 3:1, no touch-control overlap |
| `T-E31-09` | `@E31-AC09` | Durability clamps to 0, emits one breakdown, disables drive/ram, cancels ordinary E09 explosion |
| `T-E31-10` | `@E31-AC10` | After breakdown acquired six-weapon default arsenal is selectable on foot, current health/roster preserved |
| `T-E31-11` | `@E31-AC11` | One-seed route fixtures demonstrate intact-vehicle arrival, early breakdown ≤ 20 % progress and late breakdown ≥ 80 % |
| `T-E31-12` | `@E31-AC12` | Chunk streamer exposes resident/queued/unloaded counts |
| `T-E31-13` | `@E31-AC13` | Terrain LOD seams differ ≤ 2 cm, vehicle never falls through or leaves support > 1 tick |
| `T-E31-14` | `@E31-AC14` | Death/checkpoint/save reload restores route progress, vehicle durability/broken state, occupants/arsenal, chunk state and special enemy timers |
| `T-E31-15` | `@E31-AC15` | Outskirts arrival completes in vehicle and on foot, logs mode/durability/survivors and retains loadout for future L10 |
| `T-E31-16` | `@E31-AC16` | `L9-crossing` dry night lighting gives ≥ 3:1 player contrast at foot spots, long terrain views on both tiers |
| `T-E31-17` | `@E31-AC17` | Headless Playwright real mouse/keyboard drives a road/off-road route and separately continues after early breakdown, both reach outskirts with zero console errors |
| `T-E31-18` | `@E31-AC18` | Vision review A/D/F/G: open countryside/dry terrain differs from urban maps, multiple route choices and next-city destination read clearly, unarmed APC/durability and on-foot alternative legible |
| `T-E31-19` | `@E31-AC19` | `perf-l9-crossing` sweeps all routes high/low: draws ≤ 600/300, triangles ≤ 1.5M/500k, infected ≤ 200/100, sim p95 ≤ 4/6 ms, heap ≤ 400/250 MB and all E18 caps |
| `T-E31-20` | `@E31-AC20` | Continuous one-seed `complete` campaign L1→L9 preserves bat→axe→handgun→machine gun→shotgun→none→rocket→none→temporary APC progression, all level handovers/roster states and vehicle/foot ending |

L7–L9 real-input e2e uses **headless** Playwright ≤ 2 workers; Vitest ≤ 4 workers, driving time scale ≤ 2. Mac real-GPU WebGL2 uses `--use-angle=metal`; WebGPU remains manual. Reuse an existing dev server on 3300. New mobile/performance coverage includes L7 repeated rockets, L8 mixed species/bars/specials and L9 every road/off-road route/chunk seam in vehicle/on-foot modes. E31-AC20 extends designed campaign continuity to L9; L10 has no test or epic until the PO storyline arrives.

## 6. Level test template (applies to E19–E24 and E29–E31)

The newer per-level PO single-seed policy overrides the older 20-seed template batteries below as blocking gates. Expanded seed batteries may be diagnostic; they must not delay acceptance. Full designed campaign means L1→L9 (L10 pending).

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
| M3 | M2 exit | E06[M3], E07 all, E10 all tiers, E17 P2, E22, E23, E24, E29, E30, E31, E25 all (reflections, beams, key-frame reviews), E27 all (mega blasts, columns), E28 all (weather); single-seed L1→L9 campaign (E31-AC20); per-level budgets/handovers and calibrated bands green; L10 pending PO |
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
