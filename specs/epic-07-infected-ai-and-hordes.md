# E07 · Infected AI, Archetypes and Hordes

## Goal
Fast, aggressive infected that read clearly and scale to hundreds. This covers the archetype behaviors (concept §7), perception, steering-based crowd movement over a navigation grid, spawning with budgets and pooling, migrations, and the GPU crowd rendering path.

## Depends on / Enables
E04, E05 / E08, E19–E24, E29–E31, E18.

## Scope
**In:**
- **Navigation:** a navigation grid per district (0.5 m cells, baked from static colliders at level load), a hierarchical path (district graph → grid A* with a per-tick budget), and **flow fields** toward the player or objective for groups larger than 20.
- **Steering:** seek, separation (spatial hash), obstacle avoidance, and lunge.
- **Perception:** sight cone, hearing (noise events), and screamer alerts.
- **Brain states:** `idle/wander → alerted → chase → attack → (stagger) → dead` plus archetype specials (lunge, charge, scream, explode, shield block, revive, grab).
- **Attack telegraphs:** a wind-up of ≥ 0.35 s before damage, exposed as a `telegraph` event for VFX.
- **Spawning:** `SpawnDirector` with spawn points (off-screen, ≥ 18 m from the player, not visible), waves, ambient population, and **migrations** (spline streams), all under concurrency caps per quality tier.
- **Pooling:** entity reuse with zero GC churn in steady state.
- **Rendering:** rigid-part instanced crowd renderer (`02` §6), archetype visual variants, and corpses.
- **Infected animals** (concept §7 rows): dog packs (pack steering: flank and surround, pounce knockdown 0.6 s), cats (perch points from the layout data, hidden-until-close ambush, leap + cling), **crow flocks** (one flock entity with boids for up to 20 birds; circle → dive attack cycle; scatter on loud noise; each bird 1 HP; counts 0.25 toward the concurrency cap), and zoo elites (lion pounce-pin, gorilla prop-throwing using E26 props, flamingo flocks).
- **PO 2026-10-11 additions:** `inf.alpha` resistance/physical moves, shared world-space health bars, and zoo lion/gorilla/elephant/zebra/flamingo special moves; elephant/zebra derive from normal bases (tables below).
- **Civilian → infected turning** (hook used by E08): the grab behavior (an infected adjacent to an adult civilian may grab them with an archetype-specific chance) and spawning the risen infected from the civilian's variant mapping, within the concurrency cap.

**Out:** civilians themselves (E08).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`InstancedGroup.js`](../folio-2025/sources/Game/InstancedGroup.js): crowd instancing base (extended with the GPU part-transform texture)
- [`Zones.js`](../folio-2025/sources/Game/Zones.js): aggro and trigger volumes

## Alpha (PO update 2026-10-11)

Source: [`po-levels-4-9-2026-10-11.md`](po-levels-4-9-2026-10-11.md), highest priority. Existing human/animal AI remains; **new scope is not built yet**. Asset/archetype shorthand `inf.alpha` maps to sim definition `infected.alpha`, matching `src/data/infected.ts` conventions.

> PO, verbatim: "They are not fantasy monsters or bosses, but unusually resilient infected that can absorb concentrated gunfire and physically break defensive lines. Their real tactical value is that soldiers have to focus on them while regular infected overwhelm the gaps."

- Derive from `assets/inf.common-worker/build.py` and its human rigid-part hierarchy, 1.35–1.5× height (default 1.45×), heavier torso/limbs, adult human silhouette and glowing eyes. Reuse crowd baking, ordinary chase/attack/recovery clips, perception and spatial hash. The newer PO update supersedes the earlier no-health-bar/no-special-moves default: use the world-space bar and four physical moves below, keeping the adult human silhouette.
- **Orchestrator defaults, measurable tuning:** base HP 200 × existing `INFECTED_TOUGHNESS = 1.5` = **300 effective HP** (apply toughness once), speed 3.8 m/s, radius 0.55 m, attack range 1.5 m, ordinary melee windup 0.5 s, 25 contact damage, attack interval 1 s. Soldier contact knocks down for 1.2 s; damage and recovery use existing ally health/hurt state. Special moves extend these ordinary attacks as specified below; cooldowns prevent continuous special spam.
- **Resistance table (orchestrator defaults):** unupgraded landed hits at full HP, no headshot bonus; effective damage is catalog damage × the listed Alpha multiplier, with pellet distance falloff / blast radial falloff applied first. HP depletion by firearms means incapacitation with the existing recovery rule unless a newer PO criterion explicitly requires permanent kills (E23 normal-shotgun fixture). Rockets are explosive permanent kills. Do not stack older generic armor resistance on Alpha.

