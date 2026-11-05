# E30 · Level 8: The Zoo

> **New 2026-10-11 per product owner:** [`po-levels-4-9-2026-10-11.md`](po-levels-4-9-2026-10-11.md) wins on any disagreement. All ACs are **NEW 2026-10-11**, including the subsequent PO health-bar/special-move update. Numeric/layout/timing choices are **orchestrator defaults**. Existing D-ZOO assets/data are reused for this new campaign district build; nothing is declared built by this spec.

## 1. Goal

The evacuation bus reaches a large zoo converted into a genuine-looking safe zone. Let the player freely explore for 60 seconds with no objective, then breach it from an unsecured underground network at several locations simultaneously. Humans and normal animals become infected; the player uses the accumulated arsenal to escort survivors to an armored military vehicle and escape.

> PO, verbatim: "The zoo has been converted into a safe zone."
>
> "There is deliberately no immediate objective."
>
> "For roughly the first 60 seconds, nothing major happens."
>
> "The zoo has an underground tunnel or maintenance network that the military failed to secure. Zombies emerge from several locations inside the zoo simultaneously."
>
> "The animals can then become infected as well."
>
> "This introduces the infected zoo animals that were already prepared for the game, including creatures such as infected lions and other zoo animals."
>
> "The goal is not to clear the zoo. It is to reach an armored military vehicle."
>
> "The level ends when the player and surviving group escape in that vehicle."

> Later PO, verbatim: "Same for Zoo animals" (health bars and special moves, following "Alpha should have a health bar and special moves"). The source's revised orchestrator decisions specify lion, gorilla, elephant, zebra and flamingo moves; all are required here.

## 2. Depends on / Enables

E29 (bus arrival, arsenal/group), E07 (Alpha and existing lion/gorilla/cat/other animal archetypes), E08 (human/pet turning, group follower), E09 (vehicle transport), E10 (existing D-ZOO scaffold and decay), E12–E14, E16, E17 (healthy animal variants), E18, E25 (safe-zone lights), E26 (enclosures/props), E27 (combat/fire), E28 / **E31**, M3.

## 3. Scope

**In:** D-ZOO perimeter walls, military presence, civilians and zoo staff, intact facilities/paths/lights/infrastructure, normal animals; 60 s calm without objective; internal emergence from ≥ 3 tunnel points; attacks on civilians/soldiers/staff/animals; animal infection using existing archetypes including lion; regular infected, Alphas, turned humans and infected animals together; escape in an armored military vehicle with surviving group; all prior weapons retained.

**Out:** a new weapon, clearing the entire zoo as a completion condition, a siege through the perimeter replacing the internal breach, unrelated replacement animal models; new infected elephant/zebra definitions and variants are required derivatives of normal bases. Optional infected visible outside walls cannot enter during calm.

## 4. Level structure and story beats (~5 min, orchestrator default)

| # | Beat | Location (`D-ZOO`) | What happens | Target time (default) |
| --- | --- | --- | --- | --- |
| 1 | Sanctuary | bus arrival inside perimeter → entrance/ticket area | Soldiers, staff and civilians occupy clean lit facilities; normal animals are in enclosures; carried survivors unload. The player walks freely without an objective. | 0:00–1:00 |
| 2 | From below | ≥ 3 internal maintenance exits | Infected emerge simultaneously inside the walls from the unsecured tunnel network. They attack all four PO-listed groups, including animals. | 1:00–1:30 |
| 3 | Zoo outbreak | enclosure paths, staff/service yard | Humans turn and animals become existing infected lion/gorilla and other zoo archetypes; Alphas join regular infected. The safe zone becomes a mass battle. | 1:30–3:30 |
| 4 | Fight to escape | connected paths → armored vehicle point | The player fights through the zoo with the surviving group. Objective: reach the armored military vehicle, not kill all threats. | 3:30–4:45 |
| 5 | Departure | armored vehicle → zoo exit road | Player and living group board and leave, carrying their roster/weapons immediately into L9 inside the same vehicle. | 4:45–5:00 |

**Checkpoints (orchestrator defaults):** `sanctuary`, `breach`, `escape-route`. No fail timer; existing continuing-campaign survivor-loss rules apply, zero survivors remains completable. Initial 60 s is the PO's deliberate calm, not padding for a time band. Single-seed completion gate follows PO 10-09.

