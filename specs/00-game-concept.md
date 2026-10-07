# 00 · Game Concept

## 1. Elevator pitch

**Minor Incident** is a colorful isometric zombie action RPG set during the **first day** of a fast-moving outbreak in the American suburb of **Sunset Grove** ("A Brighter Tomorrow"). It pairs arcade controls you learn in seconds (*move, aim, two actions*) with light progression, drivable cars, escalating weapons, and a world that visibly falls apart from level to level.

The tone mixes a playful low-poly Three.js diorama look, retro Americana, dark humor, and over-the-top stylized gore (target rating: Mature). The infected are **fast, aggressive humans**, not slow undead.

> **The player gets stronger while the city gets worse.**

## 2. Design pillars

| Pillar | Meaning | Test it implies |
| --- | --- | --- |
| **Seconds to learn** | Move, aim, two actions. No inventory screen during a level. | Onboarding: a scripted new-player bot finishes the L1 tutorial segment using only the documented inputs |
| **Short, complete missions** | Six levels of 5–10 minutes, each with a clear goal, a start, and an end | Bot playthrough times fall within the band |
| **Inverse escalation** | Player power rises while world state decays | Power score per level rises monotonically; world tier rises W0→W5 |
| **Readable chaos** | Large crowds, but the player, threats, and telegraphs stay readable | Visual review checklist plus a contrast metric on fixed shots |
| **Diorama charm** | Warm, saturated miniature suburb as in `initial-drafts/` | Fixed-camera screenshots reviewed against the concept sheets |

## 3. Core loop

```
Between levels:  choose upgrade(s) → set loadout racks → mission briefing
In level:        move → aim → left/right action → complete objective steps → survive
Level end:       mission successful / "…but" twist cutscene → unlocks
```

Moment to moment: read the threat, position, choose a side (left or right action), aim, fire or swing, reposition. Cars, hazards, and objectives interrupt that rhythm.

## 4. Player character

- Pick a **male or female survivor** at campaign start (`initial-drafts/survivors-corgi-and-equipment.png`). The choice is cosmetic only; stats are identical.
- **Corgi companion** (decided, Q1). The corgi follows the player and barks at infected that are off-screen or behind cover (a directional warning), fetches dropped pickups within 6 m, and cannot die (it hides when hurt). It shows in the HUD as in the mockup. Its later "special" (lure a group of infected) is an **action** that can be slotted like any weapon.
  **L1 rule (product owner, 2026-10-06):** in L1 the corgi has no health bar, is ignored by infected and civilians, never attacks, is not commanded and does not fetch; it only warns by stopping, stiffening, looking toward the threat, growling and barking (E19 §5.8).
- **In L1 the player is a courier** (male or female courier outfit on the survivor rigs) with a courier bicycle (E19 §5.10).
- Base stats (tuning starts here; all values live in data files):

| Stat | L1 start | Final upgrade ceiling |
| --- | --- | --- |
| Health | 100 | 250 |
| Move speed (run, the default) | 4.5 m/s | 5.6 m/s |
| Walk speed (hold Walk) | 2.0 m/s | 2.0 m/s |
| Hurt-recovery i-frames | 0.6 s | 0.9 s |
| Health regen out of combat (after 4 s) | 2 HP/s | 6 HP/s |

- **Visible evolution:** gear tier 0 is everyday clothes. Tier 1 adds a backpack and wrist tape. Tier 2 adds pads and a holster. Tier 3 adds a vest and a helmet or cap. Tier 4 adds a heavy vest, ammo belts, and a gas mask on the belt. The tier follows the progression score (E13). Weapons are always visible in the hands.

## 5. Controls

One model for every platform: **move, aim, left action, right action, selector**.

### 5.1 The directional two-slot model

