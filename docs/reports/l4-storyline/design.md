# L4 storyline redesign: "the wall comes down"

PO, verbatim (10-23): "L4 is still no action. Except of one alpha who appears out of nothing (bad storyline), nothing happens. I want you to re-think the entire storyline here and improve. Maybe we don't need these walls, or make them destructable, so Zombies or alphas can tear them down and then float oin."
PO, verbatim (10-23, Q-159): "Also in L4 people behave strange".

## 1. What happens today (measured on main 43af5bf3c)

Sim census, `npx tsx tools/sim-runner/l4-action-census.ts 3 low` (complete bot, god, low tier; output `test-results/l4-storyline/census-low-3-complete.json`).
Visibility is the game camera at the PO zoom 1.5 (radius 28.5 m, polar 0.3π), any part of a standing body on screen.

| minute after the turn | phase | infected alive (mean) | inside the perimeter (mean / max) | within 12 m of the courier (mean) | new infected | spawned in view |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | war | 10 | 4.3 / 18 | 1.4 | 100 | 46 |
| 1 | war | 9 | 2.8 / 18 | 0.7 | 89 | 0 |
| 2 | war | 12 | 6.3 / 13 | 2.1 | 63 | 0 |
| 3 | war → collapse | 33 | 8.2 / 12 | 2.0 | 62 | 1 |

- Of the 191 s of "Hold the plaza", **115 s have no infected within 12 m of the courier** and 38 s have none inside the perimeter at all.
- Kills: soldiers 323, armed civilians 153, player 72, heli 18, tank 17. ~600 infected arrive, but the army and the armed civilians shoot them while they come over the wire one by one (every infected vaults the 1.12 m wire anywhere, `perimeterVaults`). Nothing builds up, so the plaza stays empty: the PO's screenshot (1:53 remaining, zero infected) is the normal state, not bad luck.
- **Spawns in view:** the 9 alarm infected appear at t = 0 among the waiting rows (x −27…−22, z ≈ 10, 9–11 m from the courier, fully on screen), and the line-1 pushes (t = 34–54 s) spawn 17 more in view inside the camp (x ≈ −30, z ≈ 10 and z ≈ −9.6). That is the "appears out of nothing".
- **Alphas:** 6 on low, spawned 27–53 m away out of view (t = 32, 84, 92, 120, 138, 148 s). They walk in and vault the wire like any runner; nothing announces them, so the first one the courier notices is simply there.
- **Civilians (Q-159), browser probe** `tools/playtest/probe-l4-civilians.ts` (WebGPU, low, zoom 1.5): 15 of 16 unarmed civilians are in `npc-cower` 15 s after the turn and 8 still are 70 s later, with the nearest infected 30–100 m away. `Outbreak.shelter()` gives every arrival a permanent cower story; `refugeSpot()` falls back to the person's own position when the doorway is crowded, so chatting pairs "shelter" where they stood and cower face to face in the open (ids 61/63 at the plaza chat spot −27/−20, 8). Before the alarm, `waitingIdle` also gives one in four idle L4 civilians the cower and one in four the hug clip.

## 2. The intended fantasy (E22)

"The safe city falls": a clean, organised army camp; false safety; the alarm; the army holds, then loses three lines on beats; Fall back; the run to the cellar. The collapse director (line 1 at 50–62 s, nests at 110–124 s, armour at 170–182 s, Fall back at +8 s) stays: it is PO-approved and well tested. What is missing is the **reason the lines fall that the player can see**: today the wall is a hurdle every infected hops, so there is never a front.

## 3. Proposal: the wall is the front

The military wall becomes the story device. It is solid for everyone until something tears it down; the horde comes in through breaches the player watches happen.

Beat sheet (seconds after the turn = the machine-gun pickup):

