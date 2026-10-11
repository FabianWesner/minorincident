# E31 · Level 9: The Crossing

> **New 2026-10-11 per product owner:** [`po-levels-4-9-2026-10-11.md`](po-levels-4-9-2026-10-11.md) wins on any disagreement. All ACs are **NEW 2026-10-11**. Numeric/layout/timing choices are **orchestrator defaults**, not additional story. New systems below are proposed, not existing implementations.

## 1. Goal

Start inside the armored vehicle from the zoo and cross spacious roads, countryside and dry terrain by several possible routes toward the next city. Mass is the vehicle's only offense, and every infected collision consumes irreplaceable durability. Preserve it by steering around hordes or trade durability for a shortcut; at zero it breaks down and the player completes the remaining journey on foot with normal weapons.

> PO, verbatim: "Level 9 starts immediately inside the armored military vehicle from Level 8."
>
> "The vehicle has no mounted guns."
>
> "Its only offensive ability is its mass."
>
> "However, every collision with an infected damages the vehicle."
>
> "The vehicle has its own damage bar, and that damage cannot be repaired during the level."
>
> "Zombies can also attack the vehicle directly if the player becomes surrounded or stops."
>
> "Drive through the horde and lose durability, or steer around them and preserve the vehicle."
>
> "If the vehicle reaches zero durability, it breaks down."
>
> "The player then has to leave it and continue the remaining journey on foot with their normal weapons."
>
> "The level ends when the player reaches the next city or its outskirts."

## 2. Depends on / Enables

E30 (same unarmed APC, occupants, arsenal), E09 (Rapier vehicle/controller/ram/exit), E07 (regular infected), E08 (survivor roster/followers), E10 (new D-CROSSING, collision/nav), E12/E13 (objectives/checkpoints/progression), E14 (durability HUD/touch), E16, E17 (terrain kits), **E18** (streaming/LOD/performance on desktop and phone), E25/E28 (lighting/weather) / L10 **Grand finale — storyline from the PO pending**, no epic yet. M3.

## 3. Scope

**In:** D-CROSSING open terrain, roads/countryside/dry areas/long sight lines, road and off-road driving, multiple routes and riskier shortcuts; unarmed armored vehicle, ramming, vehicle damage bar with no repair, damage from every infected collision and direct infected attacks while stopped/surrounded; breakdown at zero and compulsory continuation on foot with existing arsenal; next-city outskirts ending; terrain/collision/nav streaming and LOD within desktop/phone E18 budgets; checkpoints, pair cameras, browser/touch tests.

**Out:** mounted guns or firing carried weapons from inside the vehicle (orchestrator default enforcing mass-only offense), repairs/healing durability, replacement vehicle, mandatory road-only corridor, new weapon, designing the next city's storyline or L10.

## 4. Level structure and story beats (~5–8 min, orchestrator default)

| # | Beat | Location (`D-CROSSING`) | What happens | Target time (default) |
| --- | --- | --- | --- | --- |
| 1 | Armored start | road outside zoo, shared L8 departure anchor | Player has immediate driving control inside the same vehicle. Surviving group remains aboard; durability bar is visible, destination is the next city. | 0:00–0:15 |
| 2 | Choose a crossing | road forks → countryside/dry terrain | Roads offer legible navigation; player can leave them, drive open ground and choose longer safe routes or shorter risky routes. Groups can be avoided or rammed. | 0:15–2:00 |
| 3 | Preserve or spend | open crossing sectors | Ramming consumes durability on every infected collision; being stopped or surrounded allows infected to attack the vehicle. Choices determine how far it lasts. | 2:00–5:00 |
| 4 | Breakdown, if incurred | wherever durability reaches zero | The vehicle stops and cannot be repaired; player and living occupants safely exit. Player continues the remaining distance on foot with the accumulated arsenal. This beat is conditional, never forced on a preserved vehicle. | variable |
| 5 | Next city | outskirts arrival zone | Arrival completes L9 either in the preserved vehicle or on foot. Storyline beyond the outskirts is pending the PO; do not fabricate a finale here. | ~5:00–8:00 |

**Checkpoints (orchestrator defaults):** `crossing-start`, `mid-crossing`, `outskirts-approach`, plus a snapshot immediately after safe breakdown exit. No fail timer. No fuel/repair system. Provisional timing, never padded; single-seed completion per route/mode fixture, not a 20-seed battery.

