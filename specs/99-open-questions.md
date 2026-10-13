# 99 · Decision Log

Historical decisions below were answered by the product owner on **2026-10-05**. **The 2026-10-11 campaign source and the 2026-10-13 L9/L10 source supersede conflicting historical rows** (notably Q5/Q6/Q7/A1/W1); the current decision/pending section is at the end. To change one, edit the referenced files and add a new row here (keep the history).

| # | Question | Decision | Reflected in |
| --- | --- | --- | --- |
| Q1 | Is the corgi part of the game? | **Yes, as a companion that can't die.** It warns of off-screen threats, fetches pickups, hides when hurt, and "corgi lure" is a slottable ability. | 00 §4, E08, E14 |
| Q2 | Mockup's 4 ability cards vs. 2 sides + selector | **2 sides + selector.** The HUD shows LEFT/RIGHT cards with rack strips. | 00 §5, 01 §8, E05, E14 |
| Q3 | Mouse movement | **Revised 2026-10-06 (product owner): click-to-move** (click a place → walk there; LMB/RMB on a target = attack 1/2; wheel = weapon of the last-clicked side; middle-click = extra action). Cursor steering is dropped. | 00 §5.3, E03, E09 |
| Q4 | Interaction without an extra button | **Stand-to-interact (radial fill)**, plus instant interact with **`E`** and with **middle-click (wheel click)** when the mouse has one | 00 §5.2–5.3, E03-AC12, E11-AC01 |
| Q5 | Ammo | **Infinite reserve + magazines and reloads**; throwables use recharging charges | 00 §6.1, E05, E06 |
| Q6 | Story specifics | **Keep as proposed** (Patient Zero courier + medical cooler, brother + Mrs. Alvarez, Civic Center safe zone, river bridge, helicopter extraction) | 00 §11, E19–E24 |
| Q7 | Time of day | **One day: morning → night → dawn.** L4 uses the drafts' golden hour. | 01 §4, E02 |
| Q8 | Gore level | **More gore**, rated Mature: heavy blood, accumulation, frequent dismemberment, gibs. Still stylized low-poly (no realistic viscera). Full/Reduced/Off setting. | 00 §1/§13, 01 §7, 03 §4.4, 05 §4.9, E07-AC15, E15, E17-AC11 |
| Q9 | Car destruction | **Smoke → fire → explode** | E09 |
| Q10 | Friendly fire | **Own explosives: player 30%, escorts 100%** | E05 |
| Q11 | Difficulty modes | **One difficulty + assist settings** | 00 §13 |
| Q12 | New Game+ / replay | **Post-v1** | 00 §11 |
| Q13 | Renderer | **WebGPU with WebGL2 fallback.** Assets are developed with **Blender** (see Q18). | 02 §1 |
| Q14 | Character animation | **Procedural rigid-part clips + GPU-baked crowds** | 02 §6, 03 §4.4, E17 |
| Q15 | Audio source | **CC0 libraries + generated** | E16 |
| Q16 | Platforms | **Desktop evergreen + 2023+ mid-range phones** | 00 §12, E18 |
| Q17 | Gamepad | **Not in v1** | 00 §5.3, E03 |
| Q18 | How Blender fits the pipeline | **Blender replaces img2threejs.** Codex imagegen reference → upscaled clean reference → agent-written `bpy` build script (source of truth, in git) → Blender exports GLB → gltf-transform (merged by material, animatable parts kept separate) → the game loads GLB only. **No img2threejs in production.** | 03 (rewritten), 05, E17 (rewritten), 02 §1/§6 |
| O1 | How are district layouts authored? | **Hybrid.** Blender layout scripts (`layouts/<district>/layout.py`) build the static world (terrain, roads, static dressing, visual decay layers) into layout GLBs + layout JSON with placement and anchor empties. The bpy script is code, so it can be diffed and reviewed, and the studio scripts render district previews. **Gameplay anchors** (spawns, triggers, objectives) are **TypeScript data** in `src/levels/districts/*.ts`, type-checked and validated against the layout. Rejected: pure Blender (forces gameplay tuning through Blender) and pure TypeScript (loses visual placement of terrain and dressing). | 03 §2/§5b, 02 §2, E10 (scope, AC01, AC11–12), 91 |
| O2 | How do built GLBs get into the game and CI? | **Commit GLBs** (models and layouts). CI validates them in Node; where Blender is available it rebuilds changed sources and checks that the hashes match the committed files. | 03 §10, 91 §2 |