| Weapon | Current catalog baseline | Alpha multiplier (resistance) | Effective damage and shots at 300 HP |
| --- | --- | --- | --- |
| Handgun `weapon.handgun` | 20 damage, 3 shots/s | 0.50 (50 %) | 10/hit; 30 landed shots; ≥ 9.6 s first-to-last |
| Campaign machine gun `weapon.army-mg` | 14 damage, 10 rounds/s | 0.50 (50 %) | 7/round; 43 landed rounds; ≥ 4.2 s sustained burst |
| Shotgun `weapon.shotgun` | 150 total/shell, 8 pellets, 2 shots/s | 0.80 (20 %) | 120/shell at ≤ 4 m with every pellet landing; 3 shells; 1.0 s first-to-last (fixture ≤ 1.1 s) |
| Rocket `weapon.rocket-launcher` | 180 blast damage, 0.8 shots/s | 1.00 (0 %) | 180 at blast center; 2 center blasts; 1.25 s first-to-last; more at the edge after E27 falloff |

Shotgun is fastest single-target at close range; machine gun keeps its piercing/group role. Ally rifle/HMG use 0.50 multiplier (orchestrator default); ordinary melee keeps its existing damage, but contact kick cannot bypass Alpha HP by forcing a full knockdown (orchestrator default).

**E26 defensive-line interaction:** reuse `Barricades.ts` slot HP and `PropSystem.ts` collision/nav updates; Alpha ordinary hits apply 100 barricade HP damage per hit at 1 s intervals (orchestrator default). A 300 HP sandbag/barricade fixture breaks on hit 3, never on hit 1; remove its blocking state within one sim tick, preserve debris and log source/slot/HP change. No scripted gap deletion. The E22 fixture proves soldiers concentrate on Alpha while regular infected cross the opened line.

| Level | Alpha count over one run, both tiers | Spawn rule |
| --- | --- | --- |
| L1–L3 | 0 | First introduction is L4 |
| L4 | 2–3 | After internal evacuee turn, inside 120/60 infected caps |
| L5 | 1–2 | Included in 12–20 scattered infected; no group > 3, no director |
| L6 | 0 (orchestrator default) | Preserve existing maintenance-tunnel encounters |
| L7 | 4–6 (orchestrator default for "multiple" / "several") | Distributed city + final horde, within 200/100 concurrent infected |
| L8 | 3–5 (orchestrator default for "several") | After internal tunnel breach, within 200/100 concurrent infected |
| L9 | 0 (orchestrator default) | Use regular infected for crossing decisions; no additional archetype required |

## Alpha and infected zoo animals: health bars and special moves (latest PO 2026-10-11)

> PO, verbatim: "Alpha should have a health bar and special moves".
>
> PO, verbatim: "Same for Zoo animals".

These later PO statements and the revised source's orchestrator decisions supersede the former no-health-bar/no-special-moves default. **Every Alpha and infected zoo animal** uses the same world-space health bar; **normal animals have no health bar**. All listed moves are required; tuning below is an **orchestrator default**, not a scope cut.

### Shared health-bar contract

- Anchor a camera-facing bar above the actual head/body bounds; show when **current HP < max HP OR horizontal distance ≤ 15 m**, hide when pristine and > 15 m, occluded behind solid geometry, outside the frustum or permanently dead (orchestrator defaults). Damaged-but-visible animals keep bars beyond 15 m; low tier never silently omits a species' bar. Recoverable downings keep HP/recovery state truthful.
- Fill equals clamped current/max HP within 1 % and updates within one render frame. On 390×844 and 844×390 phone viewports, minimum **48×6 CSS px**, fill/outline/background contrast ≥ 3:1, ≥ 2 px outline/gap to silhouette; readable at default camera and text scale. On desktop minimum 64×8 px (orchestrator defaults). World anchor tracks within 2 px after camera movement; scale is screen-readable, not tiny far-away geometry.
- Reuse `GameUI.ts` health-fill math/colors and render camera/billboard/instancing patterns, with a pooled shared bar batch (new view work; no existing enemy-bar system found). It reads sim HP only, never controls gameplay. Normal zoo animals cannot display bars before infection; conversion toggles eligibility on the same id. E18 budgets include bars and telegraphs.