## 5. Systems

### 5.1 District and false safety

Extend `src/levels/districts/D-ZOO.ts` and the existing zoo layout/assets, rather than register a second D-ZOO. Orchestrator default extent ≈ 240 × 180 m, closed perimeter with player-accessible clean paths linking lion/gorilla/elephant/zebra/flamingo enclosures, ticket/map area, staff facilities and service yard. Reuse `bld.zoo-gate`, existing zoo/enclosure kit where integrated, E26 fence/prop collision, `npc.national-guard` and civilian routines. ≥ 2 connected paths lead from each enclosure to the vehicle; clear route width ≥ 2.5 m. Strong wall collision/sight boundaries prevent outside infected entering through geometry.

Orchestrator default safe crowd on both tiers: carried L7 survivors plus ≥ 20 local adult civilians, ≥ 6 soldiers and ≥ 4 staff (staff clothing tint/props on civilian bases). ≥ 8 normal animals including all five species: ≥ 1 lion, ≥ 1 gorilla, ≥ 1 elephant, ≥ 2 zebras and ≥ 3 flamingos (so herd/flock moves have real participants), in functioning enclosures. All PO safety elements are present: intact facilities, clean paths, lights and functioning infrastructure. Bodies/corpses do not pre-dress the sanctuary. Civilians converse/rest, staff tend animals, soldiers guard; no idle-facing-nowhere > 3 s.

**60 s of active sim time** begins when player control returns after arrival (orchestrator decision). No objective, waypoint, objective panel or forced tutorial during [0,60); free movement/weapon selection, no scripted major incident. Player-triggered firing is allowed and does not skip the timer or turn animals magically (orchestrator default). Pause freezes the timer; checkpoint restores remaining time. At 60 s start the internal breach, independently of player exploration.

### 5.2 Simultaneous internal breach

At ≥ 3 distinct tunnel/maintenance points separated ≥ 20 m, inside the perimeter, the first infected appear within a 1 s window after 60 s (orchestrator defaults). Use `HouseEmergence.ts`, service-door anchors and existing offscreen visibility rules; if an entrance is visible, infected walk out from an occluded connected tunnel behind the door rather than pop into the frustum. Do not defer the whole breach until the player looks away.

Orchestrator defaults: first release 6 infected per point high / 3 low, then director escalation to concurrent **200/100 total infected**, including turned humans and animals; **3–5 Alphas over the run on both tiers** within those caps (E07). Internal outbreak is the cause; no perimeter breach replaces it. Every civilian/soldier/staff/animal is a valid appropriate target except existing protected companion/child rules (adults only in outbreak population). Alpha never receives new zoo-specific powers.

### 5.3 Normal animals → infected animals

Reuse `src/data/infected.ts` `infected.lion`, `infected.gorilla`, `infected.flamingo`; extend with `infected.elephant`/`inf.elephant` and `infected.zebra`/`inf.zebra`, derived from `amb.elephant`/`amb.zebra` (currently manifest placeholders, so normal bases must be built once). Existing pet `infected.cat` remains a lifecycle/rig reuse reference; assets `inf.lion`, `inf.gorilla`, `inf.flamingo`, `inf.cat-tabby` already have GLBs/LODs. Healthy lion/gorilla/flamingo looks are **new variants of the shipped infected bases**; elephant/zebra infected looks derive from their normal bases as the PO specifies. Healthy appearances remove blood/glowing eyes until bitten. Existing normal decorative animals alone do not satisfy the conversion criterion.

Extend existing `src/sim/npc/Civilians.ts` pet-turning hooks and `src/sim/outbreak/Outbreak.ts` identity/appearance handling for zoo animals; current outbreak human target query excludes pets, so this targeting/conversion path needs explicit work. Orchestrator default infection delay 2.5–3.5 s after a successful bite, same id/location/species with no duplicate entity; switch appearance and assign the existing infected species brain. Reuse lion pounce/pin, gorilla prop throw via E26, flamingo/cat behaviors; extend physical moves through the shared E07 scheduler/resolvers, preserving existing pin/throw behavior. **All five species use E07 world-space bars and every species-specific special listed there**; normal animals have no bar. No fantasy creature.