- The player has two **action sides**, LEFT and RIGHT. Each side holds an **action rack** of up to 3 actions, set up between levels (L1 allows only 1 per side).
- Using a side makes it the **selected side**. Aim input now rotates *that* side's aim until the other side is used. The selected side's aim indicator is shown (a line for guns, a cone for melee, an arc and landing circle for throwables).
- The **selector** (`Q`, a HUD slot click, or an upward touch swipe) cycles the *selected* side's rack to its next action. Switching takes 0.25 s and shows a rack pop-up.
- Any action may go on any side: two guns, two melee weapons, kick plus rocket launcher, and so on.
- **Soft aim assist:** within ±12° of aim and in range, the shot direction snaps to the nearest valid infected. The strength is configurable (Off / Low / Default / High).

### 5.2 Context interaction (no extra button needed)

Doors, cars, generators, and rescue targets use **stand-to-interact**. Standing inside the interaction ring fills a radial meter (0.6 s for doors and cars, longer for objectives). Moving out cancels it. Interaction can also be completed **instantly** with `E` on the keyboard or with a **middle-click (wheel click)** on the mouse, if the mouse has one. This keeps the game fully playable with any mouse (even without a wheel button) or by touch.

### 5.3 Bindings

Classic action-RPG controls (product owner decision, 2026-10-06). The survivor only moves when the player asks it to; attacks never cause movement except the short melee lunge in §6.

| Scheme | Move | Left action (attack 1) | Right action (attack 2) | Weapon switch | Extra action (interact, enter/exit car) |
| --- | --- | --- | --- | --- | --- |
| **Mouse** | **Click a place → the survivor walks there** (click-to-move with a ground marker; holding LMB on the ground keeps walking toward the cursor). Clicking a new place re-targets. | **LMB on an infected/target** → walk into range if needed, then attack with the LEFT action; LMB held on a target repeats | **RMB on an infected/target** → RIGHT action at it (approach if out of range); RMB on the ground fires/throws the RIGHT action toward that point **without moving** | **1/2/3** select LEFT rack slots; **Shift+1/2/3** select RIGHT; **Q** cycles the last-used side; clicking a HUD weapon slot cycles that side | **Middle-click** (on a car, door, generator, rescue target — or anywhere near one) |
| **Keyboard** (with or without mouse) | `W` `A` `S` `D` (camera-relative) | `J` (also LMB when a mouse is present) | `K` (also RMB) | `1/2/3` LEFT, `Shift+1/2/3` RIGHT; `Q` cycles last-used side | `F` (also `E`) |
| **Mobile** | Bruno-style touch movement: press and drag anywhere on the left part of the screen; a floating stick appears under the finger | Large **LEFT** button (tap = attack nearest target in front with aim assist; press–drag–release aims) | Large **RIGHT** button (same) | Swipe up on the LEFT/RIGHT button cycles that side's weapon | Third button **ACTION** (enabled only near something interactable; also stand-to-interact) |

**M1-05 orchestrator decision (2026-10-06):** wheel scroll smoothly zooms the camera (0.85–1.35× default distance), preserving isometric angle and follow; two fingers pinching the world provide touch zoom. Number keys and clickable HUD slots replace wheel selection; touch keeps upward LEFT/RIGHT swipes. Shift is a rack modifier, not an attack mirror. The E02-AC02 default stays unchanged.