### Shared special-move contract

- Every special emits a typed telegraph with source/move/attack id, locked target or area, start tick, active tick and cooldown expiry. **Telegraph ≥ 0.6 s (≥ 36 ticks at 60 Hz)**; no damage, knockdown, buff or view obstruction before activation. Direction/area marker and pose/audio caption agree; flash/blood settings do not hide the essential cue.
- Cooldowns below are independent per entity/move, measured **activation-to-next-activation**; fixed sim time, serialized across checkpoint/save/chunk unload. Pause freezes them; no same-tick duplicate activation or resetting by retargeting. A single entity performs only one special at once, with ≥ 0.6 s ordinary recovery after it (orchestrator default). Normal attacks can occur between specials.
- Once active, charges/pounces use the telegraphed direction/last-seen target, stop at intact solid walls, and never home through geometry; radial attacks respect the stated radius and wall occlusion. Each target is hit once per attack id, no per-frame stacking. Physical attacks may hit player/soldiers/civilians; existing protected child/corgi rules remain. Body throws use **corpses**, retained ids/poses, or medium E26 props (orchestrator default for "body"); never silently delete bodies.
- Noise/roar convergence supplies the **roar origin**, not the live location of an unseen player. Overlapping buffs do not stack; cooldown and state survive restore. Telegraph/active/recovery/expiry stages are testable via events/snapshots.

### Alpha moves (all four required)

| Move | Telegraph / cooldown | Effect (orchestrator default) | Required Scene Lab scene / test suffix |
| --- | --- | --- | --- |
| Charge | 0.8 s / 8 s | Straight 9 m/s sprint, ≤ 12 m length, 2 m-wide swept path; 30 damage + 1.2 s knockdown to each human hit once; **300 E26 barricade HP damage** per contacted slot (breaks the 300 HP fixture); stops at non-breakable wall. Ordinary contact still deals 100 barricade damage/hit. | `qa-alpha-charge.json` / `T-E07-06-charge` |
| Ground slam | 1.0 s / 10 s | 4 m radius, 25 damage and 1.2 s knockdown, targets at > 4 m or behind solid wall unaffected; visual ring matches radius within 0.25 m. | `qa-alpha-ground-slam.json` / `T-E07-06-ground-slam` |
| Grab and throw | 0.8 s / 12 s | Pick nearest corpse/medium E26 prop within 2 m; throw toward last-seen target at 12 m/s, range ≤ 15 m; first impact within 1 m collision radius deals 30 damage + 0.8 s knockdown once; no valid object means cancelled attempt with no phantom projectile. Reuse `PropThrows.ts` and corpse pose/impulse path. | `qa-alpha-grab-throw.json` / `T-E07-06-grab-throw` |
| Roar | 0.8 s / 15 s | Regular infected within 18 m converge on roar position and move at **1.25× speed for 5 s**; Alpha/zoo animals and regular infected beyond 18 m unaffected; restore base speed at expiry, no stacking, 0 direct damage. | `qa-alpha-roar.json` / `T-E07-06-roar` |

### Infected zoo animal roster and moves (L8)

Reuse shipped `infected.lion`/`inf.lion`, `infected.gorilla`/`inf.gorilla`, `infected.flamingo`/`inf.flamingo`. Add `infected.elephant`/`inf.elephant` and `infected.zebra`/`inf.zebra` **derived from `amb.elephant`/`amb.zebra`**, sharing shape/rig and healthy→infected continuity. Those normal bases are **manifest placeholders, with no production model directories yet**; build the normal base once, then derive infected variants, not an unrelated model. Existing cat/pet code remains a reuse reference; cats are not substituted for the five required zoo species.

Orchestrator default new definitions: elephant base HP 800 → 1,200 effective with current 1.5 toughness, speed 3.5 m/s, radius 1.2 m; zebra base HP 120 → 180 effective, speed 6 m/s, radius 0.45 m. Shared bars use these actual effective values. Existing lion/gorilla/flamingo HP stays data-driven. All five species can start healthy and turn through the E30 infection path.

