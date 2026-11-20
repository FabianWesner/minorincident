# s213 motorbike with sidecar

## Progress

Implemented a distinct L10 motorbike ride state on the established bicycle interaction and capsule contact path. It has 1.25× bicycle top speed, quicker acceleration, and a slightly wider turn radius; the L1 bicycle tuning remains unchanged. L10 currently gets one trial placement at the evacuation road. While riding, weapon selection is pinned to the handgun when carried, only its fire input is passed through within a forward 200° arc, the other rack entries are dimmed, and the previous selection is restored on dismount. The corgi is attached to the sidecar position while mounted and released on dismount. The procedural view has a motorcycle and sidecar shape, and the shared speed-responsive vehicle engine loop is emitted.

## Verification

- `npm run typecheck` — pass
- `npm run lint` — pass
- Focused `tests/engine/vehicles.test.ts` — pass (2 tests), including >100 m ride, handgun hit, blocked second weapon, corgi sidecar attachment, and faster speed cap.
- `E2E_PORT=5193 SCENE_PORT=5194 npm run qa:vehicle-motion` — unable to start browser pool (`listen EPERM 127.0.0.1:4329`); retry required.

## Open

- Replace the procedural view with an authored motorbike/sidecar vehicle asset and validated LODs/budgets.
- Add a headlight cone, exhaust puffs, and a corgi sit pose / hop presentation.
- Add native coverage for 100 m travel, handgun hits, other weapons blocked, hard-hit knock-off/remount, and corgi seating.
- Capture and review the Scene Lab HIGH zoom 1 (3 frames) and LOW captures; pass `qa:vehicle-motion`.
- Run skilled route/threat audit and remote npm test; update this report with final evidence.

This report records an in-progress implementation and does not claim the brief's Done list is complete.