## 5. Systems

### 5.1 Open district and route choices

**New D-CROSSING**, reuse road/terrain palette, `kit.highway-onramp`, `kit.river-terrain` dry-rock pieces, existing road tiles, grass/rocks/trees and countryside building stock. Orchestrator default extent ≈ **1,200 × 800 m** (large relative to Fairhaven); this exceeds architecture's older ±400 m town footprint, so local chunk coordinates plus global route anchors extend that convention for this epic. ≥ 3 connected materially different routes join start to city outskirts: road route, countryside route, dry-ground shortcut. Each allows road departure/reentry and driveable terrain between route traces; no invisible rails.

Orchestrator default: each route ≥ 900 m, dry shortcut ≥ 20 % shorter than longest route and contains ≥ 2× its unavoidable collision-risk opportunities; a chosen collision-free detour exists on every route. ≥ 2 viewpoints have unobstructed ≥ 150 m world sight lines (low-detail terrain/horizon allowed), clear next-city silhouette/directional guidance. Navigation works for both the vehicle and player/followers on foot; slopes ≤ 12° on intended driveable ground. No new weather/destination story beat is required.

### 5.2 Unarmed armored vehicle

Reuse E30's unarmed `veh.military-apc` variant and derive a drivable E09 definition from `src/data/vehicles.ts` (the existing APC model currently is a set piece, not a vehicle definition). Reuse `VehicleBody.ts` suspension/steering, `Vehicles.ts` controls, `VehicleView.ts` occupants, existing touch adapters and path input. Orchestrator defaults: 6,000 kg, top speed 18 m/s on roads / 12 m/s on rough dry ground, effective durability **1,000 max**, existing ram damage formula with ramStrength 3. No mounted-gun geometry or firing event; personal weapon attacks suppressed while seated. No armor power-up or new weapon is granted; carried arsenal becomes available again on exit.

Start inside the same vehicle (stable campaign vehicle id/payload), carrying L8 exit durability/roster; standalone default starts at 1,000. Any zoo-departure damage is preserved rather than reset. The player can ram regular infected by mass using E09 contact damage; existing infected recovery rules remain. Small groups are not an infinite free shortcut.

### 5.3 Durability and attacks

**Orchestrator defaults:** one completed contact onset with each infected deducts **10 durability**, at any contact speed, including while stopped; no speed threshold makes a collision free. Continuous overlap produces one collision event until separation ≥ 0.5 m for ≥ 0.25 s; a new contact deducts again. This event rule prevents per-tick double billing but does not exempt any distinct infected or repeat collision. Log vehicle id, infected id, contact id, source and before/after HP.

A locally aware infected within 1.5 m of the hull attacks with ≥ 0.6 s windup, **10 durability/hit**, cooldown **1 s**, while the vehicle is stopped (speed < 0.5 m/s) or surrounded (≥ 4 attackers across ≥ 3 hull quadrants within 3 m; orchestrator defaults). Direct attack damage is separate from contact-onset damage. Hold position for 5 s against 4 attackers to demonstrate continued loss; moving away outside reach ends those attacks. Regular bullets/medkits cannot repair the vehicle. UI uses current/max durability, updates within one render frame, is visible on desktop and phone with ≥ 3:1 contrast and no overlap with controls; no repair prompt/item/action exists.

Durability is non-increasing during a checkpoint segment, clamped to [0,max], serialized in saves/checkpoints. Ordinary player-death checkpoint retry restores the checkpoint value (not an in-world repair); loading the current save never restores max. All infected collisions count, even already downed but still active infected.

### 5.4 Breakdown → on foot

At 0, emit one breakdown event, remove throttle/weapon/ram capability and immobilize the APC. **Override E09's ordinary smoke→fire→explode-at-zero behavior for this mission vehicle:** the PO requires breakdown/exit, not a forced passenger-killing explosion. Preserve the stopped wreck in the world. Within 2 s, player and living occupants exit at safe navigable positions around hull, choose alternate exit anchors if blocked, no overlap/static-collider spawn or teleport past terrain obstacles (orchestrator default safe radius ≤ 5 m). No countdown requiring a new story beat.

