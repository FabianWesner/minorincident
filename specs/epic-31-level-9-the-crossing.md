# E31 · Level 9: The Crossing

> **REVISED 2026-10-13 per product owner:** [`po-levels-9-10-2026-10-13.md`](po-levels-9-10-2026-10-13.md) supersedes the 2026-10-11 L9 breakdown/on-foot ending. Numeric/layout/timing choices are **orchestrator defaults**. **L9-S1 durability and L9-D1 greybox are on main and retained**; other lanes below remain planned. The original L9-S2 is cancelled, not completed.

## 1. Goal

Start inside the armored vehicle from the zoo and cross spacious roads, countryside and dry terrain by several possible routes toward the next city. Mass is the vehicle's only offense, and collisions consume irreplaceable durability. Careful driving preserves speed and visibility; at zero the APC remains barely functional and driveable. Only the mandatory collapsed-road crash at the city outskirts destroys it. The player survives, crawls away and enters L10 with the axe alone, existing abilities and the safe corgi.

> PO, verbatim: "The car can be damaged throughout Level 9, but it survives until the final scripted crash."
>
> "The player should retain only the axe as the most basic surviving weapon."

## 2. Depends on / Enables

E30 (same unarmed APC, occupants, arsenal), E09 (Rapier vehicle/controller/ram/exit), E07 (regular infected), E08 (survivor roster/followers), E10 (new D-CROSSING, collision/nav), E12/E13 (objectives/checkpoints/progression), E14 (durability HUD/touch), E16, E17 (terrain kits), **E18** (streaming/LOD/performance on desktop and phone), E25/E28 (lighting/weather) / [E32 · L10 The Cure](epic-32-level-10-the-cure.md), reusing L9-S3/S4 streaming. M3.

## 3. Scope

**In:** D-CROSSING open terrain, roads/countryside/dry areas/long sight lines, road and off-road driving, multiple routes and riskier shortcuts; unarmed armored vehicle, ramming, vehicle damage bar with no repair, damage from every infected collision and direct infected attacks while stopped/surrounded; 0-HP driveable floor, staged damage appearance/audio, mandatory collapsed-road crash and short crawl-away; axe-only L10 handover; terrain/collision/nav streaming and LOD within desktop/phone E18 budgets; checkpoints, pair cameras, browser/touch tests.

**Out:** mounted guns or firing carried weapons from inside the vehicle (orchestrator default enforcing mass-only offense), repairs/healing durability, replacement vehicle, mandatory road-only corridor, new weapon, voluntary exit or an on-foot crossing before the crash (default). L10 is specified in E32.

## 4. Level structure and story beats (~5–8 min, orchestrator default)

| # | Beat | Location (`D-CROSSING`) | What happens | Target time (default) |
| --- | --- | --- | --- | --- |
| 1 | Armored start | road outside zoo, shared L8 departure anchor | Player has immediate driving control inside the same vehicle. Surviving group remains aboard; durability bar is visible, destination is the next city. | 0:00–0:15 |
| 2 | Choose a crossing | road forks → countryside/dry terrain | Roads offer legible navigation; player can leave them, drive open ground and choose longer safe routes or shorter risky routes. Groups can be avoided or rammed. | 0:15–2:00 |
| 3 | Preserve or spend | open crossing sectors | Ramming, obstacles/wreckage and stopped/surrounded infected attacks damage the vehicle. At zero it keeps driving with a 60% speed cap, heavy smoke and wrecked engine sound. | 2:00–5:00 |
| 4 | Forced crash | collapsed bridge/road section at city outskirts | Every route joins the approach; even a full-HP APC crashes and is destroyed. Player survives; the crash separates the player from the arsenal. | ~5:00–8:00, includes finale |
| 5 | Crawl-away / handover | safe ground beside the wreck | Short crawl-away, then L10 on foot with `weapon.fire-axe` only. Abilities and corgi survive. | final 5–8 s of L9 (default) |

