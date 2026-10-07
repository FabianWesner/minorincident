# E07 · Infected AI, Archetypes and Hordes

## Goal
Fast, aggressive infected that read clearly and scale to hundreds. This covers the archetype behaviors (concept §7), perception, steering-based crowd movement over a navigation grid, spawning with budgets and pooling, migrations, and the GPU crowd rendering path.

## Depends on / Enables
E04, E05 / E08, E19–E24, E18.

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
- **Civilian → infected turning** (hook used by E08): the grab behavior (an infected adjacent to an adult civilian may grab them with an archetype-specific chance) and spawning the risen infected from the civilian's variant mapping, within the concurrency cap.

**Out:** civilians themselves (E08).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`InstancedGroup.js`](../folio-2025/sources/Game/InstancedGroup.js): crowd instancing base (extended with the GPU part-transform texture)
- [`Zones.js`](../folio-2025/sources/Game/Zones.js): aggro and trigger volumes

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E07-AC01 | All 12 archetypes exist as data, validate, and spawn in the `horde-arena` scenario | unit/sim |
| E07-AC02 | Perception: an idle runner detects the player inside a 110° / 14 m cone within 0.3 s and not outside it (no noise); a gunshot within 25 m alerts it regardless of facing | sim |
| E07-AC03 | Chase: in `maze` (a corridor maze), a runner reaches a stationary god-mode player 40 m away by path within 15 s; the path never crosses static colliders | sim |
| E07-AC04 | Separation: 100 runners chasing a player keep a pairwise overlap (distance < 0.5 × sum of radii) under 2% of pairs per tick on average | sim |
| E07-AC05 | Telegraph: every damaging infected attack is preceded by a `telegraph` event ≥ 0.35 s earlier (Brute charge ≥ 0.8 s) | sim |
| E07-AC06 | Archetype specials: Screamer alerts all infected within 20 m; Bloated explosion damages infected and the player in 3 m; Riot blocks frontal bullets; Nurse revives one downed runner once; Brute charge knocks the player back ≥ 3 m; Crawler grab slows the player 50% until broken (3 hits or 1.5 s) | sim |
| E07-AC07 | Spawn rules: no spawn within 18 m of the player or inside the camera frustum (expanded by 10%); spawns never inside colliders | sim |
| E07-AC08 | Caps: the `SpawnDirector` never exceeds the tier's concurrency cap; when capped, it queues rather than drops scripted spawns | sim |
| E07-AC09 | Migration: a 150-infected migration follows its spline to the target within ±20% of the expected time and fans out on arrival | sim |
| E07-AC10 | Pooling: a 5-minute sim with 150 infected cycling (spawn/kill) allocates no new entity objects after warm-up (pool counters stable) | sim |
| E07-AC11 | Performance (sim): 200 active infected chasing in `horde-arena` give `simMsP95` ≤ 4 ms in Node on the CI reference machine | perf |
| E07-AC12 | Render: 200 infected cost ≤ 30 draw calls for crowd meshes; the frame is rendered without per-infected `Object3D`s in the scene graph (instanced) | perf/e2e |
| E07-AC13 | Readability: in the `horde-readability` photo spot (60 runners on the golden-hour street), the vision checklist §7.1 Checklist D passes (infected separable from the background, glowing eyes visible, player clearly identifiable) | vision |
| E07-AC14 | Corpses persist for the whole level with their original IDs. After the death animation settles, their brains return to the warm pool and their baked death poses use cheap static instancing; no age or population cap removes bodies (PO object-permanence correction, 2026-10-07) | sim |
| E07-AC15 | Leg loss: a runner whose leg is destroyed (dismemberment, Full gore) or that takes leg-targeted explosive damage becomes a crawler-state infected (speed 2.0) instead of dying when its HP > 0; with gore Reduced or Off the same rule applies with no visual detachment (gameplay identical) | sim |
| E07-AC16 | Dog packs: a pack of 4 dogs approaches from ≥ 2 directions (the angular spread of approach vectors ≥ 90°) and pounces (knockdown 0.6 s, telegraph crouch ≥ 0.4 s) | sim |
| E07-AC17 | Cats: a perched cat is not detectable (excluded from minimap and aim assist) until the player is within 5 m; its leap + cling slows the player 50% for 2 s unless broken by an attack or by moving 3 m | sim |
| E07-AC18 | Crow flock: the flock circles (telegraph caw), then dives in waves; a shotgun blast or explosion inside the flock kills birds individually and scatters the rest for ≥ 5 s; 20 birds count as 5 toward the cap | sim |
| E07-AC19 | Zoo elites: the gorilla picks up and throws the nearest medium prop (E26) at the player (projectile with momentum damage) and deals ×6 barricade damage; the lion pounce pins the player for 1.5 s unless they mash an attack (2 hits) | sim |