Restore the acquired arsenal and player input; `Survivors.ts` group follows living occupants if present. Objective remains the next city. Route graph and streamed navigation remain connected for all possible breakdown positions, including off-road and chunk seams. No replacement vehicle/repair/reset. Test early breakdown at ≤ 20 % route progress, late breakdown at ≥ 80 %, and preserved-vehicle arrival; remaining foot distance differs accordingly.

### 5.5 Terrain streaming, LOD and budgets

**New terrain chunk streaming is required**, not satisfied by existing prop LOD alone. Reuse `DistrictView.ts` instanced LOD batches (`warmHero`/`swapSlot`), `DistrictAssets.ts` cache/prefetch and `Quality.ts`, then add bounded terrain/collider/nav chunk ownership and unloading. Orchestrator default chunk size 100 × 100 m; detailed residency ≤ 25 chunks high / 9 low, plus coarse distant horizon. Prefetch at least 2 s of maximum-speed travel in the current direction before a seam; maintain collision/driveable support even if visual loading is delayed. Never freeze vehicle input to hide a load.

NPCs/mission/corpse state outside active simulation range remain in serialized chunk state and restore id/health/timers on revisit; rendering disposal cannot resurrect enemies or repair the vehicle. Inactive colliders/nav and unreferenced GPU geometry are released under existing lifecycle rules. LOD transitions preserve terrain heights across seams (≤ 2 cm mismatch), vehicle ground contact and on-foot routes. Phone preserves route choice/long sight lines using low-detail distant geometry rather than shrinking the map.

E18 budgets at worst populated crossing: **600/300 draws, 1.5M/500k triangles, 200/100 concurrent infected, 4/6 ms sim p95, 400/250 MB heap**, lights/props/debris/particles per E18. Headless real-GPU WebGL2 desktop/phone-profile frame p95 ≤ 16.7/33.3 ms after warmup; desktop streaming/breakdown hitch ≤ 50 ms. Real iOS/Android ≥ 30 fps p50 manual recorded, WebGPU manual. Sweep every route in both modes, not only one photogenic road.

### 5.6 Lighting/weather preset, music/sound and ending

**`L9-crossing`** orchestrator default: late-night cool moonlight continuing the same journey, dry ground, light wind/dust, no forced dawn or rain. Long sight lines come from open terrain/coarse horizon; preserve E25 player/infected readability. Reuse E28 dry/wind preset, road/gravel surface sounds, E16 engine strain/contact/breakdown footsteps; licensed low-travel music with pressure layers near threats, reduced engine bed after breakdown. Damage/breakdown cues are captioned and emitted once per corresponding sim event, voice caps 32/16.

Outskirts trigger completes L9 in either mode, records arrival vehicle durability/mode and exact living roster/loadout. No final credits or invented L10 encounter; store continuation at outskirts until the PO storyline arrives. A temporary non-final continuation notice is an orchestrator default, not a campaign finale.

## 6. Photo spots and pair cameras

`l9-armored-start`, `l9-road-fork`, `l9-countryside-route`, `l9-dry-shortcut`, `l9-long-sightline`, `l9-ram-contact`, `l9-surrounded`, `l9-breakdown`, `l9-foot-journey`, `l9-city-outskirts`, `l9-chunk-seam`.

**Pairs (orchestrator defaults):** `pair-armored-departure` with E30; `pair-crossing-fork` and `pair-crossing-outskirts` in vehicle/on-foot modes at identical cameras, seed and environment; `pair-crossing-seam` before/after stream unload/reload at identical transforms, compare terrain seam masks and retained entity ids. High/low comparisons cover all three routes.

## 7. Bruno references

Reuse existing E09/E18 ports first. Read-only `World/PhysicsVehicle.js`, `World/VisualVehicle.js`, `InstancedGroup.js`, `Quality.js`, `ResourcesLoader.js`, `Grass.js`, `Tracks.js`, `View.js` through `08-bruno-reuse-map.md`; no edits to reference checkout.

## 8. Acceptance criteria

All rows **NEW 2026-10-11**. Numeric tuning is default from §5; every test carries `@E31-ACxx`.