**Checkpoints (orchestrator defaults):** `crossing-start`, `mid-crossing`, `outskirts-approach`; after the crash, the atomic handover creates E32's `cure-crash` checkpoint. **All-levels rule: death respawns at the last checkpoint**, never an earlier level start. There is no breakdown-exit checkpoint. No fail timer, fuel or repair system. One-seed completion per route/HP fixture; no 20-seed gate. Crawl and crash are included in the provisional 5–8 min band, never padded.

## 5. Systems

### 5.1 Open district and route choices

**New D-CROSSING**, reuse road/terrain palette, `kit.highway-onramp`, `kit.river-terrain` dry-rock pieces, existing road tiles, grass/rocks/trees and countryside building stock. Orchestrator default extent ≈ **1,200 × 800 m** (large relative to Fairhaven); this exceeds architecture's older ±400 m town footprint, so local chunk coordinates plus global route anchors extend that convention for this epic. ≥ 3 connected materially different routes join start to city outskirts: road route, countryside route, dry-ground shortcut. Each allows road departure/reentry and driveable terrain between route traces; no invisible rails.

Orchestrator default: each route ≥ 900 m, dry shortcut ≥ 20 % shorter than longest route and contains ≥ 2× its unavoidable collision-risk opportunities; a chosen collision-free detour exists on every route. ≥ 2 viewpoints have unobstructed ≥ 150 m world sight lines (low-detail terrain/horizon allowed), clear next-city silhouette/directional guidance. Navigation supports the vehicle throughout and safe crawl-away/occupant positions at the finale; slopes ≤ 12° on intended driveable ground. No new weather/destination story beat is required.

### 5.2 Unarmed armored vehicle

Reuse the shared unarmed `veh.military-apc` / `vehicle.military-apc` definition already on main from L9-S1 and E30 transport work in `src/data/vehicles.ts`. Reuse `VehicleBody.ts` suspension/steering, `Vehicles.ts` controls, `VehicleView.ts` occupants, existing touch adapters and path input. Orchestrator defaults: 6,000 kg, top speed 18 m/s on roads / 12 m/s on rough dry ground, effective durability **1,000 max**, existing ram damage formula with ramStrength 3. No mounted-gun geometry or firing event; personal weapon attacks suppressed while seated. No armor power-up or new weapon is granted. Preserve the carried arsenal in campaign state until the crash; it is then stripped by §5.4, never made available for an on-foot crossing.

Start inside the same vehicle (stable campaign vehicle id/payload), carrying L8 exit durability/roster; standalone default starts at 1,000. Any zoo-departure damage is preserved rather than reset. The player can ram regular infected by mass using E09 contact damage; existing infected recovery rules remain. Small groups are not an infinite free shortcut.

### 5.3 Durability and attacks

**Orchestrator defaults:** one completed contact onset with each infected deducts **10 durability**, at any contact speed, including while stopped; no speed threshold makes a collision free. Continuous overlap produces one collision event until separation ≥ 0.5 m for ≥ 0.25 s; a new contact deducts again. This event rule prevents per-tick double billing but does not exempt any distinct infected or repeat collision. Log vehicle id, infected id, contact id, source and before/after HP.

A locally aware infected within 1.5 m of the hull attacks with ≥ 0.6 s windup, **10 durability/hit**, cooldown **1 s**, while the vehicle is stopped (speed < 0.5 m/s) or surrounded (≥ 4 attackers across ≥ 3 hull quadrants within 3 m; orchestrator defaults). Direct attack damage is separate from contact-onset damage. Hold position for 5 s against 4 attackers to demonstrate continued loss; moving away outside reach ends those attacks. Regular bullets/medkits cannot repair the vehicle. UI uses current/max durability, updates within one render frame, is visible on desktop and phone with ≥ 3:1 contrast and no overlap with controls; no repair prompt/item/action exists.

