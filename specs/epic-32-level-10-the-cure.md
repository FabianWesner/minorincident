# E32 · Level 10: The Cure

> **NEW 2026-10-13 per product owner:** [`po-levels-9-10-2026-10-13.md`](po-levels-9-10-2026-10-13.md) is the source of truth, including its orchestrator decisions. All ACs are **NEW**. Sizes, densities, attack tuning and pacing below are **orchestrator defaults, changeable after measurement**. This is planned scope, not a claim of implemented systems or assets.

## 1. Goal

Finish the campaign with a 45–50 min journey from the L9 wreck, alone on foot with the axe, through seven distinct low-rise regions. Rebuild the arsenal while a Mega Alpha relentlessly pursues; obtain the airborne cure at the research campus, carry it to the dispersal complex, hold near the charging console and kill the boss. Release the cure, then keep playing as infected collapse and survivors emerge. The camera pulls out over the spreading mist, followed by **Minor Incident** and credits: the outbreak the player helped start in L1 finally ends.

> PO, verbatim: "This is not another five-minute snackable level. It is the full finale."
>
> "The player can never permanently escape it."
>
> "They do not turn back into humans."

## 2. Depends on / Enables

E31 (forced crash, axe-only handover; **L9-S3/S4 shared terrain/collider/nav streaming**), E04/E05/E06 (controller, axe/firearms/rockets), E07 (Alpha specials, animal brains, crowd caps), E08 (protected corgi/survivors), E10/E11 (districts and mounted-gun/device interaction), E12/E13 (mission/checkpoint/progression/save), E14 (HUD/minimap/touch), E15/E27 (pooled mist/death/explosion VFX), E16 (distance cues/music director), E17 (derived assets/LODs), **E18** (budgets), E25/E28 (lighting/dry weather). Enables M3 complete L1→L10 and M4 shipping. No new framework, dependency, voice actor or multiplayer system.

## 3. Scope

**In:** seven streamed regions; depth-based threat curve; weapon checkpoints; infected dogs; regular Alphas; one persistent Mega Alpha with approximate-location pursuit, close burst moves, distance audio and minimap ring; research terminal/recorded message, backpack cure; mounted rotary minigun with unlimited ammo/overheat; 60 s nearby charge, mandatory boss death, explicit release; expanding lethal-to-infected mist; playable epilogue, camera pull-out/title/credits; death at last region checkpoint, performance/mobile and Scene Lab evidence.

**Out:** skyscrapers, driving/replacement APC, a second animal or AI framework, rescue/conversion of infected, infection of the player's corgi, backpack weight/escort penalty, weapon-slot cure, procedurally generated regions, added human voice casting or an extraction/helicopter ending.

## 4. Level and region map / story beats (47 min default)

One authored district **D-CURE**, composed from seven adjacent streamed region sets; region IDs are local keys, not seven new district services. Global route anchors continue E31's local chunk placement beyond the older architecture's ±400 m town convention. Default footprint ≈ **3,300 × 900 m**, winding connected route ≈ **4,300 m**. Detours, low structures and landmarks make distance legible; no skyscrapers. Sizes below are rough local envelopes with seam overlap, not dimensions to sum as a straight strip. Time is elapsed gameplay including travel, fights/interactions and epilogue, excluding deaths/retries/credits. Travel estimates include path turns and brief evasion, not idle padding.

| Region / route order | Rough size; critical route | Travel / encounters-story time | Elapsed window / total | Region checkpoint and weapon location | Infected density curve (high / low concurrent local target) |
| --- | --- | --- | --- | --- | --- |
| R1 `crash-outskirts` | 300×250 m; 250 m | 1.5 / 1.5 min | 0:00–3:00 / **3 min** | `cure-crash`, safe L9 crawl anchor; **axe only**. Mega Alpha introduced by roar/impact by 2:00. | **4–8 / 4–8** regular; no dogs/Alphas in first minute; singletons/pairs with avoidable groups. |
| R2 `residential-fringe` | 500×400 m; 600 m | 3 / 3 min | 3:00–9:00 / **6 min** | `cure-residential`, police/security post near entrance: **handgun** (`weapon.pistol`). One meaningful patrol/blocked-street detour. | **12–24 / 8–16** regular; 1–2 dogs after pickup; houses/hedges break normal LOS. |
| R3 `industrial-area` | 600×450 m; 750 m | 3.5 / 3.5 min | 9:00–16:00 / **7 min** | `cure-industrial`, survivor barricade at depot entrance: **shotgun**. Warehouse yard/service route alternatives. | **25–45 / 16–28**; tougher individuals and 2–4 dogs; 1 regular Alpha across this region, conventionally killable. |
| R4 `military-zone` | 650×450 m; 800 m | 4 / 3 min | 16:00–23:00 / **7 min** | `cure-military`, destroyed military post at entrance: **machine gun** (`weapon.army-mg`). Breached checkpoint and motor pool. | **45–75 / 28–45**; regular groups 10–20, 2–4 dogs, 1–2 regular Alphas across region. |
| R5 `research-campus` | 500×400 m; 550 m | 2.5 / 3.5 min | 23:00–29:00 / **6 min** | `cure-research-entry`; low lab terminal/recording; **cure pickup around 25:00** → automatic `cure-research` checkpoint at lab exit. No new weapon. | **55–85 / 35–55** including quarantine pressure, 2–4 dogs and 1–2 regular Alphas; no permanent safe pause from Mega Alpha. |
| R6 `destroyed-corridor` | 800×300 m; 1,000 m | 4.5 / 3.5 min | 29:00–37:00 / **8 min** | `cure-corridor`, wrecked rocket supply position near entrance: **rocket launcher** before complex. Rubble/defensive line breaches and multiple Alphas. | **80–130 / 50–75**; groups 20–35, 3–5 dogs, 2–3 regular Alphas across region. |
| R7 `dispersal-complex` | 450×400 m; 350 m | 1.5 / 6 min + 2.5 min epilogue | 37:00–47:00 / **10 min** | `cure-complex`, outer service platform; `cure-disperse-ready` after installation before charge. **Mounted rotary minigun** on central platform. | **140–190 / 75–95** at assault peak including dogs, up to 3/2 regular Alphas and the one Mega Alpha; mist brings active combat density to zero. |
| **Total** | **≈4,300 m route** | **20.5 min travel + 24 min encounters/story + 2.5 min epilogue** | **47 min; acceptance band 45–50 min** | **At least one checkpoint per region; research/installation add story checkpoints** | Hard global cap **200/100**, including every infected archetype and boundary overlap. |