| ID | Criterion | Verification |
| --- | --- | --- |
| E31-AC01 | Graph starts seated in L8 APC and ends at next-city outskirts in vehicle or on foot, no fail timer, repair or kill-all gate; objective remains valid after breakdown. | sim (`T-E31-01`) |
| E31-AC02 | L8→L9 retains vehicle id/current/max durability, player health/acquired arsenal and exact living roster, with driving control within 0.5 s and no reward/menu. | sim + e2e (`T-E31-02`) |
| E31-AC03 | APC model/action map has no mounted gun; fire inputs for 300 ticks while driving generate zero weapon/projectile/blast events; mass-contact ram damage still hits infected. | unit + sim + visual (`T-E31-03`) |
| E31-AC04 | D-CROSSING has roads, countryside and dry driveable terrain, ≥ 3 connected routes ≥ 900 m, ≥ 2 viewpoints with ≥ 150 m clear sight lines, and next-city silhouette/guidance; map extent ≈ 1,200×800 m. | static + unit + visual (`T-E31-04`) |
| E31-AC05 | Driver leaves/rejoins roads, crosses open terrain and completes each route; dry shortcut is ≥ 20 % shorter than longest route and has ≥ 2× collision-risk opportunities; no invisible rail, every route has a collision-free detour. | sim (`T-E31-05`) |
| E31-AC06 | Every contact onset with active infected, including at < 0.5 m/s and downed infected, deducts exactly 10 durability once; 10 distinct collisions lose 100, sustained overlap does not bill per tick; separation/re-contact bills again per §5.3. | sim (`T-E31-06`) |
| E31-AC07 | Stopped/surrounded hull fixture meets §5.3 targeting: 10 damage per attack, ≥ 0.6 s windup, cooldown ≥ 1 s per attacker; four attackers continue damage over 5 s, leaving 1.5 m reach stops damage; collision and attack ids remain distinct. | sim (`T-E31-07`) |
| E31-AC08 | Durability bar current/max equals state within one render frame on 1600×900 and 390×844, contrast ≥ 3:1, no touch-control overlap; no repair HUD/action/item, medkits/regen never increase durability. | e2e + sim (`T-E31-08`) |
| E31-AC09 | Durability clamps to 0, emits one breakdown, disables drive/ram, cancels ordinary E09 explosion; player/living occupants safely exit within 2 s, no blocked/spawn-overlap exits, stopped vehicle remains. | sim + e2e (`T-E31-09`) |
| E31-AC10 | After breakdown acquired six-weapon default arsenal is selectable on foot, current health/roster preserved; path to outskirts exists from every intended driveable nav cell/chunk seam; survivors follow without > 1 m/tick teleports. | unit + sim (`T-E31-10`) |
| E31-AC11 | One-seed route fixtures demonstrate intact-vehicle arrival, early breakdown ≤ 20 % progress and late breakdown ≥ 80 %; all finish without cheats, early foot distance ≥ 3× late distance; safe driving preserves more durability than collision shortcut. | sim (`T-E31-11`) |
| E31-AC12 | Chunk streamer exposes resident/queued/unloaded counts; detailed chunks ≤ 25/9 high/low, prefetch covers ≥ 2 s maximum-speed travel; traverse every route at top speed with delayed asset loads, no missing ground/collision/input freeze. | unit + sim + e2e (`T-E31-12`) |
| E31-AC13 | Terrain LOD seams differ ≤ 2 cm, vehicle never falls through or leaves support > 1 tick; on-foot nav stays connected through unload/reload; same entity/corpse ids/state persist on revisit with unchanged vehicle HP. | sim + visual (`T-E31-13`) |
| E31-AC14 | Death/checkpoint/save reload restores route progress, vehicle durability/broken state, occupants/arsenal, chunk state and special enemy timers; current save cannot reset to max, checkpoint retry uses saved checkpoint HP only. | sim (`T-E31-14`) |
| E31-AC15 | Outskirts arrival completes in vehicle and on foot, logs mode/durability/survivors and retains loadout for future L10; no credits, finale encounter or invented L10 epic. | sim + e2e (`T-E31-15`) |
| E31-AC16 | `L9-crossing` dry night lighting gives ≥ 3:1 player contrast at foot spots, long terrain views on both tiers; engine/contact/breakdown/footstep cues and captions match event counts, E16 32/16 voices and focus/pause hold. | visual + e2e (`T-E31-16`) |
| E31-AC17 | Headless Playwright real mouse/keyboard drives a road/off-road route and separately continues after early breakdown, both reach outskirts with zero console errors; mobile touch drives/exits/attacks, HUD readable; all §6 pairs captured. | real-input e2e (`T-E31-17`) |
| E31-AC18 | Vision review A/D/F/G: open countryside/dry terrain differs from urban maps, multiple route choices and next-city destination read clearly, unarmed APC/durability and on-foot alternative legible; pairs ≥ 7/10, must items pass, no P0/P1. | vision (`T-E31-18`) |
| E31-AC19 | `perf-l9-crossing` sweeps all routes high/low: draws ≤ 600/300, triangles ≤ 1.5M/500k, infected ≤ 200/100, sim p95 ≤ 4/6 ms, heap ≤ 400/250 MB and all E18 caps; frame p95 ≤ 16.7/33.3 ms desktop/phone profiles; desktop stream/breakdown hitch ≤ 50 ms; 5 round trips leave heap/GPU counts within 10 % of first. | perf (`T-E31-19`) |
| E31-AC20 | Continuous one-seed `complete` campaign L1→L9 preserves bat→axe→handgun→machine gun→shotgun→none→rocket→none→temporary APC progression, all level handovers/roster states and vehicle/foot ending; no new rewards screens/cheats. Real iOS/Android crossing fps p50 ≥ 30 recorded per E18 (manual device subcheck). | sim + manual (`T-E31-20`) |