Obstacle and wreckage contact onsets also attempt **10 durability/contact** by default, with the same separation/re-contact rule; identify one logical obstacle across its multiple colliders to avoid double billing.

Durability is non-increasing during a checkpoint segment, clamped to [0,max], serialized in saves/checkpoints. Ordinary player-death checkpoint retry restores the checkpoint value (not an in-world repair); loading the current save never restores max. All infected collisions count, even already downed but still active infected.

### 5.4 Barely functional floor → forced crash → axe-only handover

**L9-specific zero policy:** clamp durability to zero but retain throttle, steering, reverse, braking, ground contact and mass-contact ramming. Cap road/rough-ground top speed to **60% of the current terrain's healthy cap** (10.8 / 7.2 m/s defaults); do not stack a second damage speed penalty. Additional hits still log damage/contact attempts with before=after=0. No regen, repair, ordinary breakdown/fire/explosion, forced early exit or passenger damage from zero HP. Override E09 zero destruction only for the L9 mission vehicle; other vehicles keep their existing rules. Intended routes remain traversable at the floor; reuse vehicle reverse/stuck recovery, not a replacement vehicle or teleport.

Damage stages accumulate at **≤75/50/25/0%**: dents; cracked glass; visible smoke and failed lights; heavy smoke, all nonessential lights dead and wrecked engine sound. Keep navigation/player visibility readable through smoke; use the existing view overlays and E27 smoke pools. Engine strain/roughness increases at each stage, with no duplicate cue per frame; loading a save restores the stage without replaying every threshold cue. At 0 the HUD explicitly says **Barely functional**, avoiding a broken/exit prompt. Night readability comes from E25 ambient/player contrast even when vehicle lights die.

All routes feed one **collapsed bridge/road section** at the outskirts. Approach trigger owns a short crash/camera sequence (default 6–10 s): latch once, temporarily take driving input, impact at the missing section, destroy the vehicle, then place the surviving player at a validated crawl anchor beside the wreck. A safe fallback anchor within the authored crash area handles blocked debris. Wreck/bridge silhouette, impact/debris/smoke and audio reuse E09/E27, never kill the player or corgi. A brief 5–8 s crawl-away uses the existing crawl pose/input; finish at the safe L10 start anchor. No escape route, full-HP bypass, combat gate or pre-finale foot segment.

**Atomic campaign handover:** mark L9 complete, mark APC destroyed/non-enterable and set L10 start on foot. Set the owned/selectable combat-weapon inventory, both racks and active selections to **`weapon.fire-axe` only**; discard all other weapons, weapon magazines/charges and pending weapon rewards/drops that could re-grant the old arsenal. Keep nonweapon progression/perks and unlocked abilities (including corgi lure); weapon entitlement is gated by L10 pickups even if historical unlock flags remain. Axe is selectable immediately. Restore player health to the ordinary next-level spawn value (default full) so the forced crash cannot produce an unwinnable opening. Record pre-crash durability and lost weapon IDs for evidence, without retaining them as usable equipment.

Preserve the living L8 passenger roster in campaign history; default survivors shelter near the wreck and do not become L10 followers, matching the player starting alone. No invented off-screen deaths; corgi remains the protected companion. Persist crash phase/anchor and handover-applied flag: save/load during approach, impact, crawl or L10 start neither duplicates the crash nor resurrects APC/arsenal. Death before the crash uses `outskirts-approach` or the last earlier checkpoint; death after committed handover uses `cure-crash`. Old mid-route broken-APC saves, if supported, migrate to the same zero-HP driveable APC at that saved position rather than to an on-foot route.

### 5.5 Terrain streaming, LOD and budgets

**New terrain chunk streaming is required**, not satisfied by existing prop LOD alone. Reuse `DistrictView.ts` instanced LOD batches (`warmHero`/`swapSlot`), `DistrictAssets.ts` cache/prefetch and `Quality.ts`, then add bounded terrain/collider/nav chunk ownership and unloading. Orchestrator default chunk size 100 × 100 m; detailed residency ≤ 25 chunks high / 9 low, plus coarse distant horizon. Prefetch at least 2 s of maximum-speed travel in the current direction before a seam; maintain collision/driveable support even if visual loading is delayed. Never freeze vehicle input to hide a load.