Mouse details (product owner, 2026-10-06, Diablo-style): left-click ground = walk there; hold LMB + move cursor = keep walking toward the cursor; left-click an infected = attack it with the LEFT weapon (approach if needed); hold LMB on an infected = keep attacking that target; **Shift + left-click = attack in place toward the cursor without moving, even with no infected near** (the swing always plays). A Shift-swing that hits a civilian is a slapstick gag: the civilian stumbles back with a "Hey!", may drop what they carry and stays annoyed briefly — no damage, never a kill; children are never hit (the swing passes through them). **Right-click cycles weapons** (product owner, 2026-10-06): the mouse scheme has ONE attack (LMB / Shift+LMB with the current weapon); RMB cycles through the carried weapons/actions, starting with **unarmed** (fists → found weapon …). Unarmed merges the former fists and kick (product owner, 2026-10-06): one unarmed style whose attacks flow through varied martial moves — jab, cross, front kick, roundhouse kick, uppercut, knee, spinning backfist — all with the same damage; consecutive clicks chain them as a combo, never the same move twice in a row, with an occasional flashier finisher; kicks keep a little knockback for feel; the HUD shows the active one and the next. Keyboard 1/2/3 select directly, Q cycles; touch keeps its buttons. This supersedes "RMB = RIGHT action" and "wheel/last-side selector" for the mouse scheme (the wheel zooms, M1-05).

**Run by default, hold to walk (product owner, 2026-10-06; bindings chosen by the orchestrator):** the survivor always moves at run speed; holding **Walk** moves at walk speed. Keyboard: hold `C` or `Alt`/`Option` while moving with WASD. Mouse: hold `Alt`/`Option` while clicking or holding LMB on the ground (left hand stays near Shift/1–3; `Ctrl` is avoided because Ctrl+click is a right-click on macOS; `Alt` keyup is `preventDefault`ed so browsers do not open their menu bar). Touch: the floating stick walks below 50 % deflection and runs above (no extra button). Walk is rebindable. There is no sprint and no stamina in L1.

Aim: with a mouse the cursor aims; with keyboard only, attacks target the nearest infected in the facing direction (aim assist); on touch, aim assist unless the player drags from an action button. Pause is `Esc`, `P` or the small on-screen pause button (not one of the three mobile buttons).

Gamepad support is **not in v1** (Q17). Action keys can be rebound; 1/2/3 and Shift remain reserved for rack selection. Mouse attacks and weapon selection have keyboard alternatives for players with a weak mouse. Pause is `Esc`, `P`, or the on-screen pause button.

## 6. Combat

### 6.1 Action categories

| Category | Examples | Behavior |
| --- | --- | --- |
| **Short range** | fists, kick, knife, bat, nail bat, crowbar, machete, shovel, police baton, sword, fire axe | Swing arc (cone and range), wind-up → active → recovery, knockback, can hit several targets |
| **Long range** | pistol, shotgun, nail gun, SMG, assault rifle, hunting rifle, machine gun, rocket launcher | Projectiles or hitscan with spread. A magazine and reload with **infinite reserve** (no ammo management). Rocket launcher: splash damage. |
| **Throwable** | grenade, Molotov, pipe bomb, firecracker lure, flashbang, smoke grenade | Arc throw to the aim point (max range per item), fuse, area effect. **Charges** recharge over time (and from pickups). |
| **Special / ability** | ground slam, shield, corgi lure, adrenaline, turret | Cooldown-based actions unlocked by upgrades; slotted like weapons |

### 6.2 Damage model

- Damage = base × upgrade multipliers × (crit 1.5 for headshots by precision weapons on non-armored heads; optional).
- **Knockback** and **stagger** come from data. Heavy hits stagger infected for 0.3–0.8 s.
- **Fast clicks until dead** (product owner, 2026-10-07): the core melee loop is rapid clicking on one target until it dies. Normal hits never knock an infected down and never push it out of reach: knockback ≤ 0.4 m, flinch ≤ 0.25 s, and the next click always connects without waiting. Knockdowns only come from the last hit (death), explicit heavy finishers and special actions; a downed infected stays hittable (ground hits) and the player never has to wait for it to stand up. The courier auto-follows a target that slid slightly out of reach.
- **Status effects:** burning (DoT, panic movement), stunned, slowed, toxic (from hazmat).
- **Friendly fire:** explosives hurt the player at 30% and hurt civilians or escorts at 100%. This makes positioning matter while staying forgiving.
- The player dies at 0 HP. They respawn at the last checkpoint and keep the level's pickups. There are no lives.