Weapon pickups happen at the named security/barricade/military/supply checkpoint, before its denser section. The pickup and checkpoint snapshot are one transaction so a death never removes the newly acquired weapon. Regional threat is authored by distance/depth and encounter anchors, **not a reaction that spawns enemies when inventory changes**. Early routes remain playable with careful axe evasion; later obstacles/defend/device/weapon objectives prevent skipping the whole journey by sprinting directly to release. Use existing mission prerequisites with visible goals, not arbitrary locked invisible borders. Density targets are resident encounter peaks, not simultaneous targets to sum across regions; later-region ranges include all dogs/Alphas/boss where resident. Low tier keeps the same route, mission order, boss HP, dog mechanics and story, thinning regular crowds only.

## 5. Systems and reuse

### 5.1 Region streaming, persistence and E18 performance

Reuse **L9-S3** terrain view lifecycle/cache/LOD/local anchors and **L9-S4** collision/nav ownership, predictive prefetch and serialized region/entity state. Add D-CURE data and region transition anchors to those services. Default 100×100 m chunks, detailed residency ≤ **25/9 high/low**; current playable chunks plus a bounded seam ring, with coarse low-rise horizon beyond. Do not load all seven regions or their GLBs/physics at level start. Prefetch the next seam ≥ 2 s of player's maximum permitted run speed ahead, and warm boss/weapon shaders before visible contact. Delayed visual loads never remove collision/nav support or freeze input. Neighbor-region encounters share one infected cap and release unreferenced GPU/collider/nav resources after handoff.

Off-region regular infected/corpses/doors/pickups serialize into the same chunk snapshots, preserving IDs/health/timers on revisit. No resurrection, double pickup or new canister through unload/reload. Keep one compact **persistent Mega Alpha state** (position, HP, pursuit route, move cooldowns and last damage) independent of render residency (§5.4), counted against the infected budget even while coarse. Checkpoint restores include region/chunks, weapons, cure state, boss and charge/mission phase. Reuse existing save migration/version handling; do not invent a new save manager.

E18 holds **in every region, boundary and finale**, not just average: **draws ≤ 600/300; triangles ≤ 1.5M/500k; concurrent infected ≤ 200/100; sim p95 ≤ 4/6 ms; heap ≤ 400/250 MB** high/low. Also hero lights **8 (3 shadowed)/3 (1)**, awake props **150/60**, debris/gibs **120/80 / 40/30**, smoke/mist particles **6k/2k**, column puffs **400/120**, audio **32/16**; mist shares smoke budget, never adds another pool cap. Inactive-region pursuit updates remain inside sim p95. Headless real-GPU WebGL2 frame p95 ≤ **16.7/33.3 ms** desktop/phone profiles, desktop seam/activation hitch ≤ **50 ms**; SwiftShader counter/visual tests do not claim real-GPU fps. Five R1↔R7 unload/revisit cycles leave heap/GPU resource counts within 10% of first warmed cycle. Real iOS/Android ≥ 30 fps p50 recorded; WebGPU manual. E18 initial download ≤ 15 MB gzip stays intact: L10 packs lazy-load as the route advances.

### 5.2 Checkpoints, arsenal and health

All-levels rule: **respawn at the last checkpoint**, including R1, never at L1 or a prior region by default. Explicit whole-level replay is a separate menu action. Reuse E12/E13 checkpoint snapshots and existing progression pickups, selectors and action IDs; weapon assets are existing `wpn.pistol`, `wpn.shotgun`, `wpn.machine-gun` (action `weapon.army-mg`) and `wpn.rocket-launcher`. L10 standalone preset matches E31's axe-only start, ordinary spawn health, retained abilities and protected corgi; campaign start consumes the crash payload. No campaign weapon can be selected before reacquisition, even via old unlock flags.

Existing **bottomless campaign ammo** applies (E06 campaign override): no ammo counter, ammo pickups or magazine/reload management; existing fire/rocket cooldown cadence remains. Rocket checkpoint guarantees weapon entitlement and at least ten repeatable direct shots; ammunition scarcity cannot soft-lock the mandatory boss. Only the mounted rotary minigun adds the specified heat constraint. Touch can change weapons, interact and mount/dismount. Health pickups use existing medkits at checkpoint approaches and route detours; no automatic vehicle/weapon restoration or unlimited boss stunlock.