## 9. Notes and verification recipe

Existing scenery LOD is reusable; open terrain streaming and unarmed armored durability need new work. Prioritize a driveable/foot-completable greybox with bounded residency before long-range art. Benchmark a populated seam at top speed and breakdown, then preserve the same budgets while dressing the map. No vehicle durability repair or mandatory forced failure may shortcut the PO decision.

During implementation: typecheck/lint/unit (`--maxWorkers=4`), `npm run verify -- E31`, ≤ 2 headless Playwright workers, driving scale ≤ 2, macOS real-GPU WebGL2 `--use-angle=metal`; WebGPU/devices manual recorded. Store route/vehicle damage logs, seam comparisons, memory/fps and review/report under `test-results/epics/E31/`.

## 10. Implementation plan

Ordered lanes, each ≤ 3 h; expand into further ≤ 3 h lanes as needed without reducing the open map or phone requirements.

| Lane | Budget | Concrete change and reuse |
| --- | --- | --- |
| L9-S1 systems | 3 h | Extend E30 shared APC in `Vehicles.ts`/`VehicleBody.ts`, `src/data/vehicles.ts`: mass-only offense, per-contact durability and stopped/surrounded attack resolver. |
| L9-S2 systems | 3 h | Reuse HUD `src/ui/GameUI.ts` vitals, campaign/checkpoint snapshots and `Survivors.ts`: damage bar, no repair, safe compulsory exit and restored on-foot arsenal; suppress ordinary zero-HP explosion. |
| L9-S3 streaming | 3 h | Reuse `DistrictView.ts` LOD batches, `DistrictAssets.ts` prefetch/cache and `Quality.ts`; add terrain chunk lifecycle/residency and global-to-local placement anchors. |
| L9-S4 streaming | 3 h | Reuse `DistrictWorld.ts`, `staticCollision.ts`, `NavGrid.ts` and entity snapshots; bounded collider/nav residency, predictive prefetch, delayed-load support and persistent seam/revisit state. |
| L9-D1 district | 3 h | Greybox D-CROSSING road/countryside/dry routes with existing road tiles/rock/tree/building kits, next-city silhouette and road/off-road support; test route lengths before art. |
| L9-D2 district | 3 h | Author budgeted terrain LOD/chunks, reuse countryside kit and E25/E28 dry-night look; fixed route/seam pairs, unarmed APC damage/broken visual variants. |
| L9-E1 encounters | 3 h | Reuse infected director/spatial hash, E09 ram and group follower: avoidable hordes/smaller ram groups, shortcut risk, early/late/preserved route fixtures and outskirts completion. |
| L9-Q1 Scene Lab | 3 h | Proposed `qa-l9-{fork,ram,surrounded,breakdown,seam,outskirts}.json`, vehicle/foot and high/low pairs; resident/memory/performance sweeps. |
| L9-Q2 browser e2e | 3 h | Proposed `tests/levels/L9.test.ts`, `tests/e2e/levels/L9.spec.ts`, `tests/perf/l9-budgets.spec.ts` plus campaign extension: real drive/touch/foot, all T-E31 ids, manual device recording instructions. |
