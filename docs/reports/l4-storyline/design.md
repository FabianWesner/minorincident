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