### 5.3 Infected dogs and regular Alphas

**`inf.dog`** is a derived generic non-corgi dog asset using the current `infected.dog` role/animal rigid-part pipeline (reuse retriever/K9 base where available; inspect placeholder status). It is visually low, four-legged, infected-eyed and distinct from humans/corgi. Default move speed **1.1× nominal player run**, packs **1–4**, bite/pounce windup ≥ **0.6 s**, ≤ **2 m** reach, cooldown ≥ **2 s**, damage **10 HP** per bite. Reuse animal steering/pounce and stagger, with no new sensing system. Hearing/LOS are ordinary local infected rules; dogs may be evaded with obstacles, killed or staggered by axe/firearms. Their low silhouette must remain readable under crowded/higher-camera views. Protected companion is excluded from infection, infected spawns, enemy targeting and cure damage; historical pet-infection paths cannot select it.

Regular Alphas keep E07 HP/resistance/world-space bars and four specials; conventional weapons can kill them. R3 introduces one, later regions increase counts from the map table. Their smaller silhouette/bar and audio distinguish them from the ≈2× Mega Alpha. Reuse existing move cooldown/telegraph rules; no duplicate Alpha combat system.

### 5.4 One persistent Mega Alpha

**`inf.mega-alpha`**, about **2× regular Alpha scale**, derived from its rig/LODs with heavier silhouette and unique roar. Introduce pursuit within the first **2 min** (default first R1 viewpoint at 1:30, start ≥ 80 m behind along a reachable route). Spawn once; stable ID persists through streaming/checkpoints. It always reads the player's global position, **without sight or hearing checks**; corgi lure cannot redirect it. This knowledge is AI-only: the player's minimap never receives an exact boss dot.

Cruise speed **0.7× nominal uninjured player's run speed** (±2%); never 0.7× a momentary slow/walk speed. It follows reachable shared region/nav waypoints around obstacles and continues while off-camera/off-region. Use the existing fixed-step AI and L9 snapshot route ownership; a coarse **2 Hz** off-region route update advances distance by the same speed × sim-time, then detailed AI resumes before close contact. No arbitrary teleport, respawn ahead, region-border stop or HP reset. A route obstacle cannot permanently trap it; reuse Alpha destructible-line breach/nav updates or authored reachable alternate paths. Persistent pursuit creates pressure without simulating all regions' crowds.

Close burst moves reuse the Alpha scheduler/resolvers. **Defaults:** only activate within **12 m**; charge covers ≤ 10 m at **1.6× player run** for ≤ 1 s, windup **0.8 s**, cooldown **6 s**; slam radius **4 m**, windup **1 s**, cooldown **8 s**; grab reach **2 m**, windup **0.8 s**, hold ≤ **1 s**, cooldown **10 s**. Charge/slam/grab damage **25/35/30 HP**, followed by ≥ **1.2 s** recovery; no overlapping moves or immediate chained guaranteed hit. Telegraph shape/audio/captions precede damage. Grab releases on completion or boss stagger/death, never leaves input permanently locked. Near attacks are deadly but dodgeable; no new QTE.

Boss health/resistance is mission data applied through the existing Damage resolver. **Ten direct stock rocket hits from full health kill it; nine do not** (±one hit after other allowed damage). Direct rockets each deal **10% max HP**, splash ≤ **2.5%**, with one hit per projectile ID; no toughness multiplier applied twice. Conventional weapons, including minigun, may hurt/stagger but have a **90%-max-HP floor for conventional damage**: across the whole fight they can remove at most the first 10%, never finish it. Rockets bypass that floor. This keeps required rocket use observable; repeated minigun/axe shots cannot substitute. All stagger effects share cooldown **≥ 2 s** and duration **≤ 0.5 s**, so unlimited rounds cannot permanently pin it. Use E07's bar near/damaged; off-screen boss HP is not a precise map marker. Player can evade until rockets are available. A legitimate early rocket kill in R6 remains dead and satisfies the mandatory boss-death condition; do not resurrect or add a second boss. Intended pacing has the living boss approach during the final charge, measured rather than teleported to a schedule.

### 5.5 Boss distance audio, minimap and music

Reuse E16 spatial cue routing, captions, voice priorities and music director. Periodic deep roar/remote impacts **every 20–35 s** while alive (seeded, sim-time); footsteps become audible inside **60 m**. Default proximity bands **>200 m distant / 80–200 m approaching / <80 m near**: measured RMS level for the same cue increases monotonically as distance decreases (at least **6 dB** between representative 250/120/40 m fixtures after the same mix settings). Roar has a capped nondirectional audible bed beyond ordinary 3D rolloff so an off-region boss still warns; do not render an off-region mesh just for sound. Close burst telegraphs have priority over ambience and must survive 16-voice low tier. Respect E16 master loudness, ducking, flash/shake/caption settings and pause/focus without doubling music or consuming mission time.

Minimap uses a **pulsing player-centered distance ring**, keyed to those distance bands, with accessible text such as `Mega Alpha: approaching`; it encodes no bearing/exact boss coordinate. No exact dot, arrow pointing to boss, off-screen directional boss pin or map object location through debug-to-HUD leakage. Ring disappears on confirmed death. Pulse/render math never drives the sim. Travel pressure → campus discovery → cure delivery → assault → release/resolution uses the existing layered music director and licensed instrumental/SFX stock; record/process an existing licensed/nonverbal recording for the lab terminal, **no new voice actor**. Subtitles/terminal text carry all story facts.