| Species / move | Telegraph / cooldown | Effect (orchestrator default) | Required Scene Lab scene / test suffix |
| --- | --- | --- | --- |
| Lion — pounce and pin | 0.6 s / 8 s | Leap ≤ 8 m at 10 m/s toward locked last-seen target, 30 impact damage, **1.5 s pin**; existing mash/attack rescue releases pin, cannot hit through walls. | `qa-zoo-lion-pounce.json` / `T-E07-19-lion-pounce` |
| Lion — flanking sprint | 0.6 s / 10 s | 10 m/s for ≤ 2 s toward visible target's side (60–90° approach offset), respects nav/walls; 0 direct damage/knockdown, expires to base speed; follow-up pounce uses its own cooldown/telegraph. | `qa-zoo-lion-flank.json` / `T-E07-19-lion-flank` |
| Gorilla — chest-beat roar | 1.0 s / 15 s | Regular infected within 20 m converge on roar origin for 5 s, no live-player revelation or speed stacking; 0 direct damage/knockdown. | `qa-zoo-gorilla-roar.json` / `T-E07-19-gorilla-roar` |
| Gorilla — ground pound | 1.0 s / 12 s | 5 m radius, 30 damage + **1.2 s knockdown**, beyond-radius/occluded humans unaffected; marker radius within 0.25 m. | `qa-zoo-gorilla-pound.json` / `T-E07-19-gorilla-pound` |
| Gorilla — grab and throw | 0.8 s / 10 s | Nearest corpse/medium E26 prop within 3 m, thrown 12 m/s toward last-seen target ≤ 15 m; impact radius 1 m, 30 damage + 0.8 s knockdown once; retain existing ×6 ordinary barricade damage. | `qa-zoo-gorilla-throw.json` / `T-E07-19-gorilla-throw` |
| Elephant — stampede charge | 0.9 s / 14 s | Straight 8 m/s, ≤ 16 m long, 3.5 m-wide sweep; humans 40 damage + **1.5 s knockdown**; E26 slots 400 HP damage; light E09 vehicle (mass ≤ 2,000 kg) takes 80 HP damage + ≥ 3 m/s lateral impulse, displacement ≥ 1 m in fixture, no teleport. Shared L8 armored APC is heavier. | `qa-zoo-elephant-charge.json` / `T-E07-19-elephant-charge` |
| Elephant — trunk swipe | 0.7 s / 7 s | Forward 120° arc, 3 m radius; 25 damage, ≥ 3 m knockback and 0.8 s knockdown once; targets outside arc/radius/wall unaffected. | `qa-zoo-elephant-swipe.json` / `T-E07-19-elephant-swipe` |
| Zebra — rear kick | 0.6 s / 6 s | Rear 90° arc, 2 m radius; 20 damage and ≥ 3 m knockback + 0.6 s stagger, front targets unaffected. | `qa-zoo-zebra-kick.json` / `T-E07-19-zebra-kick` |
| Zebra — herd stampede | 0.8 s / 12 s | 2–4 infected zebras within 12 m align a telegraphed corridor; each runs 10 m/s ≤ 15 m, 1.5 m-wide sweep; humans take 25 damage + 1 s knockdown per distinct zebra/attack id, no repeat overlap hit, no summoning extra animals. | `qa-zoo-zebra-stampede.json` / `T-E07-19-zebra-stampede` |
| Flamingo — flock dive | 0.6 s / 8 s | Existing flamingos (3–8 in fixture) dive into marked 3 m area; 5 damage + **0.6 s stagger**, once per target per flock attack; feather/wing view obstruction lasts **≤ 0.8 s**, opacity ≤ 0.35, player silhouette/health HUD remain visible and reduced-flash setting respected. | `qa-zoo-flamingo-dive.json` / `T-E07-19-flamingo-dive` |