NPCs/mission/corpse state outside active simulation range remain in serialized chunk state and restore id/health/timers on revisit; rendering disposal cannot resurrect enemies or repair the vehicle. Inactive colliders/nav and unreferenced GPU geometry are released under existing lifecycle rules. LOD transitions preserve terrain heights across seams (≤ 2 cm mismatch), vehicle ground contact and safe finale crawl navigation. Phone preserves route choice/long sight lines using low-detail distant geometry rather than shrinking the map.

E18 budgets at worst populated crossing: **600/300 draws, 1.5M/500k triangles, 200/100 concurrent infected, 4/6 ms sim p95, 400/250 MB heap**, lights/props/debris/particles per E18. Headless real-GPU WebGL2 desktop/phone-profile frame p95 ≤ 16.7/33.3 ms after warmup; desktop streaming/crash hitch ≤ 50 ms. Real iOS/Android ≥ 30 fps p50 manual recorded, WebGPU manual. Sweep every route with healthy and 0-HP APCs, including the finale.

### 5.6 Lighting/weather preset, music/sound and ending

**`L9-crossing`** orchestrator default: late-night cool moonlight continuing the same journey, dry ground, light wind/dust, no forced dawn or rain. Long sight lines come from open terrain/coarse horizon; preserve E25 player/infected readability. Reuse E28 dry/wind preset, road/gravel surface sounds, E16 engine stages/contact/crash/crawl footsteps; licensed low-travel music with pressure layers near threats, engine shuts down only at the crash. Damage-stage/crash cues are captioned and emitted once per corresponding sim event, voice caps 32/16.

Outskirts trigger leads to the mandatory crash and E32 handover (§5.4), never a temporary continuation notice. No credits at L9. Reuse the existing music director for travel/pressure → impact sting → vulnerable L10 opening; audio voices remain 32/16 high/low with captions and focus/pause behavior.


### 5.7 Asset rows (inventory §8 is authoritative)

| Asset / composition | Work / reuse | LOD0 / LOD1 / LOD2 triangle cap |
| --- | --- | --- |
| `veh.military-apc` unarmed + 75/50/25/0% stages/final wreck | Retain on-main base/driveable contract; new shared overlays/engine stages, pooled smoke; floor state stays driveable | 12,000 / 5,000 / 2,000 total per state |
| `kit.crossing-crash` | Existing bridge/road/rubble/APC wreck, authored impact/crawl anchors | bridge/road 12,000 / 4,000 / 1,500; rubble 4,000 / 1,500 / 500 |
| D-CROSSING terrain/road chunks + horizon | Retain greybox, budget missing chunk LOD/dressing; shared E32 streaming contract | terrain 10,000 / 3,000 / 800; road 3,000 / 1,000 / 300; horizon ≤10,000 combined |

All states count toward E18; no new gun, protected reference edit or parallel asset pipeline. Staged engine cues reuse E16 licensed sources and do not require new voice recording.

## 6. Photo spots and pair cameras

`l9-armored-start`, `l9-road-fork`, `l9-countryside-route`, `l9-dry-shortcut`, `l9-long-sightline`, `l9-ram-contact`, `l9-surrounded`, `l9-damage-75`, `l9-damage-50`, `l9-damage-25`, `l9-zero-driving`, `l9-crash-impact`, `l9-crawl-away`, `l9-city-outskirts`, `l9-chunk-seam`.