### 5.6 Research campus and backpack cure

R5 uses low laboratories, medical tents, emergency generators, research vehicles, quarantine fences and abandoned equipment, composed from existing kits plus inventory additions. Terminal/recorded message communicates: **airborne agent, harmless to healthy humans/animals, immediately lethal to infected, not a vaccine and never reverses infection; release requires the regional dispersal complex**. Use one existing terminal/device interaction and subtitle panel, no dialogue tree or new NPC actor dependency.

Pickup attaches **`prop.cure-canister`** to the backpack socket, sets mission inventory `carried`, and changes objective to deliver. It takes **zero weapon slots**, applies **no movement speed penalty**, cannot be dropped/stolen/destroyed and is unique across saves/regions. Death restores the checkpoint: before pickup it is still at the terminal; after `cure-research` it is carried; after installation it is installed, never carried and installed simultaneously. Reuse mission-item flags, attachment view and checkpoint serialization, not a backpack inventory framework.

### 5.7 Dispersal complex, mounted rotary gun and charge

R7 has giant fans, pipes, turbines, pressure tanks, filtration towers, low service buildings and platforms: broad, cathedral-like industrial scale from modules, not a skyscraper. Approach/cure installation has readable nav around rubble and the large fan silhouettes. Installation consumes carried state into `installed`, captures **`cure-disperse-ready`** with charge 0 and boss state, and unlocks the console; no duplicate canister.

Fixed **`prop.rotary-minigun` / `weapon.rotary-minigun`** shares one mounted geometry, the existing mounted-gun interaction, aim/leave input and damage/hit events. Default **20 rounds/s**, ordinary infected **≤ 0.25 s TTK** inside effective **35 m**, regular Alpha **≤ 4 s TTK** of landed sustained fire before overheat. Unlimited ammo, **no magazine/reload**, visible normalized heat bar. Heat rises **12.5%/s** while firing (8 s from cold); at 100% lock firing, cooling **20%/s** after 0.5 s idle, unlock below **40%**. Barrel spin-up/down and gunshot sound reuse weapon/audio pools; no every-round new mesh/voice. Heat persists through dismount/remount to prevent reset exploits; checkpoint reload restores saved heat. Gun traverses the arena; dismount within **0.5 s** for rockets/repositioning on desktop and touch. It can hurt/stagger Mega Alpha only under §5.4 resistance, never kill it alone. Position gun **≤ 20 m** from the console so normal mounting/fire stays in the charge zone; rocket dodge lanes also fit inside the **25 m** zone.

Activate console → assault starts → accumulate **60 s of sim-time** while player alive and **within 25 m** in planar world distance. At >25 m progress **pauses**, retains accrued value, resumes on return; at exactly 25 m it advances. No release while absent, no reset to zero merely for leaving. UI says `Return to dispersal console` and shows paused charge; focus/menu pause also stops it. Existing device-defend mission condition implements this, no new mission framework. Ready checkpoint is before activation; death during assault restores that snapshot and resets this attempt's charge, boss state and enemies/heat to the captured values.

Horde attacks during the charge at capped density; regular Alphas and dogs mix into the assault. Author final approach pressure so a still-living Mega Alpha reaches the arena roughly **10–40 s** after activation on the default complete route. If it arrives later, charge may reach 60 s but release remains gated and pursuit continues; **no fake boss spawn or teleport**. If killed earlier, retain the same assault/60 s hold. `release-ready` requires **charge=60 AND Mega Alpha dead AND cure installed**. Meeting just one condition cannot end the battle. At 60 s with boss alive show `Kill the Mega Alpha`; boss dead before 60 shows remaining charge. Explicit final console interaction releases once; a nearby player can balance minigun crowd clearance, rocket hits and carried weapons while moving.

### 5.8 Cure mist, playable epilogue and credits

Release activates fan/turbine nodes and E16 ventilation sound, emits a single event and expanding mist VFX. **Sim cure front**, default radial propagation **10 m/s** with authored branch anchors through connected regions, is authoritative; particles visualize it but never decide who dies. Every alive entity flagged infected touched by the front dies **within one sim tick**, bypassing recovery/resistance/permanent-HP exceptions: regular infected, dogs, regular Alphas, all five infected zoo species and every remaining infected type. No healed/healthy conversion. Use existing Damage/death events with source `cure`, avoiding explosion/gib spam. Player, corgi, healthy civilians/animals are untouched. As the cloud passes, bodies collapse rather than rise again.

Persist release time/front/affected IDs in mission/chunk state. Unloaded infected inside the front are marked dead in snapshots and stay dead on reload; no all-region meshes or crowds are loaded to prove regional reach. The same infected flag also covers off-map zoo animals in the campaign outcome; establish cured/cleared world state for subsequent visits, not an all-campaign simulation kept live. Release is permanent, duplicate interact/load never repeats rewards or audio. Enemy attacks/spawn objectives end on release; until the front reaches an approaching infected, epilogue immunity/attack suppression protects player/corgi, preserving the **combat-is-over** promise while runners visibly collapse ahead. This is a mission-phase guard using existing combat rules.

