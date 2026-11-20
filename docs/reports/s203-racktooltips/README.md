# s203 — weapon rack tooltips

## Implemented

- Added canonical player-facing weapon names in `src/data/weaponNames.ts`. The HUD uses them for rack entries, pickup hints, and touch weapon labels; examples include Army MG, Hunting Rifle, Nail Gun, Molotov Cocktail, and Pipe Bomb.
- Added styled rack tooltips with the name in bold, its role, and shortcut. Undiscovered slots explain `Not found yet · key N`; shared keys identify the selected variant and say to press again to switch.
- Added a Corgi Lure tooltip describing its in-code effect (draws infected within 15 m to the squeaker for 5 seconds), the G key, and ready/recharge state. The slot stays hoverable during recharge and ignores activation until ready.
- Extended the existing L10 fixed-key smoke flow to capture handgun, hole, and Corgi tooltips at 1280×720 and 390×844, and assert hovering does not add an attack event.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused unit suite, `node node_modules/vitest/vitest.mjs run --project default --configLoader runner tests/engine/combat.test.ts` — passed (8 tests), including canonical-name and Corgi behavior coverage.
- `npm run test:smoke` — blocked before browser startup: the browser-pool daemon could not bind `127.0.0.1:4329` (`listen EPERM`). No screenshots were produced or visually inspected in this run.
- `sh tools/remote/run.sh "$PWD" -- npm test` — unavailable: the remote runner reports no healthy machine (none running/provisioned), and the command is not eligible for the local Mac slot.

## Open

- Re-run smoke through the browser pool and inspect the six requested tooltip captures at both viewport sizes. Confirm appearance, placement, and the ~150 ms show time in a working browser run.
- Run the remote `npm test` suite when a healthy runner is available.