| D1 | Lighting ambition (2026-10-05) | **A stunning lighting concept is required**: five lighting layers (emissive + bloom, light field, hero lights with shadows, volumetric beams and flares, reflections incl. wet streets, glossy floors, glass, water, mirrors), light anchors authored in Blender, power groups. Showcase: the light-tower trailer at night. | 06, E25 |
| D2 | Movable objects, smoke, explosions (2026-10-05) | **Bruno-style movable physics props that are part of the gameplay** (kick, push, ram, **barricades**), a seven-beat explosion anatomy with chains, smoke as atmosphere + gameplay | 07, E26, E27, level ACs |
| D3 | Reuse of Bruno code (2026-10-05) | **Reuse as much as possible**: every epic lists its Bruno source files; reuse modes and porting rules in the reuse map | 08, all epics |

| R1 | Child characters with heavy gore | **Infected and civilians in the infection loop are adults or older teens.** The draft's schoolgirl becomes a college student, the teen skater a young adult. Children appear only as protected, scripted NPCs (the brother, school, buses): never targeted, bitten, gored, or infected. | 00, 03 §3, 05, E08-AC15, 90 checklist C |
| R2 | Real trademark in the drafts (gas station) | **No real brands anywhere**; the gas station becomes the fictional "Sunset Fuel"; **one town name everywhere: "Sunset Grove"** (drafts saying "Riverdale"/"Riverside" get renamed; the real railcar mark "UTLX" is replaced); the imagegen preamble and the vision checklist C enforce it | 00 §12, 03 §3, 05, 90 |
| R3 | Distribution | **Browser-only, open source, MIT license, no distribution** (no stores or portals). All repo assets must be MIT-compatible (code MIT, audio CC0/CC-BY) | 00 §12, 09 §11, 10 |
| C1 | Civilians | Regular people walk around, **fewer every level** (60 → 2–3). Turning cycle: grab (rescue window) → bite → **lie down for 4–8 s** (eyes glow at the end, can be finished) → rise as an infected in their own clothes | 00, E07, E08 (AC03, AC11–AC16) |
| A1 | Zombie pets and zoo | Infected dogs (packs), cats (ambush), crow flocks (swarm); pets of civilians can turn, the corgi is immune. **Sunset Grove Zoo** (new district D-ZOO) in **L4** on the rail-crossing route: gorilla and lion elites, flamingos, a zebra stampede | 00 §7/§9, 03, 05 §4.8d, 09, E07-AC16–19, E08-AC17, E10, E22-AC11 |
| W1 | Weather | Weather system (sun, clouds, overcast, fog, rain, thunderstorm, wind, snow, ash) with gameplay effects, scripted per level (L5 thunderstorm, L6 fog + ash fall). **Snow only as a replay override / photo mode** because the campaign is one late-summer day (changeable) | E28, 06, 09 |
| S1 | Sound | All sound improvements adopted: audio telegraphs, shared noise system, acoustics, adaptive layered music + diegetic sources, tier ambience, system sounds, mix and loudness targets, captions, haptics, offline-render testing | 09, E16 (rewritten) |
| M1 | Background music | MIT-compatible music (CC0 / CC-BY only) researched per level and slot, with a starter set. Pixabay, Mixkit, Zapsplat, and the YouTube Audio Library are excluded; Scott Buckley and Clement Panchout have extra conditions. Bruno's CC0 tracks are reusable, his SFX are not. **Open:** a human listening pass for style coherence; stems need to be made by us | 10-music-sources.md, 09 §5 |

At the original 2026-10-05 snapshot no design questions remained. The historical pending input and its 2026-10-13 resolution are listed below.

## Campaign decisions and actual pending PO input (2026-10-11)

Source of truth: [`po-levels-4-9-2026-10-11.md`](po-levels-4-9-2026-10-11.md), including later verbatim statements. Earlier ammunition/reload, zoo-in-L4, helicopter finale, dawn timeline and no-Alpha-bar defaults do not override this source.

| Decision | Current PO wording / implementation default | Reflected in |
| --- | --- | --- |
| Campaign | L4 internal evacuee outbreak/first Alphas → L5 shotgun/five-survivor rescue/populated metro closure → L6 subway/night handover → L7 unlimited rocket/W6 bus escape → L8 zoo failure → L9 temporary armored crossing | overview, E22–E24, E29–E31 |
| Alpha | PO verbatim: "Alpha should have a health bar and special moves". Source defaults specify Charge, Ground slam, Grab and throw, Roar; shared world-space bar, ≥ 0.6 s telegraphs and cooldowns. Earlier no-bar/no-special wording superseded. | E07, E22, E29, E30, inventory |
| Zoo animals | PO verbatim: "Same for Zoo animals". All five infected zoo species have bars/specials; elephant/zebra derive from normal bases. Normal animals have no bars. | E07, E30, inventory, test plan |
| Level 10 (historical; resolved 2026-10-13 below) | PO verbatim: "Level 10 will be the grande finale then, I will provide story line tomorrow". Use **Grand finale — storyline from the PO pending**; no epic yet. | overview, README, E31 continuation |
| Defaults, not questions | E07 resistance/HP/move tuning, W6 dressing counts, night/dry L8/L9 presets, L9 collision damage/chunk residency and provisional timing are explicitly orchestrator defaults. Implement/measure before seeking changes; these do not block specs. | affected epic implementation plans |