| t | beat | what the player sees | objective / feedback |
| --- | --- | --- | --- |
| 0 | Alarm | Klaxon. The alarm group bursts out of the registration tent and containers (spawned inside the buildings, never on open pavement in view). Civilians run for the tents and doorways. | "Hold the plaza with the army"; radio `L4.war` |
| 0–30 | The fence | Street waves arrive out of view and **pile up against the wire**: no vaulting any more; they claw at the wall (E26 attack on the wall segment in their way), soldiers fire over it. The courier sees a growing crowd at the fence on two sides. | radio "They're at the wire!" |
| 30–40 | Alpha 1 (west) | The first Alpha comes **down the west street from out of view** (spawned ≥ 25 m out at the street mouth, walks a visible route), roars, and batters the west breach segment. | radio "Big one at the west fence!", existing Alpha roar |
| ~40 | Breach 1 | The west segment breaks (logged E26 HP damage, no scripted deletion): blocker and nav cell open, the piled infected flood through toward the line-1 sandbags. | 1.6 s camera beat `l4-breach-west`; radio "The wall is down! West side!" |
| 50–62 | Line 1 falls | Existing director beat, now driven by the flood through the breach. | existing `L4.line1` beat |
| 84–104 | Alphas 2+3 (south, north) | They come from Lakeshore / the NW alley as today, but break the south and north **wall** breach segments first, then charge the nest slots behind them (existing jobs). | radio per breach; `l4-breach-*` camera beat for the first one in view |
| 110–124 | Nests fall | existing | existing |
| 150–182 | Armour | existing (tank swarmed); the remaining Alphas use the open breaches. | existing |
| +8 s | Fall back | Gate opens, the whole wall stops blocking (as today), fuel-truck chain. | existing |

Rules:
- **No in-view spawns.** Inside emergence (alarm group, line pressure, inside groups) only at spots that are `director.offscreen` or occluded by a building; if none qualifies the group waits. Street spawns already obey this.
- **Every Alpha enters along a route:** spawn at its street mouth out of view (≥ 25 m), walk in; the first ones target a wall breach segment.
- **Walls:** the four long perimeter boxes become ~56 E26 barricade slots of 2.4 m (`groupId: 'l4-wall'`, height 1.12, not player-buildable). Three breach sites (west, north, south, in front of the existing E26 sandbag slots) have breakable HP; the others are reinforced (effectively unbreakable). A broken slot unblocks physics and nav through the existing `Interactables.unblock` path, so infected path through the breach. The renderer hides broken segments and leaves rubble. The vault rule is removed.
- **Civilians:** unarmed civilians flee to real shelter (camp shelter spots and doorways) and huddle there facing the building; whoever finds no free spot keeps looking for another instead of sheltering where they stand. A cower only lasts while an infected is within 15 m; otherwise they stand alert (glance/look-around). Before the alarm, idle L4 civilians never cower or hug. Unit test: no civilian holds `npc-cower` without an infected within 15 m.
- **Hats on bowed heads:** with the open-pavement cower gone, most bowed heads go too. I will check the sun hat at LOD1 on low at close zoom and whether the LOD crowd band drops near figures to LOD2 (the low-poly bald head).

## 4. Difficulty

The army's accuracy and damage, the caps (60/120 infected), wave sizes and the collapse beat windows stay as they are (E22-AC13). What changes is that infected bunch up at the fence and come in as floods through 1–3 gaps instead of one by one anywhere, so more of them get inside and reach the plaza (target: infected inside the perimeter in every minute of the hold, mean ≥ 6 from minute 1). The breaches also funnel them, which suits the machine gun (26 m, pierce 1). If the census shows the courier is swamped (bot deaths > 2 on seed 3, E22-AC02), I lower the wave scale (`l4.war.waveScale` 3 → 2.5) rather than touching the army.

Tests: L4 level tests updated where they assume vaulting (`L4-perimeter`), plus new ones: the wall breaks only by logged damage, infected pass through the breach, no inside spawn in view, the civilian cower rule.

## 5. Result of phase 2 (lane l4-civilians, 10-23)

Built: the wall as 58 E26 slots (`src/data/l4Perimeter.ts`), the Alpha breach job (announce, run-up, repeated charges, logged damage, `batterResist` 0.15 while at the wire), the flood order (`LevelFourWar.funnel`), HUD lines ("Alpha at the west wall", "Hold the west breach"), the ring/minimap pin at the gap, radio lines, one camera beat for the first breach, and damage stages in `MilitaryPerimeter` (cracked, sagging, fallen). Civilians: cower only with an infected within 15 m, and a crowded doorway is still the shelter. Balance: low headroom 12 → 6 and low alive shares .7/.8/.6 → .85/.9/.8; armed-civilian pistol range 18 → 12 m and hunting rifle 32 → 16 m, because armed civilians made more kills than the soldiers once the pile stood still at the wire. Soldier stats are unchanged.

