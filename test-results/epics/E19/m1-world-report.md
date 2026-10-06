# M1 world movement and collision lane

Scope: M1-04 steering jitter, M1-06 civilian movement/idle/model variety, M1-07 solid dressing and shared navigation, M1-08 visible ground access; M1-10 body separation only. Animation clips, mission scripting, camera/input bindings and world art remain with their respective lanes. No spec changes.

## Changes

- Bake compound boxes from connected delivered GLB geometry intersecting character body height. Preserve low paving as walkable supports; omit canopy roofs and retain individual pillars/pumps. Transform every component by the district placement at runtime. Existing world assets plus delivered prop/vehicle dressing are covered, including hydrants and buses. `npm run assets:collision` refreshes the table; asset packing does so automatically. A hash regression rejects stale collision data after GLB edits.
- Replace invisible ground edges with visible perimeter rails/posts matching the collider footprint. Shared district seams stay open. `?debug` displays Rapier geometry over the scene in production builds.
- Share budgeted heap A* and visibility-based string pulling between ground clicks and NPC/companion routes; infected navigation consumes the same solid geometry. Spatial collider/support indexing keeps the larger compounds inexpensive. Low supports do not block navigation; a bounded capsule upward sweep permits gentle joystick entry over thin paving edges where Rapier autostep alone snagged.
- Civilians follow safe sidewalk routines derived from district road points and lane width, pause naturally, and turn gradually. Five model variants and role tints are batched at both LODs. Actual collision-resolved displacement determines moving/idle and stride phase, fixing walk-in-place and stationary vertical bobbing.
- Corgi follow targets no longer flip between a velocity offset and a fixed world-axis offset on stops. A follow band, arrival radius, smoothed speed/yaw and an anchored resting state eliminate follow chatter and ambient NPC nudges. `entity.motion` exposes velocity, speed, moving and traveled distance to the animation lane.
- Resolve survivor, companion, civilian and infected body circles after physics. AI yields to the authoritative survivor and static geometry remains respected, including stationary attack states.

## Regression adjustments

The old smoke control test clicked two metres along +X from the porch into a now-solid garden fence. Its destination now uses the open sidewalk along +Z; the same arrival precision, marker, idle and stationary attack assertions remain. The civilian turning test still checks the exact birth position in the turning event, then checks the newborn variant after cleanup: body separation may move it in that same tick.

## Validation

All required gates pass at source commit `6f22350`:

- `npm run typecheck`, `npm run lint` and production build: exit 0.
- `npm run test:unit`: 138 tests / 53 files passed.
- `E2E_PORT=3323 npm run test:smoke`: 3 simulation + 22 browser checks passed.
- `E2E_PORT=3323 npm run verify -- E19`: 25 simulation + 32 browser checks passed, including desktop/portrait/landscape full-slice playthroughs, native GPU checks, weapon pickup and death/resume. Every recorded verification command exits 0.
- Additional NPC campaign/civilian regression run: 32 checks passed, including high/low density and immunity across L1–L6.
- New real-input checks use desktop mouse at 1600x900 and CDP touch joystick at 390x844; no survivor teleport or injected logical input. Both hedge/forecourt/companion checks pass. Companion settles about two metres away with moving=false and speed below 2e-12 m/s.
- Visually inspected morning sidewalk, hedge, forecourt, settled companion and production `?debug` captures at the game camera. The forecourt is accessible under the canopy and both survivor/dog stand on the paving; solids remain separate. Five civilian models and tint variation are present. Stationary NPCs use idle without root bob; the dog has a calm grounded idle. Reviewed captures were deleted.
- Local Node benchmark: 1,173 Rapier colliders, 128 ms district load, 396 ms for 1,800 idle ticks and 154 ms for 600 movement ticks. This is a simulation benchmark, not a browser FPS claim.

Evidence: `m1-world-verification.json`, `m1-world-input.json`, `checks.json`, `vitest.json`, and the E19 device performance JSONs. Compounds approximate connected solid geometry with boxes; current L1 placements use cardinal rotations. Animation clips/trot, hair, world styling and outbreak scripting remain owned by the other lanes.

## Integration

Main was merged only once before work began. The look lane may move placements without collider edits; rebake when delivered GLBs change. Preserve the model-selection and actual-motion plumbing when integrating animation clip changes. NPC presentation roots use transform.y minus their human/pet baseline so they stand on paving supports. This lane does not deploy; the orchestrator integrates.