Playable epilogue **150 s default, permitted 120–180 s**. Player retains walk/run/camera-relative input, may inspect streets/platforms while distant groups/Alphas/dogs fall and survivors emerge from existing safe anchors. Weapons are no longer needed; no new fight or completion kill quota. Active encounter spawners are disabled; bounded authored approaching groups demonstrate collapse with the same global caps. Survivor emergence does not exceed E18/NPC/prop/voice budgets. Cure expands beyond the immediate complex as coarse horizon/mist, **not additional loaded regions**. Over the final **30–45 s**, gradually pull camera outward while preserving movement input; show **Minor Incident**, then credits after the epilogue completes. Credits may offer normal skip/return controls; level completion/campaign victory records once, with no next-level trigger. Save/load mid-epilogue preserves release, elapsed time and control; title/credits resume at the correct phase without replaying combat.


### 5.9 Asset rows (inventory §8 expands components/status)

| Asset / kit | Work / reuse | LOD0 / LOD1 / LOD2 triangle cap per module |
| --- | --- | --- |
| `inf.mega-alpha` | Integrated Alpha rig → ≈2× hero derivative, shared specials | 16,000 / 6,000 / 2,000 |
| `inf.dog` | Generic retriever/K9 base → infected quadruped derivative, never corgi | 4,000 / 1,500 / 500 |
| `prop.rotary-minigun` / `weapon.rotary-minigun` | One HMG-derived mounted gun+base, spin/aim/muzzle nodes | 8,000 / 3,000 / 1,000 total |
| `prop.cure-canister` | Backpack/terminal/installed shared mesh | 1,500 / 600 / 200 |
| `kit.cure-residential` / `kit.cure-industrial` | Reuse small homes/hedges and warehouses/utility yards; missing low modules only | building 12,000 / 4,000 / 1,500 residential; 16,000 / 6,000 / 2,000 industrial |
| `kit.cure-military` | Existing army checkpoint/motor-pool parts | post 8,000 / 3,000 / 1,000; fence/wall 1,000 / 400 / 150 |
| `kit.cure-research` | Low labs plus reused tents/generators/vehicles/quarantine fences | lab 16,000 / 6,000 / 2,000; tent 4,000 / 1,500 / 500; generator 3,000 / 1,000 / 300; vehicle 12,000 / 5,000 / 2,000; fence 1,000 / 400 / 150 |
| `kit.cure-dispersal` | Missing fans/pipes/turbines/tanks/towers, reused platforms/console parts | fan/tower 12,000 / 4,000 / 1,500; pipe 2,000 / 700 / 200; turbine 8,000 / 3,000 / 1,000; tank/platform 6,000 / 2,000 / 700; console 2,000 / 700 / 200 |
| D-CURE terrain/roads/ruins + horizon | L9 chunk contracts and existing rubble stock; no full-level merged GLB | terrain 10,000 / 3,000 / 800; road 3,000 / 1,000 / 300; rubble 4,000 / 1,500 / 500; horizon ≤10,000 combined |

Procedural mist/telegraphs/ring/heat/charge/text reuse existing pools/UI. Status remains planned for new derivatives/kits; inventory §8 records verified integrated bases. Individual budgets never waive aggregate E18, including the ending camera.

## 6. Photo spots, pair cameras and Scene Lab

Region spots: `l10-crash-axe`, `l10-residential-security`, `l10-industrial-barricade`, `l10-military-post`, `l10-research-terminal`, `l10-cure-backpack`, `l10-destroyed-corridor`, `l10-dispersal-platform`. Threat/finale spots: `l10-dog-pack`, `l10-alpha-mega-scale`, `l10-mega-charge`, `l10-mega-slam`, `l10-mega-grab`, `l10-minimap-ring`, `l10-minigun-overheat`, `l10-charge-paused`, `l10-boss-dead-pressure-ready`, `l10-cure-front`, `l10-survivors-emerge`, `l10-camera-pullout`, `l10-title-credits`, `l10-region-seam`.

Pairs: `pair-crossing-cure-start` with E31; `pair-cure-arsenal` axe/late reacquired arsenal; `pair-cure-alpha-scale`; `pair-cure-campus-item` terminal/backpack; `pair-cure-dispersal` attack/mist/quiet at identical camera; `pair-cure-seam` before/after reload; all seven region high/low pairs. Capture mist sequences at exact release-relative ticks, not wall clock.

Proposed Scene Lab files (planned, not created by this spec lane): `qa-l10-crash-axe.json`, `qa-l10-dog-pack.json`, `qa-l10-mega-{pursuit,charge,slam,grab,audio-ring}.json`, `qa-l10-cure-carry.json`, `qa-l10-minigun-heat.json`, `qa-l10-charge-radius.json`, `qa-l10-final-release.json`, `qa-l10-epilogue.json`, `qa-l10-region-seam.json`. Each move fixture covers telegraph, damage, cooldown, obstacle and safe dodge; charge includes inside/boundary/outside samples; mist includes all infected species plus healthy/corgi controls.

## 7. Bruno references

Reuse existing ports first per `08-bruno-reuse-map.md`: `InstancedGroup`, `Quality`, `ResourcesLoader`, `View` camera and `Ticker`/`Events` lifecycle patterns. L9-S3/S4 already own terrain streaming; Alpha scheduler/animal pipeline/mounted-gun/device/checkpoint/music director own gameplay. Read-only `folio-2025/`, no edits or new framework extraction.

## 8. Acceptance criteria

All rows **NEW 2026-10-13**, each tagged `@E32-ACxx`; expected test IDs `T-E32-xx`. Defaults in §4–5 are measurable starting targets.

