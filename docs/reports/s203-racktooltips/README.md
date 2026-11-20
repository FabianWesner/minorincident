# s203 — weapon rack tooltips

## Implemented

- Added canonical player-facing weapon names in `src/data/weaponNames.ts`. The HUD uses them for rack entries, pickup hints, and touch weapon labels; examples include Army MG, Hunting Rifle, Nail Gun, Molotov Cocktail, and Pipe Bomb.
- Added styled rack tooltips with the name in bold, its role, and shortcut. Undiscovered slots explain `Not found yet · key N`; shared keys identify the selected variant and say to press again to switch.
- Added a Corgi Lure tooltip describing its in-code effect (draws infected within 15 m to the squeaker for 5 seconds), the G key, and ready/recharge state. The slot stays hoverable during recharge and ignores activation until ready.
- Extended the existing L10 fixed-key smoke flow to capture handgun, hole, and Corgi tooltips at 1280×720 and 390×844, and assert hovering does not add an attack event.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused unit suite, `node node_modules/vitest/vitest.mjs run --project default --configLoader runner tests/engine/combat.test.ts` — passed (7 tests), including canonical-name and Corgi behavior coverage.
- `npm run test:smoke` — blocked before browser startup: the browser-pool daemon could not bind `127.0.0.1:4329` (`listen EPERM`). No screenshots were produced or visually inspected in this run.
- Remote `npm test` timed out at 245 seconds without a reported failure. The prescribed fallback passed: local `npm test` (27 files, 106 tests) and remote `tests/engine/l4-contact.test.ts` (1 test).

## Open

- Re-run smoke through the browser pool and inspect the six requested tooltip captures at both viewport sizes. Confirm appearance, placement, and the ~150 ms show time in a working browser run.
- Smoke retry reached browser execution after consolidating the focused assertions to meet the 150-case budget, but was interrupted because the script hard-codes two workers and this job permits one browser. Run with one worker and inspect captures.
