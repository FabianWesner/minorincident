# E09 · Vehicles

## Goal
Enterable, arcade-simple cars that feel like a **temporary power-up**: fast traversal, escaping hordes, running over infected, crashing through light obstacles, and taking damage until destroyed. Adapted from Bruno's `PhysicsVehicle` and `VisualVehicle` (`docs/bruno-reference/movement-and-physics.md`), retuned per vehicle.

## Depends on / Enables
E04, E05, E10 / E21–E24.

## Scope
**In:**
- Rapier raycast vehicle controller per `VehicleDef` (mass, wheelbase, engine force, top speed, steering, suspension, HP, ramStrength).
- Enter and exit via stand-to-interact (0.6 s) at the driver door; exit auto-places the player on a free side.
- Controls per scheme: mouse-only hold LMB to steer toward cursor with throttle by distance, release to brake; keyboard WASD; touch stick (release to brake); middle-click / F / E / ACTION = exit; keyboard/touch LEFT = horn/boost.
- Run-over damage (speed-based); infected grabbing at under 3 m/s with a shake-off.
- Light obstacle smashing (break into debris physics bodies, pooled); heavy obstacles stop the car.
- Vehicle damage states (smoke < 40%, fire < 15%, explode at 0 after 3 s, kicking the player out).
- Camera zooms out by 15% while driving.
- Vehicle defs: sedan, pickup, SUV, police cruiser (siren lure), ambulance, school bus (heavy), fire engine (L6, ram-strong, ladder).
- Fixed-step integration (no Bruno variable timestep, see the reference caveat).

**Out:** the convoy AI (E08 owns it; it reuses the kinematic path following).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Physics/PhysicsVehicle.js`](../folio-2025/sources/Game/Physics/PhysicsVehicle.js): raycast vehicle, engine/brake/boost, stuck and flip recovery (port)
- [`World/VisualVehicle.js`](../folio-2025/sources/Game/World/VisualVehicle.js): wheels, brake lights, blinkers, antenna, boost trails, tracks (port)
- [`Player.js`](../folio-2025/sources/Game/Player.js): driver input layer
- [`Trails.js`](../folio-2025/sources/Game/Trails.js): boost and drift trails
- [`Tracks.js`](../folio-2025/sources/Game/Tracks.js): tire tracks
- [`View.js`](../folio-2025/sources/Game/View.js): speed-responsive zoom, speed lines
- [`Time.js`](../folio-2025/sources/Game/Time.js): bullet time on big hits
- [`docs/bruno-reference/movement-and-physics.md`](../docs/bruno-reference/movement-and-physics.md): tuning table + timing caveat

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E09-AC01 | Each vehicle def validates; the asset (placeholder or final) has all required nodes (`body, wheelFL/FR/RL/RR, lights…`) | unit |
| E09-AC02 | Enter: standing in the door ring for 0.6 s → `vehicle.entered`; the player entity becomes hidden and the input routes to the vehicle; exit places the player within 2.5 m on a free, non-colliding spot | sim |
| E09-AC03 | Handling: the sedan reaches 90% of top speed (16 m/s) within 4 s; a full-lock turn at 10 m/s has a radius of 8–14 m; the car never flips on flat ground with a scripted slalom (roll < 60°) | sim |
| E09-AC04 | Run-over: a runner hit at ≥ 4 m/s dies (`combat.kill`, cause `vehicle`); a brute is knocked back and the car loses HP per its `ramDamage` | sim |
| E09-AC05 | Light obstacles (fence segment, cone, barricade, trash can, mailbox) break on impact ≥ 5 m/s and slow the car by ≤ 25%; heavy obstacles (jersey barrier, wall, truck) stop the car and deal crash damage | sim |
| E09-AC06 | Damage states: HP < 40% emits `vehicle.smoking`; < 15% `vehicle.burning`; 0 → exploding after 3 s, which ejects the player and deals splash | sim |
| E09-AC07 | Grab: at speed < 3 m/s infected within 1.5 m attach (max 4); accelerating above 8 m/s or hard steering shakes them off | sim |
| E09-AC08 | Mouse-only driving: holding LMB with the cursor 10 m ahead-left turns and accelerates; releasing LMB brakes to a stop even with the cursor far away; middle-click / F / ACTION exits | e2e |
| E09-AC09 | Bot drive test: the vehicle bot drives a 600 m course in `drive-course` through traffic cones within 90 s without getting stuck (stuck detection: < 0.5 m travel in 3 s → reverse recovery) | sim |
| E09-AC10 | Visuals: wheels rotate with speed, front wheels steer, brake lights light when braking, sirens flash on emergency vehicles (screenshot pair, light pixels differ) | visual |
| E09-AC11 | Determinism: a 30 s scripted drive gives the same final transform (±1e-4 m) across 3 runs in Node | sim |