Census after (same command, seed 3, low, complete bot):

| minute | inside the wall, mean / max (before) | inside, mean / max (after) | at the wire (after) | within 12 m of the courier (before → after) |
| --- | --- | --- | --- | --- |
| 0 | 4.3 / 18 | 2.6 / 13 | 13.3 | 1.4 → 0.8 |
| 1 | 2.8 / 18 | 4.0 / 12 | 5.2 | 0.7 → 0.5 |
| 2 | 6.3 / 13 | 3.5 / 8 | 7.0 | 2.1 → 4.0 |
| 3 | 8.2 / 12 | 7.2 / 14 | 8.5 | 2.0 → 1.6 |

The breaches open at 46 s (west), 118 s (north) and 119 s (south). The visible change is the pile at the wire and the breach set piece. The number of infected inside the wall per minute is about the same as before, because the army and the armed civilians still kill most of them in the gap: kills are soldiers 140, armed civilians 207, player 78. The target of mean ≥ 6 from minute 1 is **not met**.

## 6. Finish pass: authored sources and courier-side flood (2026-10-24)

Six outer street-end / alley mouths now pass a one-metre courier-position sweep, including the camp boundaries, at zooms 0.5–1.5, desktop landscape, phone portrait and phone landscape, with the six-metre camera guard. Each mouth also has a navigation path to the camp streets; merely being walkable was insufficient for sources beyond the district's connected streets. Solid-building occlusion is accepted by the director; vehicles and generic collision walls cannot authorize a visible spawn. Pending groups retain every authored quota and try the nearest eligible mouth. Their finite street approach survives the ordinary ten-second investigation cutoff.

The alarm and recurring interior population walk out of the three freestanding reception tent doors. A later full-route audit rejected the registration kit exits: its tables and canopy seal the apparent aisle, so those doors no longer source infected. Alarm identities all exist on the pickup tick; extra residents wait inside the tents through normal body admission. Interior pressure arrives in groups of 4–6, with 1.5 seconds between completed groups; street-wave scale stays 2.5. Each flap uses a single-file queue. Its route remains owned through knockdown and recovery; each step and recovery checks body clearance, so the aisle cannot release or stand a resident inside another body. Armed civilians defend only within eight metres of themselves or their shelter. On a breach, the first line physically retreats east past the courier; its checkpoint stays in the plaza in front of that second line. Street groups press toward the nearest living defender inside the camp or the courier rather than stopping at the gap.

Soldiers prioritize breached Alphas without HP, rifle damage or accuracy changes. Per the orchestrator's explicit exception, an L4 soldier within six metres may approach a downed Alpha inside the wall and shoot the body permanently through the normal bullet-damage transaction. The gun points downward at the body. Other levels, outside-wall bodies and player-only knockdowns retain shared recovery. The input driver reads the visible north-up route pin and uses ground-relative WASD at close turns. Wave scale is 2.5 after repeated escape deaths, as required by the difficulty rule.

Seed-3 low census at zoom 1.5, complete bot (`node --import tsx tools/sim-runner/l4-action-census.ts 3 low complete`):

| minute after turn | PROD inside mean | previous lane inside mean | final inside mean / max | within 12 m mean | hold seconds with contact |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 4.3 | 2.6 | 4.9 / 12 | 3.9 | 60 / 60 |
| 1 | 2.8 | 4.0 | 6.4 / 11 | 2.8 | 59 / 60 |
| 2 | 6.3 | 3.5 | 7.2 / 14 | 3.4 | 59 / 60 |
| 3 (11 s of hold) | 8.2 | 7.2 | 15.4 / 19 | 4.8 | 11 / 11 |
| **whole hold** | — | — | — | — | **189 / 191 s = 99.0%** |

