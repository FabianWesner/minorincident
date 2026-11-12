# s85-l10rack — L10 weapon rack and throwable follow-up

## Changes

- `af05750d` adds a stable rack key for every carried weapon in the action catalog. Existing 1–9 assignments stay fixed, `0` selects index 10, and Q cycles the full de-duplicated carried rack. The HUD enables every weapon button and displays its shortcut.
- `aea25fd2` keeps a throwable selected while charges remain and returns to the weapon selected before it when the last charge is spent. It changes the throwable preview to warm gold, draws a thinner dashed arc that stops at cover, and samples the landing ring against the ground surface at the authored blast/fire radius.
- Added per-catalog selection/cycle coverage, a last-charge return unit test, and an L10 Playwright test that checks all 14 hangar weapons by click and Q cycling and captures the desktop and phone rack layouts.

## Verification

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npx vitest run tests/engine/input.test.ts tests/engine/combat.test.ts --maxWorkers=4 --configLoader runner`: PASS, 14 tests.
- `sh tools/remote/run.sh "$PWD" -- npm test`: NOT RUN. The runner reported no healthy Hetzner runner provisioned and the command cannot use the local Mac slot.
- L10 browser test and visual captures: NOT RUN. Browser-pool startup failed with `listen EPERM` binding loopback ports 4329 and 4328. No rack or throwable before/after capture has been opened and reviewed in this worktree.

## Still required

- Run `tests/e2e/l10-weapon-rack.spec.ts` through the headless browser pool. Open and describe its 1280×720 full-rack capture and verify the 390×844 rack bounds.
- Capture the throwable aim preview at HIGH, zoom 1 and 1.5; open and describe both captures.
- Run the remote unit suite when a healthy runner is available.
