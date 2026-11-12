# s85-l10rack — L10 weapon rack and throwable follow-up

## Changes

- `af05750d` adds a stable rack key for every carried weapon in the action catalog. Existing 1–9 assignments stay fixed, `0` selects index 10, and Q cycles the full de-duplicated carried rack. The HUD enables every weapon button and displays its shortcut.
- `aea25fd2` keeps a throwable selected while charges remain and returns to the weapon selected before it when the last charge is spent. It changes the throwable preview to warm gold, draws a thinner dashed arc that stops at cover, and samples the landing ring against ground height at the authored blast/fire radius.
- Rack selection/cycling, throwable charge-return, the 14-weapon L10 click/Q path, 1280×720 and phone bounds, and zoom 1/1.5 capture coverage are merged into existing test cases to keep the suite at its 150-case limit.
- Campaign fallback priorities remain on the original nine-weapon order, separate from the expanded rack shortcuts.

## Verification

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Focused input/combat/save-progression tests: PASS, 18 tests.
- `npm test`: the test budget preflight passed at 150/150. The local run reached the 239-second browser-job limit and exited without a suite result; it reported the existing selection-fallback assertion before timeout. That regression was fixed by separating fallback priority from rack-key order, and the affected three test files then passed. A full final run remains unverified.
- `sh tools/remote/run.sh "$PWD" -- npm test`: NOT RUN. The runner reported that no healthy Hetzner runner is provisioned and this command cannot use the local Mac slot.
- Headless browser capture/test: NOT RUN. Browser-pool startup is blocked by `listen EPERM` while binding 127.0.0.1:4329 and 4328. No screenshot has been captured, opened, or reviewed yet.

## Still required

- Run the extended L10 smoke case through the browser pool; inspect the full rack capture at 1280×720 and the 390×844 bounds.
- Capture and open the HIGH Molotov preview at zoom 1 and 1.5; describe both captures.
- Run the remote unit suite when a healthy runner is available.