In a seeded unprotected demonstration, each of lion, gorilla, elephant, zebra and flamingo becomes infected in isolated species fixtures, and attacks on each of civilian/soldier/staff/animal occur. In free play conversions are systemic and rescuable, not scripted deletion/spawn events; the calm animals are not secretly hostile. Human turns keep clothes/uniforms and discard weapons, using existing infection lifecycle. Permanence/accessibility rules apply.

### 5.3b Required health bars, special moves and Scene Lab coverage

The latest PO "Same for Zoo animals" applies to **every infected zoo animal**, not only elites. Use E07's single health-bar contract: damaged OR ≤ 15 m, HP fill within 1 %, one-frame update, phone minimum 48×6 CSS px/contrast ≥ 3:1, occlusion/death handling. Normal animals have zero bars.

E07's tables are normative for damage, radii/arcs/sweeps, knockdown/pin/stagger, telegraph and cooldown. All are orchestrator defaults: lion pounce/pin 0.6 s/8 s and flank 0.6 s/10 s; gorilla chest-beat 1 s/15 s, 5 m pound 1 s/12 s, throw 0.8 s/10 s; elephant stampede 0.9 s/14 s and 3 m trunk swipe 0.7 s/7 s; zebra rear kick 0.6 s/6 s and herd stampede 0.8 s/12 s; flamingo flock dive 0.6 s/8 s with ≤ 0.8 s view obstruction. No effect before ≥ 0.6 s telegraph; cooldowns serialized across restoration. Alpha in the same battle has its four E07 moves/bar.

**One required Scene Lab scene per move**, proposed under `specs/scenes/`, owned jointly by E07/E30 implementation:

| Species | Required scene files | E30 test suffixes (all `@E30-AC10`) |
| --- | --- | --- |
| Lion | `qa-zoo-lion-pounce.json`, `qa-zoo-lion-flank.json` | `T-E30-10-lion-pounce`, `T-E30-10-lion-flank` |
| Gorilla | `qa-zoo-gorilla-roar.json`, `qa-zoo-gorilla-pound.json`, `qa-zoo-gorilla-throw.json` | `T-E30-10-gorilla-roar`, `T-E30-10-gorilla-pound`, `T-E30-10-gorilla-throw` |
| Elephant | `qa-zoo-elephant-charge.json`, `qa-zoo-elephant-swipe.json` | `T-E30-10-elephant-charge`, `T-E30-10-elephant-swipe` |
| Zebra | `qa-zoo-zebra-kick.json`, `qa-zoo-zebra-stampede.json` | `T-E30-10-zebra-kick`, `T-E30-10-zebra-stampede` |
| Flamingo | `qa-zoo-flamingo-dive.json` | `T-E30-10-flamingo-dive` |

Each scene uses a fixed seed, ≥ 2 activations, pre-telegraph/active/impact/expiry frames, just-inside/outside radius and solid-wall controls, damaged/in-range phone bar probes and normal-animal no-bar control. Mixed outbreak e2e proves arena specials are wired into L8. These scenes are planned, not yet built.

### 5.4 Arsenal, group and armored escape

Keep the acquired six-weapon arsenal from L7, including unlimited rocket launcher; no new weapon pickup. Reuse `Survivors.ts` group tracking/formation and allied fighters from `Allies.ts`. Orchestrator default: carried group follows after the breach; nearby zoo adults may join through the existing survivor interaction, but no fixed extra rescue mission is introduced.

Reuse `veh.military-apc` base (currently an HMG set piece): create an **unarmed transport variant** with no mounted gun, valid driver/wheel/exit/passenger anchors and a new drivable definition derived from existing E09 data, shared with E31. Boarding retains the complete living survivor roster even if occupants use grouped silhouettes; do not drop survivors to fit a visual seat count. Once all living group members board, escape begins and L9 loads immediately inside this same armored vehicle; no reward screen. A remaining horde does not block completion.