The census records zero unanimated in-frame admissions: 145 animated door walkouts and one existing person visibly turning. Excluding **every** actor still on its tent walk, courier contact is **135 / 191 s = 70.7%**. This extra check prevents a blocked emergence from satisfying the contact metric. Four of the five Alphas that entered before Fall back were permanently finished beforehand (52.7, 116.2, 129.2 and 139.6 s after the alarm). The fifth entered at 177.0 s; the sixth stayed outside until after Fall back. Raw per-second positions, active-versus-emerging counts, admission origins, Alpha entry/down/finish times and twenty-second pressure samples are in [committed per-second census](census-low-3-complete.json).


Performance work: newly arriving hordes use the existing seven infected model batches, while original people retain their appearance through infection. Wall colour buffers upload only when damage or boundary feedback changes them. A dead person still carrying an infection component no longer keeps a nearby civilian cowering.

The first batching change introduced a render-ownership regression: assigning `inf.*` to `appearance.asset` made `CrowdView` defer to the civilian renderer, which only loads `npc.*`. Newly born hordes were invisible but could deal damage. The fix leaves native runners owned by `CrowdView`, with no civilian appearance override; a regression test and live draw-submission probes cover it. **All timing, captures and bot results from the invisible build were discarded.** The table above is from the corrected build. A separate live audit of **PROD (13l), bundle `index-CHVJ2PT3.js`, did not reproduce this invisibility**: at 180 s all four sampled living on-screen births, including a runner with `npc.civilian-elderly` and three Alphas, had drawn figures. Its normal civilian appearance remains owned by the civilian renderer. See [PROD draw proof](prod-13l-visibility.json) and [PROD born population capture](captures/prod-born-180s.png).

Matched PO-setting views (1280×720, WebGPU, low, DPR 1, zoom 1.5, courier at −22.85 / 0.7): [PROD 90 s](captures/prod-90s.png) → [lane 90 s](captures/after-90s.png), [PROD 150 s](captures/prod-150s.png) → [lane 150 s](captures/after-150s.png). The lane capture probe requires every nearby on-screen living native runner to have an actual submitted figure: **5/5 at 90 s, 44/44 at 150 s; zero missing** ([draw proof](horde-visibility.json)). Story captures show [the wire pile](captures/1-pile-at-the-wire.png), [announced battering](captures/2-alpha-battering.png), [open breach](captures/3-breach-open.png), [soldier approach](captures/4-soldier-approaches-downed-alpha.png), [permanent finish](captures/5-soldier-finishes-alpha.png) and [the flood](captures/6-flood.png).

Validation in progress: typecheck, lint, the finisher/recovery regression and all six mouth camera/connection checks pass. Exact remote unit/level, wave census, full invariants, real-input no-skip, visual smoke, paired PROD frame timing and final captures are being measured on the unrestricted runner. The earlier sandbox restrictions no longer apply. Do not mark the goal complete until these final gates are green.

The seven legacy checks retain their intent: alarm allocation and alarm wave count measure all door-source quotas; collapse samples casualties at the first physical breach and retains its <10 bound; perimeter checks intact segments and authored openings; T-E22-09 checks staged approaches and wall destruction; ally combat distinguishes shelter posture from a service queue; collision placement checks actual admission and the new fallback posts against solids. The fallback posts are east of the courier and clear of the parked convoy. Seed-1 complete probes on both low and high finish with zero collision violations; all three usable tent exits also pass full-route capsule clearance and navigation connection checks.

At wave scale 2.5, the first browser escape retries were killed by ordinary runners on the open Metro Road centreline (x=48.5, z≈−10 to +3); one retry also took a 100-damage Alpha hit near the Lakeshore turn. The old authored corner at (−2,41) intersected a street prop: both escape and finale guidance now use the clear (−4,43) turn, and route-point collision checks pass. The driver now steps around visible blocking bodies, fires before melee contact, uses the carried axe at arm's length, and collects visible nearby medkits while continuing along the displayed route. Its final no-skip result is still pending.

The browser trace exposed a separate observation bug: its old `input.visible` ground-navigation ray rejected drawn bodies above low cover, leaving the courier taking runner hits with an empty perceived-enemy list. L4 observations now require submitted on-screen figures and use solid-building camera occlusion; a missing optional joint probe no longer hides an otherwise drawn figure. The driver stops approaching when the displayed breach distance falls below six metres and steps back into the camp from a close Alpha. Health-pack clicks are limited to the visible viewport and clear of HUD buttons.