| ID | Criterion | Verification |
| --- | --- | --- |
| E32-AC01 | Mission graph follows crash → arsenal checkpoints → research/cure → delivery/installation → 60 s nearby hold AND boss dead → explicit release → playable epilogue/title/credits; one campaign completion, no next level. | unit + sim (`T-E32-01`) |
| E32-AC02 | Campaign and standalone R1 start on foot, selectable/owned combat weapons exactly [weapon.fire-axe], preserved abilities/safe corgi, no driveable APC/old arsenal; first minute has ≤ 8 regular infected and no dogs/Alphas. | sim + e2e (`T-E32-02`) |
| E32-AC03 | D-CURE declares seven connected low-rise region envelopes, ≈4,300 m critical route, checkpoints/pickups and timings per §4; entry/exit nav connected, no skyscrapers or whole-map preload. | static + unit + visual (`T-E32-03`) |
| E32-AC04 | One-seed complete and calibrated newbie no-cheat runs finish; newbie no-death critical-route time 45–50 min including 120–180 s epilogue, retries/credits excluded; region telemetry explains travel/fight totals with no idle timing padding. | sim (`T-E32-04`) |
| E32-AC05 | Handgun/shotgun/MG/rocket grant only at their named checkpoints, snapshot includes pickup; retained historical unlocks cannot bypass reacquisition; bottomless campaign ammo/cooldowns allow ≥ 10 direct rockets without ammo soft-lock. | sim (`T-E32-05`) |
| E32-AC06 | Depth-authored fixtures follow §4 density curve with axe few → handgun more → shotgun stronger → MG groups → rockets multiple Alphas → minigun assault; changing loadout alone spawns zero enemies. Global overlap cap ≤ 200/100 incl boss/dogs. | unit + sim (`T-E32-06`) |
| E32-AC07 | inf.dog uses non-corgi quadruped base/animal role, fast low silhouette; default speed 1.1× run, ≥ 0.6 s telegraph, ≤ 2 m reach, ≥ 2 s cooldown and 10 HP/bite; ordinary LOS/stagger/death rules work. | unit + sim + visual (`T-E32-07`) |
| E32-AC08 | Corgi is excluded from infection/spawn substitution/enemy targeting/cure damage; healthy humans/animals remain unharmed by cure. Negative fixtures cover historical pet paths and all cure phases. | unit + sim (`T-E32-08`) |
| E32-AC09 | Regular Alphas match E07 bars/resistance/four specials and can die to conventional weapons; R3–R7 counts meet §4, silhouette/scale/bar distinguish them from ≈2× Mega Alpha. | sim + visual (`T-E32-09`) |
| E32-AC10 | One Mega Alpha is introduced by 2:00, always pursues player without LOS/hearing/lure, cruise 0.7× nominal run ±2%; off-region state/position/HP persists, no teleport/respawn/border stop, obstacle route cannot permanently trap it. | unit + sim (`T-E32-10`) |
| E32-AC11 | Mega charge/slam/grab only activate inside 12 m and meet §5.4 windup/range/speed/damage/cooldown/recovery; moves never overlap, grab always releases and dodge fixtures avoid hits. | sim + visual (`T-E32-11`) |
| E32-AC12 | Full-HP Mega survives nine direct stock rockets and dies on tenth; conventional/minigun damage cannot reduce HP below 90% max or kill, rocket damage applies once/projectile, splash ≤ 2.5% max; stagger ≤ 0.5 s with ≥ 2 s shared cooldown. | unit + sim (`T-E32-12`) |
| E32-AC13 | Mega roar/impacts every 20–35 s while alive, closer cues ≥ 6 dB louder across representative 250/120/40 m fixtures; steps inside 60 m; off-region warning and near telegraphs remain audible/captioned under E16 32/16 voice/focus/pause caps. | e2e offline audio + unit (`T-E32-13`) |
| E32-AC14 | Minimap shows only a pulsing player-centered distance-band ring/text, no Mega dot/bearing/coordinate marker at any distance; ring disappears on death; desktop/phone HUD legible ≥ 3:1. | unit + e2e + visual (`T-E32-14`) |
| E32-AC15 | Campus has low labs/tents/generators/research vehicles/quarantine fences and an interactable terminal/recording with subtitles explaining airborne agent, healthy safety, lethal infected effect and dispersal destination; no new voice actor dependency. | static + sim + visual (`T-E32-15`) |
| E32-AC16 | Unique canister pickup becomes visible backpack item and delivery objective, zero weapon slots/zero speed penalty, never droppable; checkpoint/death/stream/load restores correct at-terminal/carried/installed state with no duplicate. | sim + e2e (`T-E32-16`) |
| E32-AC17 | Dispersal scene has fans/pipes/turbines/tanks/towers/platforms, validated installation/console/nav anchors; mounted gun ≤ 20 m from console and connected dodge lanes within 25 m; installed checkpoint captured before activation. | static + unit + visual (`T-E32-17`) |
| E32-AC18 | Mounted rotary minigun reuses mount/aim/dismount input, unlimited ammo/no reload, default 20 rounds/s, regular TTK ≤ 0.25 s and Alpha ≤ 4 s inside 35 m; ≤ 0.5 s dismount, rocket equip works on desktop/touch; minigun-only Mega fixture never kills it. | sim + real-input e2e (`T-E32-18`) |
| E32-AC19 | Heat rises 12.5%/s firing, locks at 100%, cools 20%/s after 0.5 s idle and unlocks below 40%; bar matches within one frame; remount never resets heat, save/checkpoint restores it. | unit + sim + e2e (`T-E32-19`) |
| E32-AC20 | Charge advances exactly 3,600 ticks while alive within ≤ 25 m, pauses outside/menu/focus, retains progress on return and shows paused instruction; death restores ready checkpoint/0 charge with saved boss/enemy/heat state. | sim + e2e (`T-E32-20`) |
| E32-AC21 | Default alive-boss route reaches arena during charge, target 10–40 s after activation, same persistent ID; peak assault obeys 200/100 cap incl mixed dogs/Alphas/boss; no scheduled replacement/teleport. | sim (`T-E32-21`) |
| E32-AC22 | All charge/boss/cure truth-table cases require charge=60 AND boss dead AND cure installed before release interaction; boss alive blocks after 60 s, early legitimate rocket kill remains dead; release emitted once only with player at console. | unit + sim + e2e (`T-E32-22`) |
| E32-AC23 | Fans/turbines start and visible mist front expands; every touched infected dies within one tick, incl dogs/Alphas/five zoo species/all infected flags, with no recovery/conversion; no healthy/player/corgi harm; sim outcome independent of particle quality. | sim + visual (`T-E32-23`) |
| E32-AC24 | Released/front/dead state persists for unloaded regions and campaign zoo outcome; reload never resurrects or repeats release; no all-region asset load to apply cure; entity IDs and unique cure state survive five revisits. | unit + sim (`T-E32-24`) |
| E32-AC25 | After release player keeps movement control for 120–180 s, combat attacks/spawners disabled, bounded approaching infected visibly collapse and survivors emerge; no player damage/new fight/kill quota, ventilation stays on. | sim + real-input e2e + visual (`T-E32-25`) |
| E32-AC26 | Camera gradually pulls out during final 30–45 s with input still effective; mist reaches coarse horizon, Minor Incident title then credits; victory saved once and mid-epilogue/title reload resumes phase without combat replay. | sim + e2e + visual (`T-E32-26`) |
| E32-AC27 | Last-checkpoint death in every region and before/after cure/installation restores region/chunks/loadout/cure/boss/cooldowns/mission, including boundary and floor-crash handover; never defaults to level start when a later checkpoint exists. | sim (`T-E32-27`) |
| E32-AC28 | L9-S3/S4 reuse holds ≤ 25/9 detailed chunks, ≥ 2 s prefetch, seams ≤ 2 cm; delayed loads/speed reversal preserve collision/nav/input, persistent boss never duplicates and off-region corpses/pickups keep IDs/state. | unit + sim + e2e (`T-E32-28`) |
| E32-AC29 | Headless real mouse-only, keyboard/mouse and mobile touch cover weapon checkpoints, carrying, mount/overheat/dismount/rockets/charge/release and epilogue control; no console errors/HUD overlap; all region and finale pairs captured. | real-input e2e (`T-E32-29`) |
| E32-AC30 | Vision A/C/D/F/G/H: distinct low regions, dog/Alpha/Mega threats readable, cure backpack and industrial finale legible, mist reversal/survivors/camera ending clear; all must items pass, pairs ≥ 7/10, no P0/P1. | vision (`T-E32-30`) |
| E32-AC31 | perf-l10-regions/assault/mist obey all §5.1 E18 high/low caps incl transitions/audio/corpses and pull-out; frame p95 ≤ 16.7/33.3 ms, desktop hitch ≤ 50 ms, five warmed cycles heap/GPU counts within 10%; real iOS/Android ≥ 30 fps p50 recorded. | perf + manual (`T-E32-31`) |
| E32-AC32 | Continuous one-seed complete L1→L10 preserves prior handovers/abilities/roster history, mandatory L9 reset, L10 arsenal/cure/boss/release and one credits victory without cheats/reward screens; campaign timing adds 45–50 min finale instead of old 30–60 min whole-game gate. | sim (`T-E32-32`) |

