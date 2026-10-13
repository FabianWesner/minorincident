# 04 · Epics Overview

## 1. Epic map

| ID | Epic | Milestone | Depends on |
| --- | --- | --- | --- |
| [E01](epic-01-foundation-and-test-harness.md) | Foundation, game loop and test harness | M0 | — |
| [E02](epic-02-rendering-camera-visual-style.md) | Rendering, camera and visual style | M0 | E01 |
| [E03](epic-03-input-and-controls.md) | Input and control schemes | M0 | E01 |
| [E04](epic-04-survivor-controller.md) | Survivor controller and character presentation | M1 | E01, E02, E03 |
| [E05](epic-05-combat-system.md) | Combat system (two-slot directional) | M1 | E04 |
| [E06](epic-06-weapons-catalog.md) | Weapons, throwables and abilities catalog | M1 → M3 | E05 |
| [E07](epic-07-infected-ai-and-hordes.md) | Infected AI, archetypes and hordes | M1 → M3 | E04, E05 |
| [E08](epic-08-civilians-companion-escorts.md) | Civilians, corgi companion and escorts | M1 → M2 | E07 |
| [E09](epic-09-vehicles.md) | Vehicles | M2 | E04, E05, E10 |
| [E10](epic-10-world-districts-decay.md) | World, districts and world-state decay | M1 → M3 | E02 |
| [E11](epic-11-interactables-hazards-destructibles.md) | Interactables, hazards and destructibles | M1 → M2 | E05, E10 |
| [E12](epic-12-missions-and-level-flow.md) | Missions, objectives and level flow | M1 | E04, E10 |
| [E13](epic-13-progression-and-save.md) | Progression, upgrades and save | M2 | E06, E12 |
| [E14](epic-14-hud-menus-onboarding.md) | HUD, menus and onboarding | M1 → M3 | E03, E05, E12 |
| [E15](epic-15-vfx-blood-feedback.md) | VFX, blood and feedback | M1 → M3 | E05 |
| [E16](epic-16-audio.md) | Audio | M2 → M3 | E05, E07 |
| [E17](epic-17-asset-production-pipeline.md) | Asset production pipeline | M0 → M3 | E01, E02 |
| [E18](epic-18-performance-quality-mobile.md) | Performance, quality tiers and mobile | M1 → M4 | E02, E07 |
| [E19](epic-19-level-1-stop-the-outbreak.md) | Level 1: Stop the Outbreak | M1 | E04–E08, E10–E12, E14 |
| [E20](epic-20-level-2-the-failed-rescue.md) | Level 2: The Failed Rescue (redesigned 2026-10-07) | M2 | E19, E06, E08, E09, E25, E26 |
| [E21](epic-21-level-3-the-police-collapse.md) | Level 3: The Police Collapse (redesigned 2026-10-07) | M2 | E20, E06, E08, E27 |
| [E22](epic-22-level-4-the-safe-city-falls.md) | Level 4: The Safe City Falls (updated 2026-10-11) | M3 | E21, E18, E25, E26, E27 |
| [E23](epic-23-level-5-aftermath.md) | Level 5: Aftermath (updated 2026-10-11) | M3 | E22, E08, E10 |
| [E24](epic-24-level-6-the-subway.md) | Level 6: The Subway (updated 2026-10-11) | M3 | E23, E25, E26 |
| [E25](epic-25-lighting-shadows-reflections.md) | Lighting, shadows and reflections | M1 → M3 | E02, E10, E17 |
| [E26](epic-26-physics-props-and-barricades.md) | Physics props and barricades | M1 → M2 | E04, E05, E07, E09, E10, E11 |
| [E27](epic-27-explosions-fire-smoke.md) | Explosions, fire and smoke | M2 → M3 | E05, E11, E15, E25, E26 |
| [E28](epic-28-weather.md) | Weather (sun, clouds, rain, storm, fog, wind, snow, ash) | M2 → M3 | E02, E16, E25, E27 |
| [E29](epic-29-level-7-the-ruined-city.md) | Level 7: The Ruined City | M3 | E24, E06, E07, E08–E10, E18, E25–E28 |
| [E30](epic-30-level-8-the-zoo.md) | Level 8: The Zoo | M3 | E29, E07–E10, E17, E18, E25–E28 |
| [E31](epic-31-level-9-the-crossing.md) | Level 9: The Crossing (re-planned 2026-10-13) | M3 | E30, E09, E10, E12–E14, E18 |
| [E32](epic-32-level-10-the-cure.md) | Level 10: The Cure | M3 | E31 (L9-S3/S4), E04–E08, E10–E18, E25, E27, E28 |