**Pairs:** `pair-armored-departure` with E30; `pair-crossing-fork` / `pair-crossing-outskirts` healthy versus 0-HP APC at identical cameras; `pair-crossing-crash` pre-impact/wreck; `pair-crossing-cure-start` crawl-away/E32 start; `pair-crossing-seam` before/after unload/reload with retained entity IDs. High/low comparisons cover all three routes. Old `l9-breakdown`, `l9-foot-journey` and breakdown scenes are retired.

## 7. Bruno references

Reuse existing E09/E18 ports first. Read-only `World/PhysicsVehicle.js`, `World/VisualVehicle.js`, `InstancedGroup.js`, `Quality.js`, `ResourcesLoader.js`, `Grass.js`, `Tracks.js`, `View.js` through `08-bruno-reuse-map.md`; no edits to reference checkout.

## 8. Acceptance criteria

**REVISED 2026-10-13:** AC01/03/06/08–20 replace conflicting breakdown/on-foot expectations; AC02/04/05/07 retain compatible requirements. AC21/22 are **NEW**. IDs stay stable, but old passing tags do not prove changed semantics. Each test carries `@E31-ACxx`.

| ID | Criterion | Verification |
| --- | --- | --- |
| E31-AC01 | Graph starts seated in L8 APC, remains in vehicle through all routes regardless of durability, then mandatory outskirts crash/crawl ends L9 and starts L10; no early breakdown, exit, repair or kill-all gate. | sim (`T-E31-01`) |
| E31-AC02 | L8→L9 retains vehicle id/current/max durability, player health/acquired arsenal and exact living roster, with driving control within 0.5 s and no reward/menu. | sim + e2e (`T-E31-02`) |
| E31-AC03 | APC model/action map has no mounted gun; fire inputs for 300 ticks while driving generate zero weapon/projectile/blast events; mass-contact ram damage still hits infected at healthy and zero HP. | unit + sim + visual (`T-E31-03`) |
| E31-AC04 | D-CROSSING has roads, countryside and dry driveable terrain, ≥ 3 connected routes ≥ 900 m, ≥ 2 viewpoints with ≥ 150 m clear sight lines, and next-city silhouette/guidance; map extent ≈ 1,200×800 m. | static + unit + visual (`T-E31-04`) |
| E31-AC05 | Driver leaves/rejoins roads, crosses open terrain and completes each route; dry shortcut is ≥ 20% shorter than longest route and has ≥ 2× collision-risk opportunities; every route has a collision-free detour. | sim (`T-E31-05`) |
| E31-AC06 | Every contact onset with active infected, including slow/downed infected, attempts 10 durability once; ten contacts above the floor lose 100; continuous overlap never bills per tick and re-contact bills again per §5.3. | sim (`T-E31-06`) |
| E31-AC07 | Stopped/surrounded attacks deal 10 damage, ≥ 0.6 s windup and ≥ 1 s cooldown; four attackers continue over 5 s; leaving 1.5 m reach stops damage; contact and attack IDs remain distinct. | sim (`T-E31-07`) |
| E31-AC08 | Durability HUD matches current/max within one frame at 1600×900 and 390×844, contrast ≥ 3:1 and no touch overlap; zero shows Barely functional; repair/medkits/regen never increase durability. | e2e + sim (`T-E31-08`) |
| E31-AC09 | At 0 HP drive/steer/reverse/brake/ram remain enabled, terrain top speed is 60% ± 2% of healthy; further hits stay at zero; zero breakdown/exit/fire/explosion events before the authored crash. | unit + sim + e2e (`T-E31-09`) |
| E31-AC10 | Pre-finale exit input cannot start an on-foot crossing; every intended route/chunk seam is passable at 0 HP; only finale enables safe crawl input, without blocked-collider spawn or passenger/corgi death. | unit + sim (`T-E31-10`) |
| E31-AC11 | One-seed fixtures complete all three routes, with zero reached ≤ 20% and ≥ 80% progress and a preserved-HP run; all reach the same forced crash without cheats; safe driving preserves more HP than the risky shortcut. | sim (`T-E31-11`) |
| E31-AC12 | Chunk streamer exposes resident/queued/unloaded counts; detailed chunks ≤ 25/9 high/low, prefetch ≥ 2 s maximum-speed travel; delayed-load traversal has no missing support or input freeze. | unit + sim + e2e (`T-E31-12`) |
| E31-AC13 | Terrain LOD seams differ ≤ 2 cm; vehicle retains support through unload/reload; entity/corpse IDs and state persist on revisit, vehicle HP never increases through streaming. | sim + visual (`T-E31-13`) |
| E31-AC14 | Last-checkpoint death/save reload restores route, floor speed/stage, occupants, chunks and crash phase; saved HP is preserved; handover flag prevents duplicate crash or restored old arsenal; legacy broken-state migration follows §5.4. | sim (`T-E31-14`) |
| E31-AC15 | Full-HP and zero-HP arrivals both emit exactly one crash/handover; APC becomes destroyed/non-enterable; L10 starts on foot with owned/racked/selected combat weapons exactly [weapon.fire-axe], ordinary spawn health, abilities/corgi preserved and no old rewards/drops. | sim + e2e (`T-E31-15`) |
| E31-AC16 | Dry-night look preserves ≥ 3:1 player/navigation contrast at 0 HP and crawl; engine stages/contact/crash/crawl cues match events, captioned, with E16 32/16 voices and pause/focus handling. | visual + e2e (`T-E31-16`) |
| E31-AC17 | Headless real mouse/keyboard and mobile touch drive road/off-road at healthy and 0 HP through crash to L10 axe-only start, zero console errors; all §6 pairs captured. | real-input e2e (`T-E31-17`) |
| E31-AC18 | Vision A/D/F/G: open terrain/route choice/destination read clearly, APC stages/floor remain driveable and legible, mandatory crash/crawl and vulnerable axe start read; pairs ≥ 7/10, all must items pass, no P0/P1. | vision (`T-E31-18`) |
| E31-AC19 | perf-l9-crossing sweeps routes/floor/crash high/low: draws ≤ 600/300, triangles ≤ 1.5M/500k, infected ≤ 200/100, sim p95 ≤ 4/6 ms, heap ≤ 400/250 MB and E18 caps; frame p95 ≤ 16.7/33.3 ms; desktop stream/crash hitch ≤ 50 ms; five round trips end within 10% of first heap/GPU counts. | perf (`T-E31-19`) |
| E31-AC20 | Continuous one-seed complete L1→L9 preserves all handovers/rosters and campaign weapon progression up to APC, then crash strips weapons to axe for L10; no cheats/reward screens. Real iOS/Android crossing p50 ≥ 30 fps recorded (manual subcheck). | sim + manual (`T-E31-20`) |
| E31-AC21 | Obstacle/wreck contacts attempt 10 durability per distinct contact onset by default, reusing §5.3 separation rule; collider aliases of one wreck do not double bill, floor clamps to zero and contact events expose source/id/before/after. | unit + sim (`T-E31-21`) |
| E31-AC22 | Boundary fixtures at 76/75/51/50/26/25/1/0% select cumulative dents/glass/smoke/lights stages; engine stage follows snapshot, zero has heavy smoke/wrecked sound, reload neither duplicates transition cues nor repairs visuals. | unit + visual + e2e (`T-E31-22`) |

