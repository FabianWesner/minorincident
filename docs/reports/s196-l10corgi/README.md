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
- `npm run qa:threat -- --levels L10` — FAIL: passive audit reported zero threat flags, but the skilled native route hit the 1,800 s tick budget at “Kill the Mega Alpha”, leaving `INCOMPLETE_NATIVE_POLICY:tick-budget` (1 acceptance flag).
- `sh tools/remote/run.sh "$PWD" -- npm test` — NOT RUN: no healthy Hetzner runner was available; local fallback rejects this command.
- HIGH, zoom 1 headless capture — NOT CAPTURED: the Scene Lab command was attempted with `SCENE_PORT=5150` and `E2E_PORT=5149`, but the browser-pool daemon could not bind `127.0.0.1:4329` (`EPERM`). The PO screenshot was opened: it shows the courier on the apron with torch light, two riflemen at the bay edge, and the packed corgi on the far side of the marked apron/low wall. The native reproduction identifies the hangar door collider opening as the blocker.

The requested capture, clean L10 threat audit, and remote unit-suite result remain open. The first commit attempt was blocked by read-only Git metadata; filesystem access was subsequently restored.