## 9. Notes and verification recipe

Use placeholders to unblock route/AI missions, then derive art in the ordinary pipeline. Preserve low-tier route lengths/pursuit/charge timing; reduce resident regular crowds/VFX complexity inside E18. The long duration overrides the generic 5–10 min level and 30–60 min full-campaign timing assumptions in older test concepts. First green single-seed route calibrates defaults; report actual regional travel/combat times. No padded waits or new systems to justify scale.

Implementation checks: `npm run typecheck`, `npm run lint`, `npm run test:unit` (Vitest ≤ 4 workers), `npm run verify -- E32`. Headless Playwright ≤ 2 workers, real-GPU macOS WebGL2 `--use-angle=metal`; browser gameplay scale ≤ 4, manual WebGPU/devices. Reuse an existing server on 3300. Full completion belongs primarily in accelerated headless sim; browser tests reuse region/ready checkpoints for focused real-input wiring, plus a one-seed complete browser route recording, not three 50-minute real-time duplicates. Save region/cure/boss/charge logs, offline audio measurements, pairs/vision/perf in `test-results/epics/E32/`. Tests/scenes listed here are future artifacts; this spec change does not add implementation tags.

## 10. Implementation plan

Order: **L9 changes/streaming → L10 assets → regions → encounters/weapons → finale → epilogue → evidence**. Each lane ≤ 3 h, with explicit seams and existing owners; split further if measured work exceeds budget, never cut story/regions. Systems rows extend current systems for the named behavior, not replacement services. Shared L9-S3/S4 are prerequisites; do not duplicate their work.