**Historical pending story input is resolved:** the promised finale arrived in the 2026-10-13 source below. Music selection/listening in historical M1 is a production review task, not an unanswered campaign story question.

## L9/L10 decisions (2026-10-13; no pending design questions)

Source: [`po-levels-9-10-2026-10-13.md`](po-levels-9-10-2026-10-13.md), PO verbatim plus orchestrator decisions. It wins over old breakdown/on-foot, pending-finale, helicopter and short campaign timing notes. Defaults are written into E31/E32 for implementation/measurement, not requests for approval.

| Decision | Current requirement / implementation default | Reflected in |
| --- | --- | --- |
| L9 durability | Damage bar and per-hit losses persist, no repair; at 0 HP APC remains driveable at about 60% speed until finale. No early breakdown/foot fallback. 75/50/25/0% cumulative dents/glass/smoke/dead lights/engine stages. Ordinary E09 destruction unaffected outside L9. | E31 AC06–10/21/22, inventory §8 |
| L9 work already built | Keep L9-S1 durability and L9-D1 greybox on main. Cancel original L9-S2; replace with S5 floor, S6 crash, S7 handover. S3/S4 supply shared streaming. | E31 plan, status, overview |
| Crash and loadout | Mandatory collapsed bridge/road at outskirts, cinematic impact then 5–8 s crawl default; destroyed APC, axe-only combat loadout. Abilities/perks/corgi persist, player gets ordinary L10 spawn health. Living passengers shelter at wreck by default, recorded in campaign history; no L10 follower obligation. | E31 AC14/15, E32 AC02/27 |
| Scale/regions | Seven low-rise regions in ≈3,300×900 m envelope, ≈4,300 m route; 47 min default (45–50 target) including 2–3 min playable epilogue. L9-S3/S4 streaming, all E18 budgets unchanged per region/seam/finale. | E32 §4/5.1, AC03/04/28/31 |
| Checkpoints/ammo | All levels respawn at last checkpoint. At least one per region, weapons and snapshot atomic. Handgun→shotgun→army MG→rocket reacquisition; campaign ammo remains bottomless/no reload management per E06. | E32 AC05/27, test plan |
| Dogs | inf.dog derives from generic retriever/K9, never corgi; fast low-profile animal brain. Companion excluded from every infection/enemy/cure path. | E32 AC07/08, inventory |
| Mega Alpha | Single ≈2× Alpha, always-knows pursuit/no LOS at 0.7× nominal run; close charge/slam/grab, unique distance roar/steps, player-centered pulsing distance ring, no exact dot/bearing. Persistent off-region position/HP, no teleports. | E32 AC10–14, inventory |
| Boss damage / early kill | About ten direct rockets; default pristine tenth kills/ninth survives. Conventional/minigun damage floor at 90% max HP; shared stagger cooldown prevents pinning. Legitimate R6 rocket kill counts, never resurrect; boss-dead flag is mandatory to release. | E32 AC12/21/22 |
| Campus/carry | Low labs/tents/generators/research vehicles/quarantine fences, recorded message + terminal, no new voice actor. Unique backpack canister, no slot/speed cost; checkpoint restores terminal/carried/installed state. | E32 AC15/16 |
| Rotary minigun | Existing mounted-gun interaction, unlimited ammo/no reload, crowd/regular-Alpha clearance, overheat bar and persistent heat across remount. Gun/dodge lanes within console hold zone. | E32 AC17–19, inventory |
| Charge / release | 60 s sim-time progresses only within ≤25 m while alive, pauses outside and resumes with retained progress. Death restores pre-charge ready snapshot. Release needs installed cure AND 60 s AND Mega dead, then explicit console interaction. | E32 AC20–22 |
| Cure / epilogue | Airborne agent kills every touched infected within one tick, never cures/reverts them; harmless to healthy humans/animals/corgi. Unloaded/campaign zoo outcome persists. Combat ends; playable 120–180 s, survivors emerge, final 30–45 s camera pull-out → Minor Incident → credits. | E32 AC23–26 |
| Production order | Specs→L9 changes→L10 assets→regions→encounters/weapons→finale→epilogue; all executable lanes ≤3 h using current owners. New tests/scenes are planned, no code in this spec lane. | E31/E32 plans, 91 §5.2 |

**No pending PO storyline/design questions.** Timing, density, footprint, move/heat/mist/audio tuning and passenger shelter are explicit orchestrator defaults; calibrate with first green single-seed route and report measured deviations. Human music/device/WebGPU checks remain production evidence, not a story blocker.
