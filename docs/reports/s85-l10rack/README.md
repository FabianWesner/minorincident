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

## Verification after sandbox removal

- Remote `npm test`: PASS on 94.130.181.173, 27 files, 106 passed / 1 skipped, 224.1 s within 240 s.
- Extended headless Chromium smoke case: PASS twice; final run explicitly captures 1280×720. All 14 hangar weapons selected by real clicks and Q cycling; 390×844 rack bounds passed.
- Opened all four HIGH captures and the corrected desktop capture. Desktop rack is fully visible along the bottom; phone rack wraps within the viewport. The hunting-rifle icon contains HU (hunting rifle), with a Q shortcut badge and a full-name tooltip. Gold dashed Molotov trajectory and the ground ring are visible at zoom 1 and 1.5; the closer view clips the ring at the screen edge. [Review sheet](review.jpg).
- These results supersede the earlier sandbox/runner blockers above. Remaining: matched before/after throwable captures and explicit empty-ammo presentation review.

## Touch correction

Real CDP touch events exposed overlap between Flashbang's slot and the touch attack controls. `2f21534d` positions the rack directly from the active input scheme, above the attack controls. The rebuilt headless smoke test passed all 14 real touch selections as well as clicks and Q cycling. Opened the 390×844 capture: every rack slot is within the viewport and the attack controls are below the rack with a clear gap. Focused ESLint passed. Matched throwable before/after captures and empty-ammo visual review remain open.

## Empty ammo and matched preview evidence

- Corrected browser fixture reads the upgraded starting charge count (three in this campaign), spends all charges, reselects Molotov and verifies selected=true, empty=true and an Empty accessible label. Headless test passed; opened empty-molotov.png and saw the selected slot with its ! marker.
- Built an isolated source archive with only ActionView.ts restored from af05750d. The same browser fixture passed against both builds. Opened before/after captures at HIGH zoom 1 and 1.5: the former thick continuous trajectory/ring is now thin and dashed with a thin ground ring. This LEFT-slot fixture was already gold before; the supplied PO screenshot documents the former RIGHT-slot cyan color. Camera/scene match; zoom 1 clips the ring at the edge, while zoom 1.5 shows the full circle. Updated review.jpg contains the four matched captures.

## Final completion audit

All remaining items above are closed. Final rebuilt Chromium smoke passed (1.2 min), including all 14 hangar weapons by click, Q cycling and real touch, 1280×720/390×844 rack bounds, and reselecting an empty upgraded Molotov. All carried catalog IDs have selection coverage; pistol/kick use their documented handgun/unarmed aliases. HU means hunting rifle; its full name is available on the slot tooltip/accessibility label, with Q shown as its cycling shortcut.

The charge-return test now verifies axe, handgun and machete as the previous weapon; charges-left stays selected and last-charge returns with a loadout.switched event. Focused input/combat/save tests passed 18/18. Full typecheck and lint passed. The required remote suite passed 106 tests with one skipped in 224.1 s.

Final audit found and fixed the preview using catalog rather than upgraded radius (9c20462a). Opened the final HIGH zoom-1 and zoom-1.5 captures: thin gold dashes and a larger ground-aligned ring match the upgraded combat definition; the nearer ring is edge-clipped and the wider view shows its circumference. The review sheet preserves the matched original-renderer captures on the left and final captures on the right. Earlier statements of pending work are superseded by this audit. No deploy, push or main movement.
