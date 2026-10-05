# 99 · Decision Log

All open questions were answered by the product owner on **2026-10-05**. The specs already reflect each decision. To change one, edit the referenced files and add a new row here (keep the history).

| # | Question | Decision | Reflected in |
| --- | --- | --- | --- |
| Q1 | Is the corgi part of the game? | **Yes, as a companion that can't die.** It warns of off-screen threats, fetches pickups, hides when hurt, and "corgi lure" is a slottable ability. | 00 §4, E08, E14 |
| Q2 | Mockup's 4 ability cards vs. 2 sides + selector | **2 sides + selector.** The HUD shows LEFT/RIGHT cards with rack strips. | 00 §5, 01 §8, E05, E14 |
| Q3 | Mouse-only movement | **Cursor steering with a 1.2 m dead-zone ring**; aim = toward the cursor | 00 §5.3, E03 |
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

No open questions remain.
