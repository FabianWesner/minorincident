# E26 · Physics Props and Barricades

## Goal
A town full of **movable objects** (Bruno-style sleeping, instanced Rapier bodies) that the player can nudge, push, and kick, that cars bulldoze, and that explosions launch. Props become **gameplay**: projectiles, obstacles, and **barricades** braced into slots that infected must path around, vault, or tear down. Concept: [07-physics-props-explosions-smoke.md](07-physics-props-explosions-smoke.md) §1–4, §7–8.

## Depends on / Enables
E04, E05, E07, E09, E10, E11 / E19 (kick and cone tutorial), E20 (board-up, gym), E23 (prep phases), E24 (final stand).

## Scope
**In:** the `PropSystem` (dynamic bodies from GLB `ss_physics` extras + collider empties; sleeping by default; instanced visual sync for awake bodies only; reset when fallen below the ground; the awake budget with freezing); light, medium, heavy, and fixed classes; player nudge and push (speed penalties), the kick action as a prop launcher, momentum damage; vehicle push and launch; crowd shoving; dynamic nav obstacles (footprints of resting medium and heavy props update the nav grid at 2 Hz); **barricade slots** (TS data), coverage computation, brace interaction, the barricade entity (HP, nav block, visual bracing overlay, damage states, break → props become dynamic again and fly inward), board-up points, car barricades, sandbag walls (vaultable cover), vaulting, repair; the `prop-yard` and `barricade-lab` scenarios.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): PropSystem: sleeping, userData friction/restitution, awake-only sync, fallen reset (port)
- [`Physics/Physics.js`](../folio-2025/sources/Game/Physics/Physics.js): body/collider descriptions, contact events
- [`World/Bricks.js`](../folio-2025/sources/Game/World/Bricks.js): instanced dynamic prop template
- [`World/Benches.js`](../folio-2025/sources/Game/World/Benches.js): bench template
- [`World/Fences.js`](../folio-2025/sources/Game/World/Fences.js): fence template
- [`World/Lanterns.js`](../folio-2025/sources/Game/World/Lanterns.js): lantern template
- [`Explosions.js`](../folio-2025/sources/Game/Explosions.js): radial impulse with upward bias
- [`InstancedGroup.js`](../folio-2025/sources/Game/InstancedGroup.js): instanced visuals
- [`World/Floor.js`](../folio-2025/sources/Game/World/Floor.js): kill floor

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E26-AC01 | Every movable asset's `ss_physics` validates (class mass bands, collider AABB within 15% of the visual, center of mass inside, explosive refs exist) | static |
| E26-AC02 | Sleeping: in `prop-yard` (300 props) with no interaction, 0 bodies are awake after 1 s, and the instanced matrix upload count is 0 per frame | sim/perf |
| E26-AC03 | Push: walking into a medium prop (35 kg cart) moves it along the push direction while the player moves at 55% ±5% speed; a heavy prop doesn't move without the upgrade | sim |
| E26-AC04 | Kick: kicking a cone along the aim launches it at 6 m/s ±0.5; a launched cone hitting a runner at > 4 m/s deals momentum damage and knocks it down (`combat.hit` cause `prop`) | sim |
| E26-AC05 | Explosion impulse (Bruno model): props within the radius get an impulse with an upward component and linear distance falloff, applied 1 tick after the explosion; props outside the radius are unaffected | sim |
| E26-AC06 | Awake budget: an explosion in `prop-yard` waking 250 props never exceeds 150 awake (high) / 60 (low); the frozen props are the farthest off-screen ones | sim |
| E26-AC07 | Reset: a prop pushed below y = −5 (out of the world) is reset to its spawn transform or removed per its flag, within 1 s | sim |
| E26-AC08 | Dynamic nav: a dumpster pushed across an alley blocks the nav grid within 0.5 s; runners path around it if the detour is ≤ 1.5×, otherwise they attack it | sim |
| E26-AC09 | Barricade bracing: filling a slot to ≥ 80% coverage enables "Brace"; bracing for 1.5 s creates a barricade entity with HP = Σ prop HP, kinematic props, and a blocked nav; < 80% coverage cannot be braced | sim |
| E26-AC10 | Barricade under attack: 10 runners reduce a 400 HP barricade at the defined DPS (±5%), a Brute does 5×; at 0 HP the props become dynamic again with an inward impulse and the nav reopens within 1 tick | sim |
| E26-AC11 | Vaulting: runners vault a sandbag wall (< 0.9 m) in 1.2 s; crawlers and heavies cannot; the player behind the sandbag wall takes no bullet or projectile damage from the front (cover) | sim |
| E26-AC12 | Board-up point: 2 s of stand-to-interact next to a plank stack boards a window (barricade 200 HP) without moving props; repair restores 25% per 2 s | sim |
| E26-AC13 | Car barricade: a car parked across a slot and braced gives 100% coverage and HP = 2× the car HP | sim |
| E26-AC14 | The `complete` bot uses barricades: in the `barricade-lab` defense scenario the bot fills and braces ≥ 2 slots during prep and survives the wave with fewer infected reaching the core than without barricades (A/B over 10 seeds, a ≥ 40% reduction) | sim |
| E26-AC15 | Determinism: a 60 s scripted push/kick/explosion sequence in `prop-yard` gives an identical state hash in Node and in the browser | sim/e2e |
| E26-AC16 | Visual: the slot ghost outline, the coverage meter, the brace overlay (planks/straps), and the damage states (cracks, shake) render and are readable at W0 and W5 (screenshot set `barricade-ui`); a barricade-break sequence screenshot shows the props in flight | visual/vision |