## 9. Notes and verification recipe

**Epic report rationale (spec correction):** the 2026-10-13 PO explicitly removes permanent breakdown and adds the compulsory crash/equipment reset. This replaces the wrong 10-11 criteria without claiming the new behavior is implemented. Retain completed L9-S1 durability and L9-D1 greybox. Cancel the old L9-S2 safe exit/foot plan; migrate any matching tests to the new expectations, not fake tags. Prioritize bounded residency and zero-HP drivability before dressing. Ordinary E09 zero destruction remains unchanged outside this mission.

During implementation: typecheck/lint/unit (Vitest ≤ 4 workers), `npm run verify -- E31`, ≤ 2 headless Playwright workers, driving scale ≤ 2, macOS real-GPU WebGL2 `--use-angle=metal`; WebGPU/devices manual recorded. Reuse the server on 3300. Store route/HP/stage/crash/handover logs, seam comparisons, memory/fps and review/report under `test-results/epics/E31/`. This spec lane runs document consistency and targeted static/traceability checks; gameplay/browser/perf gates belong to the planned lanes.

## 10. Implementation plan

Every executable lane ≤ 3 h; split further if measured scope exceeds it. L9-S1/D1 are **on main**, not work to repeat. Retain their contact/greybox behavior and regression assertions. S3/S4 become the shared terrain/region streaming basis for E32, not a second streaming framework.