## 2. Milestones

| Milestone | Goal | Exit check |
| --- | --- | --- |
| **M0 Foundation** | Empty town plane with the camera, loop, input, test API, and asset registry | `npm run verify -- M0` green |
| **M1 Vertical slice** | **L1 fully playable** from greybox to final P0 assets: unarmed evasion → melee → Patient Zero → twist | the bot completes L1 on 20 seeds; human-feel review passes |
| **M2 Core campaign** | L2–L3: fire axe, handgun, allied fighters (firefighters, police squad), rides, medkits, save | bot completes L1→L3 as a campaign |
| **M3 Complete campaign through L10** | L4–L10: Alphas/war, shotgun/metro/subway, W6 rockets, zoo, armored crossing/crash, 45–50 min cure finale and playable epilogue | one-seed L1→L10 (E32-AC32), L1→L9 crash handover (E31-AC20), L1→L6 regression (E24-AC08); region budgets/checkpoints/handovers/reviews and E32 timing pass |
| **M4 Ship** | Performance, mobile, accessibility, polish, audio mix | release suite green on all platforms in the test matrix |

Epics marked "M1 → M3" deliver in increments. Each increment's acceptance criteria are tagged with the milestone (e.g. `[M1]`).

## 3. Epic file template

Every `epic-NN-*.md` follows this structure:

1. **Goal**: one paragraph
2. **Depends on / Enables**
3. **Scope**: in and out
4. **Deliverables**: files, modules, data
5. **Acceptance criteria**: a table `ID | Criterion | Verification` where the verification is one of `unit`, `sim`, `e2e`, `visual`, `vision`, `perf`, `static`
6. **Verification recipe**: the exact commands and the artifacts to inspect
7. **Notes / risks**

## 4. Definition of Done (every epic)

An epic is done only when **all** of these hold:

1. Every acceptance criterion has at least one automated test with the matching ID tag (`@E05-AC03`) and it passes.
2. `npm run typecheck`, `npm run lint`, and `npm run test:unit` are green with no new warnings.
3. `npm run verify -- E<NN>` is green (runs every test tagged with that epic plus the smoke suite).
4. The smoke suite (`npm run test:smoke`) is still green. No regressions in earlier epics' tagged tests.
5. No new console errors in e2e runs.
6. Screenshots for every `visual` / `vision` criterion are saved in `test-results/epics/E<NN>/`, and the agent has written a **vision review** into `test-results/epics/E<NN>/review.md` using the checklists in `90-test-concept.md` §7.
7. Performance counters for the epic's reference scenario are within budget (`npm run test:perf -- E<NN>`) where the epic declares a budget.
8. The epic's data and new test-API surface are documented in code (TSDoc) and in the epic file if the contract changed.
9. The agent posts a short **epic report** (`test-results/epics/E<NN>/report.md`): what was built, test results, deviations, known issues.

## 5. Working rules for coding agents

- Pick **one epic (or one milestone increment)** at a time. Read this overview, the epic file, `02-technical-architecture.md`, `90-test-concept.md`, and the epic's **Bruno references** (`08-bruno-reuse-map.md`) before coding. Port or adapt Bruno code before writing new code.
- **Use placeholders** for any asset whose status is below `integrated`. Never block on art.
- Write the test first where the criterion is mechanical (sim/unit). For visual criteria, build the scenario and screenshot spot first.
- Never weaken an acceptance criterion to make it pass. If one is wrong, change the spec in the same PR and explain why in the epic report.
- Keep `src/sim` free of DOM and renderer imports (`T-E01-03` enforces this).

## 6. Staging decisions (orchestrator, 2026-10-07)

From the remaining-scope gap audit. Nothing is cut; the order changes so that every level is playable before the expensive extras land.