| Lane | Budget | Depends on | Concrete change and reuse |
| --- | --- | --- | --- |
| L10-A1 assets | 3 h | E07 Alpha asset | Derive inf.mega-alpha at ≈2× scale, reuse rig/move poses, hero LODs and palette. |
| L10-A2 assets | 3 h | animal pipeline | Existing retriever/K9 non-corgi base → inf.dog, quadruped clips/LODs/eyes; reuse infected.dog brain contract. |
| L10-A3 assets | 3 h | mounted-gun stock | Rotary gun/base/spin nodes and backpack cure canister/socket using existing prop/weapon builds. |
| L10-A4 assets | 3 h | existing town/industrial stock | Residential fringe + industrial region kits, missing low modules only, instanced props/LODs. |
| L10-A5 assets | 3 h | checkpoint/evac stock | Military + research campus kits: reused tents/fences/generators/vehicles, low lab additions. |
| L10-A6 assets | 3 h | industrial stock | Dispersal fans/pipes/turbines with animated rotation nodes, shared materials/LODs. |
| L10-A7 assets | 3 h | A6 | Tanks/towers/service platforms and finale assembly anchors; reuse existing pressure/utility props. |
| L10-D1 district | 3 h | L9-S7, L9-S3/S4, A4 | R1/R2 greybox and checkpoint/nav/region seams; crash handover, police pickup anchors. |
| L10-D2 district | 3 h | D1, A4/A5 | R3/R4 industrial/military greybox, detours, shotgun/MG anchors on shared streamer. |
| L10-D3 district | 3 h | D2, A5 | R5/R6 campus/corridor greybox, terminal/cure/rocket anchors and depth curve. |
| L10-D4 district | 3 h | D3, A6/A7 | R7 dispersal arena/nav with ≤25 m hold/dodge zone, mounted gun, horizon/epilogue spots. |
| L10-S1 systems | 3 h | D1–D4 | Extend existing mission/checkpoint/progression data: ordered objectives, per-region snapshots and arsenal transactions/standalone preset. |
| L10-S2 systems | 3 h | A2, S1 | Dog tuning/telegraph/infection exclusions on animal pipeline; regular Alpha reuse/count contracts. |
| L10-S3 systems | 3 h | A1, D3, L9-S4 | Persistent Mega global pursuit/coarse route update, obstacle recovery, snapshots/cooldowns on shared AI/nav. |
| L10-S4 systems | 3 h | S3 | Mega charge/slam/grab from Alpha scheduler, rocket/conventional damage floors and shared stagger cooldown. |
| L10-S5 systems/audio | 3 h | S3/S4 | Existing audio/captions/music director and minimap: distance roar/steps/ring, no exact marker; instrumental terminal recording. |
| L10-E1 encounters/weapons | 3 h | S1/S2, D1–D3 | R1–R4 depth-anchored threats and axe→handgun→shotgun→MG checkpoints; medkits/nav alternatives. |
| L10-E2 encounters/cure | 3 h | E1, S3/S5, A3 | R5/R6 regular Alphas/dogs, lab recording/terminal/backpack unique cure and rocket checkpoint on mission-item snapshots. |
| L10-S6 finale systems | 3 h | A3, D4, S1 | Existing mounted interaction: rotary fire/heat/spin/HUD, persistent remount heat and quick rocket dismount. |
| L10-S7 finale systems | 3 h | E2, S4/S6 | Installation/ready snapshot, nearby 60 s defend/device predicate, boss-dead release gate and all failure/early-kill cases. |
| L10-E3 finale encounters | 3 h | S7 | Capped mixed assault, persistent boss arrival pacing and ten-hit rocket fight; one-seed end-to-end timing calibration. |
| L10-S8 epilogue systems | 3 h | E3 | Sim cure front + infected death/unloaded snapshots/campaign cleared flag; pooled mist/fan audio, healthy/corgi exclusions. |
| L10-S9 epilogue presentation | 3 h | S8 | Existing movement/camera/music/survivor anchors: 2–3 min playable reversal, pull-out/title/credits/save resume. |
| L10-Q1 Scene Lab | 3 h | S2–S5, E2 | Dog/pursuit/per-move/audio-ring/carry fixtures and high/low region/scale pairs. |
| L10-Q2 Scene Lab | 3 h | S9, Q1 | Minigun/charge/release/mist/epilogue/seam fixtures, all-species cure controls and fan/title frame sequences. |
| L10-Q3 sim regression | 3 h | Q2 | Consolidate T-E32-01..16/27/28 scenarios developed in systems lanes, depth/checkpoint/AI/cure coverage and one-seed level timing; existing Vitest/sim runner. |
| L10-Q4 finale/campaign sim | 3 h | Q3 | Consolidate T-E32-17..26 finale/epilogue scenarios developed in S6–S9, gate truth table and no-cheat L1→L10 bot (AC32). |
| L10-Q5 browser e2e | 3 h | Q4 | Desktop/touch checkpoint wiring, one complete browser bot route and console guards (AC29); offline audio measurements (AC13), existing adapters/recorder. |
| L10-Q6 evidence/performance | 3 h | Q5 | All-region/assault/mist/pull-out sweeps and five cycles (AC31), pairs/vision report (AC30), manual-device/WebGPU recipe. |
