# E11 world interactions

`SimWorld` owns `Interactables`, `Hazards`, and `Pickups` for survivor scenarios. Each service uses the existing entity store, spatial hash, ordered event bus, and fixed 60 Hz tick. Scenario unload clears entities, timers, colliders, listeners, inventory and the debris pool. Player respawn preserves collected objective items and device state.

Author scenarios with the optional `devices`, `hazards`, and `pickups` arrays in `ScenarioDefinition`. District compositions use `overrides.interactions` with the same arrays, in district-local X/Z metres. E10's existing `interactables` anchor list remains a placement reference; authored E11 objects are separate from immutable Blender geometry. Do not place a removable object inside an immutable wall collider.

- Devices: door, gate, generator, breaker, switch, lever, valve, button, radio, rescue and car-door. Options specify radius, holdTime (seconds), instant, interruptOnDamage, key, required items, fuel (seconds), label and collider half-extents. Stand inside the nearest eligible ring to fill; exit decays at twice the fill rate. Damage floors progress to the last 25% notch. Each completion emits `interact.completed` with ID, kind and cycle. Doors re-arm after leaving their ring, and update both the removable Rapier collider and nav occupancy synchronously. `world.blocker.changed` carries ID, blocked flag and wall extents so the E07 path grid can update in the same tick. `barricade` and `refuel` are E26/mission integration hooks.
- Explosives: propane/barrel arm at zero HP and detonate after 18 ticks, with a default 5 m radius, 100 centre damage and linear falloff. Damage to the player is 30%. Chains share a rolling eight-blast-per-second cap. `hazard.armed` and `hazard.exploded` are presentation hooks for E27.
- Alarm: a successful hit emits `noise` with radius 20 m and duration 10 s. Infected inside the active range receive `noiseTarget: {id, until}`; existing reactive hearing components also receive the car position and expiry, so they walk toward it. E07 brains must prioritize this target until expiry, then resume normal pursuit.
- Gas cans leak a four-segment flammable trail on the first bullet hit. Shot fuse boxes electrify nearby water/metal fences for 300 ticks. Fire, toxic spills and live wires apply damage once per sim second. E06 action fire zones also supply heat to flammable props without duplicating their actor damage. Wood ignites after 120 exposure ticks and burns out at its authored burnTime. Firefighter/hazmat archetypes are immune to their corresponding zone.
- Fence, crate, barricade, cone, trash-can, mailbox and glass have HP and emit `prop.broken`. Each break requests at most eight deterministic Rapier pieces from a 32-slot pool; they deactivate after 480 ticks and are reused. E26 owns movable full props; E27 owns detailed blast/smoke visuals.
- Pickups: medkit +50% max HP, soda +15%, energy drink ×1.25 movement speed for 480 ticks, throwable +1 charge per eligible slot capped at the authored maximum, weapon through E06’s pickup service (including full-rack replacement and safely armed drops), or an objective item into unique inventory. Full health/charge pickups remain available. Successful collection emits `pickup.collected` exactly once. Consumables/items carry ID, kind and item; weapons retain E06’s pickupId, actionId, side and replaced payload.

The test API's additive E11 surface is version 1.5: `spawn('device.<kind>'|'hazard.<kind>'|'prop.<kind>'|'pickup.<kind>', position, options)`, `interact.giveItem/refuel/barricade/hit`, and `camera.preset('interact-ui')`. `getEntity` exposes the plain components; `getState().interactions` exposes the active ID, chain-budget timers and physics debris. `screenshotReady()` waits for dynamic registry loads. `ActionView` owns weapon pickup models; `InteractionView` owns environmental/consumable registry resources and the prompt; ring meshes bypass depth testing and the DOM panel has fixed, tier-independent contrast.

Acceptance tests live in `tests/sim/interact`, `tests/e2e/interact.spec.ts` and `tests/visual/interact.spec.ts`. Performance and screenshot evidence is written under `test-results/epics/E11/`.

## E26 core (staged)

`tools/assets/physics-metadata.ts` extracts `ss_physics` from production GLBs during
`layouts:build`, committing the same `physicsAssets.ts` for Node and browser.
Movable environment props use authored mass, collision bounds, friction,
restitution, center of mass, class, push permission and break/barricade HP.
They spawn sleeping. The production awake upper bound remains 12. The dedicated
`barricade-stress` fixture overrides it to 60 for headroom measurement only.
Medium pushing uses 55% speed; `PropSystem.shoulderPush` is the upgrade seam for
heavy pushing at 25% speed (campaign upgrade-card integration is a later increment).

Author local rails in `DistrictGameplay.barricades` (also supported by composition
overrides), with stable `id`, `groupId`, endpoints `a`/`b`, required `height`,
optional `depth`, `boardUp`, `inward`, and `initialHp`. Campaign defaults resolve
L2/L4/L5 building anchors in `levels/barricadeSlots.ts`; level content can add more
rails. Axis-aligned rails are recommended because collision/nav use conservative
AABBs. Overlapping projected prop intervals count once, weighted by the authored
`barricadeValue`. At >=80% coverage, standing still braces in 1.5 s (E/middle-click
is instant). Board-up and repair each require 2 s standing still; boards have 200
HP and repair restores 25% of maximum HP. There is no material inventory cost in
spec 07. Braced props become kinematic, then fly inward on break. HP and membership
live on entities; checkpoint and tier rebuilds reconcile colliders and nav.

Mission API: `world.barricades.barricadeIntact(slotId)` and
`allBarricaded(groupId)` return false for unknown/empty IDs. Events
`barricade.built`, `barricade.broken`, `barricade.repaired` include `id`, `slotId`,
`groupId`, and `tick`. Existing `barricade.sound` cues and `vfx.effect` hooks provide
presentation feedback. Infected use their authored windup/damage plus 1 s cooldown;
Brute damage is 5x and Butcher damage 8x. Short detours are preferred to attacks.

Test API adds `barricades.intact/all/slots` and `perf().awakeProps/propUploads`.
Fixtures: `prop-yard` (300 sleeping props), `barricade-lab` (brace and board-up),
`barricade-stress` (60 awake bodies and 30 attacking runners). Fixture props are
instanced code boxes; campaign props retain their production GLB batches.