### 6.3 Feel targets

Hit-stop of 40–70 ms on melee hits. Camera shake scales with damage dealt (capped, can be turned off). Blood and impact VFX. Numbers float only for crits and special attacks, so the screen stays readable.

## 7. Infected

The infected are fast, aggressive humans. Archetypes are **mechanical roles**; visual variants come from the concept sheets.

| Archetype | Role | Base HP | Speed | Intro | Visual variants (drafts) |
| --- | --- | --- | --- | --- | --- |
| Runner | Default swarmer; lunges from 2.5 m | 40 | 4.2 (lunge 7) | L1 | common worker, jogger, skater (young adult), baseball cap, college student (aged up from the draft's schoolgirl), suburban mom, BBQ dad, delivery driver, cashier, bathrobe neighbor |
| Crawler | Low, hard to see, grabs and slows | 25 | 2.0 | L1 | crawling (wounded) |
| Brute | Charges, high knockback, slow turn | 300 | 3.0 (charge 8) | L2 | construction worker, brute infected |
| Screamer | Alerts and pulls nearby infected; prioritize | 60 | 3.5 | L2 | screamer infected |
| Sprinter | Very fast, fragile | 30 | 6.5 | L3 | sprinter infected |
| Riot | Shield blocks frontal bullets; flank or use explosives | 150 | 3.2 | L3 | riot cop infected |
| Bloated | Explodes in a toxic burst on death; damages other infected too | 120 | 2.5 | L3 | bloated infected |
| Firefighter | Fire-immune, carries an axe | 140 | 3.8 | L4 | firefighter infected |
| Hazmat | Toxic aura, immune to toxic | 120 | 3.2 | L4 | hazmat infected |
| Armored | Frontal armor; weak back | 400 | 4.5 | L5 | armored football infected |
| Butcher (elite) | Mini-boss: cleaver combo, grab | 900 | 4.0 | L4 | butcher infected |
| Nurse | Fast; "revives" downed runners once | 70 | 5.0 | L5 | nurse infected |
| Infected dog | Pack hunter (3–5), faster than the player, pounce knockdown | 30 (dachshund 20, K9 60) | 7.0 | L2 | retriever, dachshund, police K9 shepherd (S-animals) |
| Infected cat | Ambusher: perched on fences, roofs, and cars, hidden until within 5 m; leaps 6 m and clings 2 s (slow + DoT) | 15 | 6.0 (leap) | L2 | tabby, black cat |
| Crow flock | Swarm entity (8–20 birds): circles (caw crescendo telegraph), dives; interrupts aiming and reloads; dispersed by explosions, fire, shotguns | 1 per bird | 9.0 (flight) | L3 | crows (pigeons flee as ambient W0) |
| Infected lion (zoo elite) | Pouncer: roar telegraph, 10 m pounce, pins the player | 400 | 7.5 | L4 (zoo) | lion |
| Infected gorilla (zoo elite) | Brute+: chest-beat telegraph, **throws physics props** (E26), smashes barricades ×6 | 1200 | 4.5 | L4 (zoo) | silverback |
| Infected flamingos | Comic weak flock pecking (the suburban lawn-flamingo motif) | 10 each | 5.0 | L4 (zoo) | flamingo |

**Pets turn too:** dogs walked by civilians (and stray cats) can be infected (they lie down for only 2–4 s before rising). The corgi is immune and never turns. Uninfected zoo animals (zebras, an elephant) panic and stampede as a hazard in L4.

**Civilians become infected in front of you:** regular people walk around, fewer every level (60 in L1 down to 2–3 stragglers in L6). When an infected grabs one, the player has a 1.5 s **rescue window**. Otherwise the person is bitten, staggers, **lies down for a few seconds** (twitching; the eyes start glowing in the last seconds) and **gets up as an infected** wearing their own clothes. During the glowing-eyes phase the body can be finished so it never rises. Children never take part in this (E08). L1 timing: a 1.0 s rescue window and a 3.0 ± 0.5 s transformation (E19 §5.1, §5.7).

**Aggro model:** infected sense by sight (110° cone, 14 m), hearing (gunshots reveal the player within 25 m; melee within 6 m), and Screamer alerts. Before they turn, they are civilians (E08).

**L1 perception rules (product owner, 2026-10-06; E19 §5.2–5.4):** sight only — a 90° forward cone (16 m, line of sight); no hearing of the player; the closest visible human (player or civilian) is the target; on losing sight a randomized 10–18 s search (probe points, direction changes, double-backs), then wander; deliberate loud events (car alarms) attract within 30 m. Priority: visible human > distraction > wander. Speeds come from a visual tier (frail 4.7 / average 5.3 / athletic 5.6 m/s) times ±4 % individual jitter (orchestrator 2026-10-06: average raised, jitter narrowed so every average infected closes 10 m within ~17 s), all faster than the running player; civilians flee at 3.2–4.0 m/s. Later levels may re-enable hearing (gunshots) per level data. Herd cue (PO request 2026-10-07): an infected that sees another infected chasing turns toward the attacker's heading and attacks any human it then sees.

**Hordes:** waves, ambient wanderers, and **migrations** (L4–L6: big streams following path splines toward a target). Concurrent target counts are L1 ≤ 60 (v2 systemic outbreak; low tier 30), L2 ≤ 40, L3 ≤ 60, L4 ≤ 80, L5 ≤ 150, L6 ≤ 200 on the desktop "high" tier. Mobile caps are half (E18).

## 8. Vehicles

- Cars are a **temporary power-up**, not a separate driving game. Enter them with stand-to-interact at a door.
- Arcade handling with a Rapier raycast vehicle (Bruno's `PhysicsVehicle` adapted). Controls follow the active scheme: in mouse-only, the car steers toward the cursor and throttle comes from cursor distance; on keyboard, WASD; on mobile, a stick plus a brake button. LEFT action = horn / boost (the horn attracts infected); RIGHT action = exit.
- **Run-over damage:** speed above 4 m/s kills runners and knocks back brutes, which damage the car. Each car has **HP** and smokes below 40%, burns below 15%, and explodes 3 s after reaching 0.
- Cars smash **light obstacles** (fences, cones, barricades, trash cans, mailboxes) but are stopped by heavy ones (walls, trucks, concrete barriers).
- Vehicle roster: sedan, pickup, SUV, police cruiser (the siren pulls infected), ambulance, fire engine (L6 set piece, ram-strong), school bus (L5/L6 convoy).
- Infected can **grab onto** the car at low speed (under 3 m/s). Shake them off by accelerating.

## 8b. A physical, breakable town

(Full concept: [07-physics-props-explosions-smoke.md](07-physics-props-explosions-smoke.md).)

- **Everything light moves** (Bruno-style physics props): cones, bins, carts, benches, chairs, drums, propane tanks. Walk into them to nudge or push, **kick** them as projectiles, ram them with cars, and blast them with explosions.
- **Barricades without an inventory:** push props into marked gaps, stand still to **brace**, and infected must detour, vault, or tear the barricade down. Board-up points, car barricades, and sandbag cover complete the toolkit. Barricades are core in L5 (prep phases) and used in L1, L2, L4, and L6.
- **Explosions** are seven-beat spectacles (tell, flash, fireball, shockwave, debris, smoke, aftermath) with chain reactions, flipping cars, and mega blasts (the gas station, the bridge, the fuel truck).
- **Smoke and fire** carry the decay story (columns visible across town) and gameplay: smoke grenades break line of sight, toxic and tear gas, and extinguishers.
- **Light** shows safety and danger (concept [06](06-lighting-shadows-reflections.md)): restored power, floodlights, sirens, and fires; lamps can be shot out to create darkness.

## 9. World and setting

**Sunset Grove** is a single coherent town built from districts that levels reuse:

| District | Content (drafts) |
| --- | --- |
| `D-RES` Residential | cul-de-sac, street corner, backyards, safe-house, porches, fences |
| `D-MAIN` Main Street | Joe's Diner, gas station / convenience store, Maple Hardware, intersection, bus stop |
| `D-SCHOOL` School | Sunset Grove Elementary entrance, bus loading zone, playground, gym/cafeteria |
| `D-SHOP` Shopping | supermarket, mini-mall concourse, food court, pharmacy/clinic |
| `D-CIVIC` Civic | police checkpoint, fire station, hospital exterior, evacuation / safe-zone camp |
| `D-PARK` Parks | neighborhood park, baseball field, creekside path, campground |
| `D-ZOO` Sunset Grove Zoo (**new**, sheet `animals-pets-and-zoo.png`) | entrance, lion and gorilla enclosures, flamingo pond, petting zoo, reptile house; it borders the rail line |
| `D-EDGE` Town edge (**new**, sheet `town-edge-bridge-rail-substation-helipad.png`) | river bridge, rail crossing, tunnel, power substation, highway on-ramp, extraction pad |

**World-state tiers** (art direction §5): W0 normal → W1 panic → W2 emergency response → W3 breakdown → W4 overrun → W5 destroyed. One district layout with tier "decay layers" lets L6 revisit earlier places convincingly at modest asset cost.

**Time of day:** the whole campaign is one day. L1 is late morning, L2 midday, L3 afternoon, L4 golden hour (the signature look of the drafts), L5 dusk, L6 night with fires. The final extraction happens at dawn.

## 10. Progression

- **Between levels only.** After each level the player picks **2 of 3 offered upgrade cards** (the offer is seeded and fixed per save) and receives the level's **fixed unlocks** (story weapons).
- Upgrade families: Health, Speed, Melee damage, Gun handling (magazine and reload), Throwables (charges and radius), Knockback, Weapon-specific perks (e.g. "Nail bat bleeds"), Specials (ground slam, shield bubble, corgi lure, adrenaline), Vehicle (ram armor, boost).
- **Rack setup screen:** drag (or tap) owned actions into the LEFT and RIGHT racks. The racks hold 1/1 in L1, 2/2 from L2, and 3/3 from L4.
- **Power score** = a weighted sum of stats, weapon tiers, and abilities. It must rise monotonically across L1→L6 for every legal choice path (tested).
- **Save:** campaign progress (unlocked level, upgrades, racks, character) goes in `localStorage` behind a versioned schema. A level always restarts from its start or a mid-level checkpoint; nothing is saved mid-level across sessions.

## 11. Campaign

**Stop it → Rescue people → Reach safety → Open an escape → Protect the escape → Escape yourself**

| Level | Title | World tier | Districts | New mechanics | Unlocks at end |
| --- | --- | --- | --- | --- | --- |
| L1 | Special Delivery (Stop the Outbreak) | W0→W1 | D-GROVE (compact L1 neighbourhood: café, courier depot, medical annex, garage, fire station) | movement (run default, walk modifier), bicycle, evasion by line of sight, unarmed fighting, first melee weapon, stand-to-interact, world toys | baseball bat (found in the garage) |
| L2 | Get Them Out | W1 | D-RES → D-SCHOOL → D-PARK (evac point at the baseball field) | firearms, throwables, second slot, escorts, Brute, Screamer | pistol / shotgun, Molotov; rack 2/2 |
| L3 | Reach the Safe Zone | W2 | D-MAIN → D-SHOP → D-CIVIC (safe-zone camp) | **vehicles**, route choice, timer, Sprinter, Riot, Bloated | SMG or rifle, vehicle perks |
| L4 | Open the Escape Route | W3 | D-CIVIC → D-ZOO → D-EDGE (substation, rail crossing, bridge) | multi-task objectives, hazards (power, fire), Butcher elite | heavy weapons (machine gun, rocket launcher), stronger explosives; rack 3/3 |
| L5 | Hold the Line | W4 | D-RES street → D-MAIN gas station → D-CIVIC checkpoint → D-EDGE bridge | wave defense, fallback positions, convoy HP, Armored, Nurse | final-tier upgrades |
| L6 | Get Out | W5 | revisit D-RES, D-SCHOOL, D-SHOP, D-CIVIC, D-MAIN → D-EDGE extraction | everything; driving set piece; final stand; ending | credits, New Game+ (optional) |

The detailed level designs are in the level epics [E19](epic-19-level-1-stop-the-outbreak.md) through [E24](epic-24-level-6-get-out.md).

### Story beats (proposed, editable)

- **L1 (rewritten 2026-10-06 per product owner, E19):** A normal morning. The young courier and their corgi pick up a sealed package at the Sunset Grove Courier depot and deliver it to the Sunset Grove Medical Annex lab annex. A few calm seconds after the hand-over, a contained accident inside releases five infected — among them the technician who took the package. The outbreak then spreads on its own: infected chase and bite pedestrians, who turn and hunt in turn. The courier fights with bare hands, finds a baseball bat in a neighbour's garage, sees the crowd grow beyond control and escapes to Fire Station 3. **Delivery complete. Outbreak: not contained.**
- **L2:** Get your **younger brother (from the school) and your neighbor Mrs. Alvarez** to the evacuation buses at the baseball field. The buses leave; the field is overrun as the last bus departs. You are left behind.
- **L3:** A police broadcast names the **Civic Center safe zone**, which closes at a deadline. Cross town by foot and by car. Inside the fence, a medic tent "patient" turns. The safe zone collapses.
- **L4:** The survivors' radio says the only exit is the **river bridge**: restore power at the substation, raise the rail-crossing gates, and clear the bridge blockade. Done, but a migration is coming.
- **L5:** Defend the convoy route through four fallback positions until the convoy (a school bus, an ambulance, pickups) crosses the bridge. The bridge charges blow early; you are cut off.
- **L6:** Cross the fallen city through the places you know, from the burning neighborhood to the overrun school, mall, and checkpoint. Drive the fire engine through Main Street, abandon it at the town edge, and hold the extraction pad until the helicopter arrives at dawn. Final shot: the helicopter climbs, and the horizon shows smoke over other towns. **You survived the first day.**

## 12. Session and scope targets

- 6 levels × 5–10 minutes gives 30–60 minutes per campaign, plus a replay incentive through upgrade paths.
- Platforms: desktop Chrome, Firefox, Safari, and Edge (latest), plus mobile Safari and Chrome on mid-range 2023+ phones.
- **Distribution and license (decision R3):** a **browser-only, open-source game under the MIT license**, published as a website from its repo. No stores, portals, ads, or ratings boards. Every asset in the repo must be redistributable under MIT-compatible terms (code: MIT; Bruno-derived code: MIT with notice; audio and music: CC0/CC-BY, see `09-sound-design.md` §11 and `10-music-sources.md`).
- **No real-world brands (decision R2):** all brands, logos, and store names are fictional (e.g. the draft's real gas-station brand becomes **"Sunset Fuel"**).
- Out of scope for v1: multiplayer, online services, procedural levels, a crafting or inventory screen, dialogue trees.

## 13. Accessibility and settings

Gore: Full / Reduced / Off (`01-art-direction.md` §7: Full = heavy blood + dismemberment + gibs; Reduced = blood only; Off = dark-gray splats, no dismemberment). Camera shake on/off. Aim assist strength. Screen-flash reduction. Subtitles for radio and voice lines. A colorblind-safe telegraph palette (telegraphs use shape plus color). Text size. Rebinding. Two quality tiers plus auto.
