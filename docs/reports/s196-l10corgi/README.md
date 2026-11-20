# s196 — L10 corgi hangar entry

## Finding

The hangar opening was 2 m wide, formed by the west/east door wall colliders in `src/levels/L10/layout.ts`. NavGrid had a route through the doorway, but the corgi's elongated collision footprint turned into the side of the opening and stalled outside (a native HIGH reproduction stopped at z=52.26 against the z=52.6 wall face). The soldiers are not holding the corgi, and the follow system has no hangar hold. The ordinary 2 m following band also lets a dog settle before it clears the boundary when the courier pauses just inside.

## Change

Widened the hangar's clear entrance to 4 m. While the courier is inside the hangar and the corgi is still outside, the follower continues toward the centered entrance/interior target with a 0.1 m stop distance. This uses ordinary navigation and collision movement; it does not relocate the corgi.

Folded the regression into the existing `tests/engine/npcs.test.ts` case. HIGH and LOW each cover a fresh `cure-research-entry` checkpoint at the doorway and a courier walking the final approach into the hangar. The corgi crosses the hangar boundary within 15 seconds and stays within 6 m of the courier.

## Validation

- `npx vitest run tests/engine/npcs.test.ts --project default --configLoader runner` — PASS (3 tests; includes HIGH/LOW checkpoint and walking approaches).
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run qa:threat -- --levels L10` — FAIL: passive audit reported zero threat flags, but the skilled native route hit the 1,800 s tick budget at “Kill the Mega Alpha”, leaving `INCOMPLETE_NATIVE_POLICY:tick-budget` (1 acceptance flag). An unchanged retry produced the same flag and zero passive flags (144.8 s).
- `sh tools/remote/run.sh "$PWD" -- npm test` — PASS on remote retry: 27 files, 105 passed, 1 skipped; 207.3 s (240 s budget).
- HIGH, zoom 1 headless real-level capture: `test-results/scenes/s196-native-hangar.png` (untracked). Courier and corgi were placed at (2707, 59) and (2707, 56), respectively, with the latter inside the authored hangar bounds. The opened frame shows the packed corgi and courier between two guards, but heavy shadow and overlays obscure the doorway and interior; it does not visually establish the corgi walking inside. The PO screenshot shows the courier on the apron, two riflemen, and the packed corgi behind the marked bay edge.

A second HIGH zoom 1 real-level still, `test-results/scenes/s196-native-hangar-deep.png` (untracked), places the courier at (2707, 66) and corgi at (2707, 63), inside the authored hangar. Opened and inspected: the packed corgi stands beside the courier near the glowing cure pedestal and a researcher; the image is staged and the native regression provides the movement evidence. The clean L10 threat audit remains open. The first commit attempt was blocked by read-only Git metadata; filesystem access was subsequently restored.