**Art direction addendum (orchestrator 10-19, Opus visual QA #34: "L8 drive-out, L9 and L10 are nearly empty: flat dark plane, pale purple road ribbon with hard ends, one tree, two vehicles ..."; L8 stunning 4/10):** the zoo stands in a town, not on a dark plane. The game camera sees past the perimeter wall whenever the player walks along it (north and west walls show their outside at the top of the frame), and the armored vehicle's pad at the south-east corner is the start of the drive-out. Dress the 40 m outside the wall on all four sides with existing kits: a service road ring with kerbs, verges and lamp posts that never ends in view (it runs into trees, a roadblock of wrecks, or a building row), roadside warehouses/shops/houses, parked and wrecked vehicles, tree rows and hedges, utility poles, and scattered light points (street lamps, a lit window, a hazard blinker, a light tower). The south-east drive-out corner has a visible road leaving the pad's side of the wall. Walls, collision, paths, gates, nav inside the wall and the L8 timings are unchanged (the dressing is outside the closed 4 m wall and unreachable). Each camera frame along the wall at zoom 1 shows at least one light point or a strong silhouette beyond the wall. Targets: stunning >= 7 in the Opus visual QA; E18 budgets hold at high and low.

### 5.5 Lighting/weather preset, music/sound

**`L8-zoo` night** (orchestrator default continuing L7's night): powered warm path lights, enclosure/service lights and cool moonlight, intact facilities. Use E25 light field/power groups; scene stays readable after outbreak without inventing a mandatory blackout. Orchestrator default dry light breeze; reuse E28 night weather. All normal animals readable at safe paired spots; player contrast ≥ 3:1 in combat, existing E18 hero-light and particle caps hold.

Music: reuse licensed E16 calm stem for first 60 s, then combat layers scaled to outbreak pressure; no new track requirement. Sound: zoo/normal-animal ambience, staff voices, working infrastructure → tunnel footsteps/door cues → screams, human/animal attacks, gunfire/rockets → armored engine. Distinct lion/gorilla telegraphs retain existing E07/E16 timing/captions; no hidden hostile-animal cue before infection. Voice caps 32/16, mix and pause behavior remain.

## 6. Photo spots and pair cameras

`l8-arrival`, `l8-safe-paths`, `l8-normal-lion`, `l8-normal-gorilla`, `l8-tunnel-breach`, `l8-animal-turn`, `l8-mixed-battle`, `l8-escape-route`, `l8-armored-boarding`.

**Pairs (orchestrator defaults):** `pair-zoo-gate`, `pair-zoo-lion`, `pair-zoo-gorilla`, `pair-zoo-service-yard` at calm [0,60) and outbreak, exact fixed camera transforms; `pair-armored-departure` shared by L8 exit/L9 start. Animal-turn capture includes pre-bite, transition and infected frames tied to the same entity id.

## 7. Bruno references

Reuse repo D-ZOO layout, `DistrictView.ts`, crowd/animal rigs, E26 props and E27. Read-only `Zones.js`, `Objects.js`, `InstancedGroup.js`, `World/PoleLights.js`, `World/VisualVehicle.js`, `View.js` via `08-bruno-reuse-map.md`; never edit the reference checkout.

## 8. Acceptance criteria

All rows **NEW 2026-10-11**. Numeric defaults come from §5; each test carries `@E30-ACxx`.

| ID | Criterion | Verification |
| --- | --- | --- |
| E30-AC01 | Graph (arrival/calm → internal breach → fight to vehicle → board/depart) is completable with 0–35 carried survivors, no kill-all objective or fail timer. | sim (`T-E30-01`) |
| E30-AC02 | `complete` finishes one seed from `L8-default` without cheats, ≥ 60 % of carried group survives (orchestrator default); no need to eradicate infected elsewhere. | sim (`T-E30-02`) |
| E30-AC03 | L7 bus arrives at D-ZOO; exact living roster/acquired arsenal transfers; companions start every level at full health (orchestrator 2026-10-16: hours pass between levels), while vehicle durability is preserved; six-weapon standalone loadout selectable, no new weapon pickup anywhere in L8, rocket remains unlimited. | sim + e2e (`T-E30-03`) |
| E30-AC04 | For exactly 60 active sim seconds after control returns there is no objective/waypoint/forced tutorial or scripted attack/conversion/breach; movement and weapon selection work; pause and sanctuary restore preserve remaining calm time. | sim + e2e (`T-E30-04`) |
| E30-AC05 | Before breach, strong closed walls, ≥ 20 local civilians, ≥ 6 soldiers, ≥ 4 staff, ≥ 8 normal animals incl. all five zoo species, ≥ 2 zebras and ≥ 3 flamingos, intact facilities, clean paths, powered lights and working infrastructure exist on both tiers in addition to carried group. | static + sim + visual (`T-E30-05`) |
| E30-AC06 | Outside-wall infected fixture cannot cross the perimeter or damage inside occupants during calm; staff/civilian/soldier/normal-animal routines show no hostile brain or idle-facing-nowhere > 3 s. | sim (`T-E30-06`) |
| E30-AC07 | First breach begins at 60 s ± 1 tick, at ≥ 3 inside tunnel points ≥ 20 m apart within a 1 s window; 6/3 initial infected per point high/low, with no visible pop-in or postponement due to camera facing. | sim + e2e (`T-E30-07`) |
| E30-AC08 | In unprotected seeded fixture, logged attack/bite target categories include civilian, soldier, staff and normal animal; target selection uses local perception, no omniscient live-player position. | sim (`T-E30-08`) |
| E30-AC09 | In isolated unprotected fixtures all five normal zoo species turn 2.5–3.5 s after bites, keeping id/location/species, adopting lion/gorilla/flamingo or derived elephant/zebra brain/appearance; no duplicate/pre-infected substitute. Healthy animals have no HP bar; after infection shared bar eligibility activates. | sim + visual (`T-E30-09`) |
| E30-AC10 | **All ten E07 zoo move rows** meet ≥ 0.6 s telegraph, exact cooldown/damage/range/radius/arc, knockdown/pin/stagger, roar/flank/herd expiry and wall/one-hit controls; one named §5.3b Scene Lab scene/test suffix per move. Human turns preserve ids/clothes and rescue window; every Alpha in L8 uses its four E07 moves. | sim + e2e + visual (`T-E30-10`) |
| E30-AC11 | After breach regular infected, 3–5 Alphas over run, turned civilians and infected zoo animals coexist; total concurrent infected incl. animals/turns ≤ 200/100 and emergence audit passes. | sim (`T-E30-11`) |
| E30-AC12 | D-ZOO has ≥ 2 connected escape paths from each main enclosure, clear width ≥ 2.5 m; gates/props/nav preserve valid routes during outbreak; escape objective points to vehicle, not all enemies. | unit + sim (`T-E30-12`) |
| E30-AC13 | Living group follows without teleport (> 1 m/tick); injured/bitten/dead states and losses persist; every living group member boards before escape; all-dead group path remains completable. | sim (`T-E30-13`) |
| E30-AC14 | Escape APC has no mounted gun or firing action and valid driver/exit anchors; departure ends L8 and loads L9 inside the same vehicle with exact survivor roster, acquired weapons and vehicle identity/durability, no reward/menu. | sim + e2e (`T-E30-14`) |
| E30-AC15 | Every infected zoo species and Alpha uses E07 world-space bar: damaged OR ≤ 15 m, fill within 1 %, one-frame update, phone ≥ 48×6 CSS px and ≥ 3:1 contrast, truthful occlusion/death. Normal animals have no bar. Powered L8 lighting maintains ≥ 3:1 player contrast, E25/E18 caps and accessibility settings both tiers. | visual + e2e + unit (`T-E30-15`) |
| E30-AC16 | Calm→breach→mixed-battle→engine phases emit appropriate music/ambience/telegraph captions; no hostile animal cue pre-infection; E16 voice 32/16 and mix/focus rules hold. | unit + e2e (`T-E30-16`) |
| E30-AC17 | Death after each checkpoint restores calm timer, breach progress, human/animal healthy/bitten/turned/dead state, weapons and group/vehicle roster without replaying or duplicating conversions. | sim (`T-E30-17`) |
| E30-AC18 | Headless real-input Playwright explores during calm, observes breach, fights to APC and loads L9 on one seed with zero console errors; mobile touch reaches escape interaction without HUD overflow; capture all §6 spots/pairs. | real-input e2e (`T-E30-18`) |
| E30-AC19 | Vision review A/C/D/E/G on calm/outbreak pairs reads strong sanctuary then internal mass outbreak, normal→infected lion/gorilla continuity, mixed threats and armored escape; each ≥ 7/10, all must items pass, no P0/P1. | vision (`T-E30-19`) |
| E30-AC20 | `perf-l8-mixed-outbreak` high/low holds E18 draws ≤ 600/300, triangles ≤ 1.5M/500k, sim p95 ≤ 4/6 ms, heap ≤ 400/250 MB, 200/100 infected incl. animals plus calm crowd; lights/props/particles/voices within caps, frame p95 ≤ 16.7/33.3 ms headless real-GPU desktop/phone profiles and desktop breach/conversion hitch ≤ 50 ms. | perf (`T-E30-20`) |

## 9. Notes and verification recipe

Existing D-ZOO is a scaffold from the old campaign; healthy and derived elephant/zebra variants, world-space bars/special-move extensions, simultaneous internal breach and animal-target query are pending. Reuse lions/gorillas/cats before new art/AI. The calm/inside-wall promise and multi-point breach must coexist even when the player camps at a tunnel door; connected occluded tunnel geometry solves emergence visibility.

During implementation run typecheck/lint/unit (`--maxWorkers=4`) and `npm run verify -- E30`; Playwright ≤ 2 workers, headless only, macOS real-GPU WebGL2 `--use-angle=metal`, manual WebGPU. Save all T-E30 evidence and paired vision review to `test-results/epics/E30/`.

## 10. Implementation plan

Ordered lanes, each ≤ 3 h; keep all PO scope if more lanes are needed.

| Lane | Budget | Concrete change and reuse |
| --- | --- | --- |
| L8-S1 systems | 3 h | Extend `Civilians.ts` pet lifecycle and `Outbreak.ts`/`Perception.ts` target query to healthy zoo animals with same-id species conversion; reuse existing `InfectedSystem.ts` lion/gorilla/cat brains and rigs. |
| L8-S2 systems | 3 h | Reuse E09 `Vehicles.ts`, `VehicleBody.ts` and `src/data/vehicles.ts` for shared unarmed APC driver/passenger/exit contract; preserve campaign roster and L9 vehicle identity. |
| L8-S3 special moves | 3 h | Consume E07 shared scheduler/resolvers and Z-S1/Z-S2: lion/gorilla/elephant moves, world-space bars and cooldown save state; E07 is the normative tuning table. |
| L8-S4 special moves | 3 h | Consume E07 Z-S3 zebra/flamingo behaviors and obstruction accessibility; wire all five species into L8 target/infection path. |
| L8-D1 district | 3 h | Extend existing D-ZOO layout/data using `bld.zoo-gate`, zoo enclosures/maintenance assets, E26 fences and E25 path lights; strong walls, connected public/service paths. |
| L8-D2 district + variants | 3 h | Derive healthy lion/gorilla/flamingo looks from shipped infected bases; normal elephant/zebra bases and derived infected variants reuse E07 Z-D1/Z-D2, civilian-base staff variants, unarmed `veh.military-apc` visual variant; author ≥ 3 occluded tunnel outlets. |
| L8-E1 encounters | 3 h | Reuse `HouseEmergence.ts`, director, `Allies.ts` and survivor group controller: 60 s no-objective calm, simultaneous internal breach, human/animal conversion, 3–5 Alphas. |
| L8-E2 escape | 2 h | Reuse `Survivors.ts`, interaction and mission/campaign handovers: route to vehicle, complete roster boarding, L9 begins inside APC. |
| L8-Q1 Scene Lab | 3 h | Proposed `qa-l8-{sanctuary,breach,animal-turn,mixed-battle,escape}.json`; four calm/outbreak pairs, vehicle pair, E18 mixed-species counters. |
| L8-Q1b per-move Scene Lab | 3 h | Ten §5.3b `qa-zoo-*.json` scenes, activation/impact/expiry/cooldown/wall probes and shared bars on desktop/phone; reuse E07 Z-Q1 scenes without duplication. |
| L8-Q2 browser e2e | 3 h | Proposed `tests/levels/L8.test.ts`, `tests/e2e/levels/L8.spec.ts`, `tests/perf/l8-budgets.spec.ts`: real input/touch, timer/animal identity/escape, all T-E30 evidence/review. |
