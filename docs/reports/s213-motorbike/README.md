# s213 motorbike with sidecar

## Progress

Implemented a distinct L10 motorbike ride state on the established bicycle interaction and capsule contact path. It has 1.25× bicycle top speed and quicker acceleration; the L1 bicycle tuning remains unchanged. L10 currently gets one trial placement at the evacuation road. While riding, weapon selection is pinned to the handgun when carried, only its fire input is passed through, the other rack entries are dimmed, and the previous selection is restored on dismount. The corgi is attached to the sidecar position while mounted and released on dismount. The procedural view has a motorcycle and sidecar shape, and the shared speed-responsive vehicle engine loop is emitted.

## Verification

- `npm run typecheck` — pass
- `npm run lint` — pass
- Focused `tests/engine/vehicles.test.ts` — pass (2 tests), including handgun hit, blocked second weapon, corgi sidecar attachment, and faster speed cap.

## Open

- Replace the procedural view with an authored motorbike/sidecar vehicle asset and validated LODs/budgets.
- Add a headlight cone, exhaust puffs, and a corgi sit pose / hop presentation.
- Add native coverage for 100 m travel, handgun hits, other weapons blocked, hard-hit knock-off/remount, and corgi seating.
- Capture and review the Scene Lab HIGH zoom 1 (3 frames) and LOW captures; pass `qa:vehicle-motion`.
- Run skilled route/threat audit and remote npm test; update this report with final evidence.

This report records an in-progress implementation and does not claim the brief's Done list is complete.