- **Order:** (0) close L1 acceptance, register the 25 finished art exports, campaign foundation (real vehicle/device mission adapters, per-level runners) → (1) E26 core barricades, E25 light pools + night readability, L2/L3 content, campaign bots → (2) E27 core blasts/fire/smoke, finish L2/L3 (M2) → (3) L4, E28 rain/wind/fog/ash, E25 shadows + cheap reflections → (4) L5, L6 + L7 handover, mega spectacle, decay W4/W5 → (5) release closure: balance, visual reviews, performance, then the extras (SSR/GTAO/planar water, snow override, unused gas variants, freeform construction).
- **Bot timing:** level time bands are calibrated against the `newbie` bot and human play; levels are never padded with idle delays to hit a band.
- **Budgets** (awake props, particles, lights) are upper bounds, not targets.
- **WebGPU** is checked manually; automated browser runs are headless WebGL2 (repo rule overrides the headed WebGPU wording in 90/91).
- **Campaign flow:** no reward screens between levels (PO decision); rewards auto-apply.
- **Levels 2–6 redesign (PO, 2026-10-07):** the PO's verbatim design is [`po-levels-2-6-2026-10-07.md`](po-levels-2-6-2026-10-07.md) and wins over the epics where they disagree. E20–E24 were rewritten and renamed (The Failed Rescue, The Police Collapse, The Safe City Falls, Aftermath, The Subway); all five are `todo` (E21 was `done` for the old L3 and was reopened). The **old L2–L6 content in code** (`src/levels/missions.ts` L2/L4/L5/L6 cases, `src/levels/L3/`, the old compositions and their `@E21`/`@E22` tests) **is superseded**, but its **systems are reused**: outbreak simulation, escort follower, defend/device steps, gates, checkpoints, vehicles as kinematic rides, barricades (E26), blasts and fire (E27), lighting presets (E25), weather (E28, optional). New shared pieces: allied fighters (E20 §5.2, extended in E21/E22), the group follower (E24), districts `D-CORRIDOR`, `D-FAIR` (+ W5 twin) and `D-SUBWAY`. Where the PO text leaves something open the epics mark an "(orchestrator default — PO may change)".
- **Order after the redesign:** L2 → L3 (M2), then L4 (needs the E18 war-scene budgets and E27 mega blasts) → L5 (decay twin of L4) → L6 (E25 power groups, E26 gates). Level time bands remain provisional until their first green single-seed run (PO 10-09 supersedes older 20-seed gate wording).

## 7. Campaign update L4–L9 (PO 2026-10-11)

[`po-levels-4-9-2026-10-11.md`](po-levels-4-9-2026-10-11.md), including later PO updates at the end, **wins over older campaign/story/weapon/world notes**. **For L9/L10, the 2026-10-13 source in §8 now wins.** Preserve built content where compatible. E22 reopens for Alpha/ending changes; E07 reopens for added Alpha/animal bars and specials; E29–E31 start `todo`. E23 stays in progress and E24 stays todo. New criteria are pending implementation, even if an old tagged test passes.

| Level | Epic / title | New gameplay power | World / campaign progression | Ending / handover |
| --- | --- | --- | --- | --- |
| L1 | E19 · Stop the Outbreak | Bat | intact · Sunset Grove | fire station → L2 |
| L2 | E20 · The Failed Rescue | Axe | wounded · rescue collapses | police bridgehead → L3 |
| L3 | E21 · The Police Collapse | Handgun | collapsing · police corridor | army convoy → L4 |
| L4 | E22 · The Safe City Falls | Machine gun | war zone · D-FAIR W0→W3; internal evacuee outbreak, first 2–3 Alphas, armed civilians/military vehicles | player alone in hardware basement → L5 |
| L5 | E23 · Aftermath | Shotgun in basement at start | silent ruins · same D-FAIR W5, five survivors, scattered infected incl. 1–2 Alphas | metro with 20–30 additional survivors, doors close → L6 |
| L6 | E24 · The Subway | none | underground · D-SUBWAY calm/breach/power failure/group retreat | night exit with surviving group → L7 |
| L7 | E29 · The Ruined City | Rocket launcher, unlimited | completely destroyed · same D-FAIR W6 night, huge regular groups/multiple Alphas, no zoo animals | final horde/corridor, bus departure with burning skyline → L8 |
| L8 | E30 · The Zoo | none | zoo sanctuary fails · D-ZOO, 60 s no-objective calm, ≥ 3 internal tunnel breaches, five infected zoo species | surviving group escapes in armored vehicle → L9 |
| L9 | E31 · The Crossing | armored vehicle as temporary power | D-CROSSING, road/off-road, no gun/repair; damage stages, zero→60% speed floor | mandatory collapsed-road crash/crawl; weapons stripped to axe → L10 |
| L10 | E32 · The Cure | axe → handgun → shotgun → machine gun → rockets → mounted rotary minigun | seven streamed low-rise regions; dogs/Alphas/persistent Mega Alpha; research cure → dispersal | 60 s nearby charge + boss dead, cure mist, 2–3 min playable epilogue, pull-out/title/credits |