Scene paths are proposed under `specs/scenes/`, created during implementation. **One scene per move**, not one generic animal scene: fixed seed, healthy/damaged/in-range/out-of-range bar probes, pre-telegraph/start/activation/impact/expiry captures, targets just inside/outside radius or sweep, solid-wall control, two consecutive activations proving cooldown, checkpoint restore during cooldown. Reuse existing Scene Lab entity/prop/vehicle fixtures and extend schema only where a move is not currently controllable. No scene is claimed to exist yet.

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E07-AC01 | **CHANGED 2026-10-11:** 13 human definitions (original 12 + `infected.alpha`/`inf.alpha`) and 8 animal definitions (existing 6 + elephant/zebra) validate/spawn in `horde-arena`; new zoo models derive from normal bases; Alpha campaign counts match the table on both tiers. | unit/sim |
| E07-AC02 | Perception: an idle runner detects the player inside a 110° / 14 m cone within 0.3 s and not outside it (no noise); a gunshot within 25 m alerts it regardless of facing | sim |
| E07-AC03 | Chase: in `maze` (a corridor maze), a runner reaches a stationary god-mode player 40 m away by path within 15 s; the path never crosses static colliders | sim |
| E07-AC04 | Separation: 100 runners chasing a player keep a pairwise overlap (distance < 0.5 × sum of radii) under 2% of pairs per tick on average | sim |
| E07-AC05 | **CHANGED 2026-10-11:** retain ≥ 0.35 s telegraphs for original attacks (Brute ≥ 0.8 s); every Alpha/zoo special has ≥ 0.6 s telegraph with source/move/attack id and target/area, no effect before activation, exact listed cooldowns/recovery in sim ticks, stable across pause/restore; all 14 per-move scenes capture boundary/cooldown probes. | sim + visual |
| E07-AC06 | **CHANGED 2026-10-11:** retain original human specials. Alpha resistance fixture matches 300 HP: handgun 30 hits, army-MG 43 rounds, close shotgun 3 shells (≤ 1.1 s), center rocket 2 blasts. Ordinary melee knocks soldiers down 1.2 s; **all four Alpha move rows** meet telegraph, cooldown, radius/sweep, damage, knockdown/buff/expiry and wall controls, with one named Scene Lab scene/test suffix per move. Its world-space HP bar meets shared 15 m/damaged visibility, fill and phone-size/contrast contract. | sim + e2e + visual |
| E07-AC07 | Spawn rules: no spawn within 18 m of the player or inside the camera frustum (expanded by 10%); spawns never inside colliders | sim |
| E07-AC08 | Caps: the `SpawnDirector` never exceeds the tier's concurrency cap; when capped, it queues rather than drops scripted spawns | sim |
| E07-AC09 | Migration: a 150-infected migration follows its spline to the target within ±20% of the expected time and fans out on arrival | sim |
| E07-AC10 | Pooling: a 5-minute sim with 150 infected cycling (spawn/kill) allocates no new entity objects after warm-up (pool counters stable) | sim |
| E07-AC11 | Performance (sim): 200 active infected chasing in `horde-arena` give `simMsP95` ≤ 4 ms in Node on the CI reference machine | perf |
| E07-AC12 | Render: 200 infected cost ≤ 30 draw calls for crowd meshes; the frame is rendered without per-infected `Object3D`s in the scene graph (instanced) | perf/e2e |
| E07-AC13 | Readability: in the `horde-readability` photo spot (60 runners on the golden-hour street), the vision checklist §7.1 Checklist D passes (infected separable from the background, glowing eyes visible, player clearly identifiable) | vision |
| E07-AC14 | **CHANGED 2026-10-11 — Permanence with updated shotgun exception:** corpses retain original ids for the whole level; settled brains return to the pool and baked death poses use static instancing, no age/population removal. Explosives/lethal burn kill permanently; normal infected killed by the updated campaign shotgun also remain corpses per E23 §5.2b/newer PO. Other melee/firearm/vehicle HP depletion keeps the existing 10–20 s recoverable downing. Thrown corpses retain id/pose and settle at their actual new location. | sim |
| E07-AC15 | Leg loss: a runner whose leg is destroyed (dismemberment, Full gore) or that takes leg-targeted explosive damage becomes a crawler-state infected (speed 2.0) instead of dying when its HP > 0; with gore Reduced or Off the same rule applies with no visual detachment (gameplay identical) | sim |
| E07-AC16 | Dog packs: a pack of 4 dogs approaches from ≥ 2 directions (the angular spread of approach vectors ≥ 90°) and pounces (knockdown 0.6 s, telegraph crouch ≥ 0.4 s) | sim |
| E07-AC17 | Cats: a perched cat is not detectable (excluded from minimap and aim assist) until the player is within 5 m; its leap + cling slows the player 50% for 2 s unless broken by an attack or by moving 3 m | sim |
| E07-AC18 | Crow flock: the flock circles (telegraph caw), then dives in waves; a shotgun blast or explosion inside the flock kills birds individually and scatters the rest for ≥ 5 s; 20 birds count as 5 toward the cap | sim |
| E07-AC19 | **CHANGED 2026-10-11:** all five zoo species and **all ten zoo move rows** meet telegraph ≥ 0.6 s, cooldown, range/radius/arc, damage/knockdown/pin/stagger, wall controls and expiry; each has its named Scene Lab scene/test suffix. Every infected zoo animal shares the Alpha health-bar contract; normal animals show no bar. Retain gorilla ×6 ordinary barricade damage. Alpha ordinary hits break 300 HP E26 slot on hit 3 (100/hit), charge breaks it by 300 HP damage, collision/nav clears within one tick with source/HP/debris logs. | sim + e2e + visual |