| Lane | Budget | State / dependencies | Concrete change and reuse |
| --- | --- | --- | --- |
| L9-S1 systems | 3 h (original) | **done, on main; retain** | Existing shared APC mass-only durability/contact and stopped/surrounded attacks. No rebuild. |
| L9-D1 district | 3 h (original) | **done, on main; retain** | Existing D-CROSSING road/countryside/dry greybox and route graph. |
| L9-S2 systems (old) | — | **cancelled** | Old breakdown, compulsory exit and on-foot arsenal plan must not run. Replaced by S5/S6/S7. |
| L9-S5 systems | 3 h | S1 | Mission-scoped 0-HP floor, 60% cap, prevent early exit/E09 destruction; obstacle/wreck contact damage, HUD and checkpoint stage restore. |
| L9-S3 streaming | 3 h | D1 | Reuse DistrictView LOD batches, DistrictAssets cache and Quality; bounded terrain lifecycle/global-to-local anchors usable by E32. |
| L9-S4 streaming | 3 h | S3 | Reuse DistrictWorld/staticCollision/NavGrid and snapshots: collider/nav residency, predictive prefetch, delayed-load support and persistent seam/revisit state. |
| L9-A1 assets/audio | 3 h | S5 | APC dents/glass/lights overlays, pooled smoke and four engine stages using existing APC/E16/E27; per-LOD budgets in inventory. |
| L9-A2 assets | 2 h | D1 | Collapsed bridge/road and APC wreck composition using existing bridge/rubble/wreck GLBs; safe crash/crawl anchors. |
| L9-D2 district | 3 h | S4, A2 | Dress existing terrain/chunks with countryside stock, E25/E28 dry-night preset; funnel all routes into authored crash approach. |
| L9-S6 systems | 3 h | S5, A2 | Reuse mission triggers, E09 wreck and camera/crawl clips: one-shot forced crash at any HP, validated safe anchors and crash-phase save/load. |
| L9-S7 systems | 3 h | S6 | Reuse campaign/progression/checkpoints: atomic axe-only loadout reset, abilities/corgi/roster history, L10 start payload and legacy broken-save handling. |
| L9-E1 encounters | 3 h | S4, S7, D2 | Existing infected director/spatial hash/ram: avoidable groups, shortcut risk, early/late-zero/preserved fixtures and crash completion. |
| L9-Q1 Scene Lab | 3 h | A1, E1 | Planned qa-l9-{fork,ram,surrounded,damage-stages,zero-driving,seam,crash,crawl}.json; healthy/floor, impact/wreck and L10 handover pairs. |
| L9-Q2 sim regression | 3 h | Q1 | Consolidate revised T-E31 scenarios developed per systems lane, all-route early/late-zero/crash/axe fixtures and one-seed L1→L9 campaign. |
| L9-Q3 browser e2e | 3 h | Q2 | Real mouse/keyboard/touch driving, floor/crash/axe handover and visual/HUD/audio/caption assertions; reuse existing input/recorder fixtures. |
| L9-Q4 performance | 3 h | Q3 | Route/seam/crash high/low E18 counters, delayed-load and five-round-trip memory probes; manual WebGPU/device recipe. |