Weapon progression: **Bat → Axe → Handgun → Machine gun → Shotgun → none → Rocket launcher → none → armored vehicle**. Here `none` means no new weapon; acquired weapons stay selectable **until the mandatory L9 crash**, which strips all combat weapons except the axe. L10 rebuilds the arsenal at region checkpoints.

> PO, verbatim: "Bat → Axe → Handgun → Machine gun → Shotgun → no new weapon → Rocket launcher → no new weapon → armored vehicle as temporary gameplay power"
>
> "intact → wounded → collapsing → war zone → silent ruins → underground → completely destroyed → zoo sanctuary fails → open-country escape."
>
> Historical 10-11 PO, verbatim (L10 pending wording superseded in §8): "Alpha should have a health bar and special moves"; "Same for Zoo animals"; "Level 10 will be the grande finale then, I will provide story line tomorrow".

Use E07's world-space bar and four Alpha/ten zoo move tables, telegraphs ≥ 0.6 s and per-move Scene Lab scenes. Infected elephant/zebra derive from normal `amb.elephant`/`amb.zebra` bases; healthy animals have no bars. W6 is a new **decay tier**, not a quality tier. E31 streaming/LOD must hold E18 budgets on desktop and phone.

**Implementation order:** specs → E07 Alpha systems/assets → L4 Alphas/solitary ending + L5 shotgun/metro ending → L6 continuation → L7 → E07 zoo extensions + L8 → L9. Every affected epic's Implementation plan uses ordered lanes ≤ 3 h: systems first, district/assets, encounters, then Scene Lab and headless browser e2e. These were future implementation lanes; the 10-13 update below preserves completed work and supplies the L10 story/ending.

## 8. L9 re-plan and L10 finale (PO 2026-10-13)

[`po-levels-9-10-2026-10-13.md`](po-levels-9-10-2026-10-13.md) supplies the promised finale and supersedes old L9 breakdown/on-foot and pending-L10 wording. E31 remains **todo for the revised remainder**; L9-S1 durability and L9-D1 greybox are **done on main**. The old **L9-S2 is cancelled**, replaced by L9-S5 zero floor, S6 forced crash and S7 axe-only handover; retain S3/S4 shared streaming and re-plan art/encounters/evidence. E32 is **todo**, with all criteria/tests/assets planned, not implemented.

**Decisions:** L9 never breaks down before the scripted outskirts crash, even at 0 HP (60% top speed, staged 75/50/25/0% dents/glass/smoke/lights/engine). Crash destroys APC and strips weapons to `weapon.fire-axe`; abilities/nonweapon progression/corgi persist. L10 targets **45–50 min**, seven regions and depth-authored enemies with region weapon/respawn checkpoints. One Mega Alpha follows without sight checks at 0.7× run, close bursts, distance audio/ring, about ten rockets to kill. Cure backpack has no slot/speed cost. Existing mounted-gun interaction gains rotary heat, unlimited ammo; 60 s charge advances only within 25 m and release also requires boss dead. Mist kills infected humans/animals, healthy/corgi safe; playable 2–3 min ending precedes pull-out/title/credits.

**All-levels checkpoint rule:** player death respawns at the last checkpoint; region checkpoints are authoritative, and save/load cannot resurrect lost weapons/boss/cure state. E12/E13 checkpoint services are reused. Campaign firearms stay bottomless per E06; only the final minigun overheats.

**Work order:** specs → L9 remaining changes/streaming → L10 assets (Mega, dog, gun, cure, region kits) → seven regions → encounters/weapons → finale → epilogue. Both epic tables budget every executable lane ≤ 3 h: systems, district/assets, encounters, Scene Lab and headless e2e/perf. E18 budgets apply everywhere via **L9-S3/S4** region streaming, including boss/cure state off-region and wide ending camera. M3 now closes the ten-level campaign; E32-AC04 replaces generic short-level pacing and E32-AC32 replaces the obsolete 30–60 min full-campaign time gate. No source implementation is part of this spec update.