## Implementation plan (2026-10-11)

All lanes ≤ 3 h, in order; existing 12 human archetypes, animal behaviors and crowd systems stay.

| Lane | Budget | Concrete change and reuse |
| --- | --- | --- |
| A-S1 systems | 3 h | Extend `src/data/infected.ts`, `src/sim/ai/InfectedSystem.ts` and `src/sim/combat/Damage.ts`: Alpha definition, resistance table with toughness applied once, ordinary melee soldier knockdown and shared special scheduler/cooldown snapshots; reuse `src/sim/outbreak/Allies.ts`. |
| A-S2 systems | 3 h | Alpha Charge/Ground slam plus E26 damage/knockdown; wire E26 `Barricades.ts` / `PropSystem.ts` damage and navigation updates; reuse existing events, no independent destruction system. |
| A-S3 systems | 3 h | Alpha Grab and throw/Roar; reuse `src/sim/ai/PropThrows.ts`, corpse poses, noise/perception and steering buffs. |
| A-S4 health-bar view | 3 h | New shared pooled world-space bar view using render billboard/instancing patterns and `GameUI.ts` fill math; 15 m/damage/occlusion and phone readability probes. |
| A-D1 asset + district fixtures | 3 h | Derive `inf.alpha` from `assets/inf.common-worker/build.py`; reuse crowd baking/`crowdLodGeometry.ts`, target inventory §7 LOD budgets, line fixture on existing D-FAIR anchors. |
| A-E1 encounters | 2 h | Seed count fixtures for L4/L5/L7/L8; reuse director, emergence and perception; concentration fixture in E22. |
| A-Q1 Scene Lab + browser e2e | 3 h | Proposed `qa-alpha-resistance.json`, `qa-alpha-line-break.json` plus `qa-alpha-{charge,ground-slam,grab-throw,roar}.json`, turntable/crowd/bar photos and headless AI/combat wiring checks under existing `T-E07-01/06/19` tags; benchmark within E18. |

Epic report rationale: AC01/05/06/14/19 extend the archetype roster and physical line-breaking behavior per the new PO source. Existing test tags require expanded assertions; their current passing status does not verify Alpha.

### Zoo extension lanes (execute systems → assets/district → encounters → scenes/e2e)

| Lane | Budget | Concrete change and reuse |
| --- | --- | --- |
| Z-S1 systems | 3 h | Lion pounce/flank and gorilla chest-beat/pound; reuse pin/rescue, charge/nav, roar/noise and Alpha radial resolver. |
| Z-S2 systems | 3 h | Gorilla corpse/prop throw; elephant charge/swipe, E26 barricade damage and E09 light-vehicle impulse using existing physics. |
| Z-S3 systems | 3 h | Zebra rear kick/herd stampede, flamingo flock dive/brief obstruction; reuse flock/steering/stagger, pool VFX, enforce cooldown/recovery. |
| Z-D1 elephant asset | 3 h | Build missing `amb.elephant` normal base once, derive `inf.elephant` with shared rig and inventory LOD budgets; reuse animal pipeline. |
| Z-D2 zebra asset | 3 h | Build missing `amb.zebra` normal base once, derive `inf.zebra` with shared rig/LODs; reuse animal pipeline and D-ZOO anchors. |
| Z-E1 encounters | 2 h | All-five-species infection/cooldown/bar fixture using E30 normal→infected identity and existing local target queries. |
| Z-Q1 Scene Lab | 3 h | Ten named per-move `qa-zoo-*.json` scenes (split into further ≤ 3 h lanes if authoring exceeds this budget) with exact activation/expiry/cooldown frames and radius/wall controls. |
| Z-Q2 browser e2e | 3 h | Headless desktop/phone bar/telegraph tests plus all move suffixes under `@E07-AC19`, no normal-animal bars, E18 mixed-species counters. |
