# s203 — weapon rack tooltips

## Implemented

- Added canonical player-facing weapon names in `src/data/weaponNames.ts`. The HUD uses them for rack entries, pickup hints, and touch weapon labels; examples include Army MG, Hunting Rifle, Nail Gun, Molotov Cocktail, and Pipe Bomb.
- Added styled rack tooltips with the name in bold, its role, and shortcut. Undiscovered slots explain `Not found yet · key N`; shared keys identify the selected variant and say to press again to switch.
- Added a Corgi Lure tooltip describing its in-code effect (draws infected within 15 m to the corgi for 5 seconds), the G key, and ready/recharge state. The slot stays hoverable during recharge and ignores activation until ready.
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

## Follow-up (20:10 CET)

- Smoke with one worker passed both GPU limit checks, then the L10 capture failed because the fully equipped checkpoint has no hole; the 240-second overall budget expired. The fixture now temporarily removes weapons for the hole capture and restores the loadout. This correction has not yet been exercised in a browser.
- Inspected the 1280×720 handgun capture: the dark bordered tooltip is legible above the rack, with bold name and role/key, and does not overlap it. Key 4, hole and Corgi captures at both sizes remain open.
- Corrected Corgi text against `Companion.ts`: infected move toward the corgi, not a thrown squeaker. Slots are keyboard-focusable; a touch long press suppresses the activation click. Typecheck, lint and focused combat suite pass after these changes.
- `SMOKE_WORKERS=1` now permits a one-browser smoke invocation. The full smoke budget may require splitting or performance work; the required complete smoke pass remains open.

## Follow-up (20:19 CET)

- Focused gameplay smoke passed in 1.8 minutes with the corrected hole fixture. Inspected handgun, hole and Corgi captures at 1280×720 and 390×844: they sit above the rack and remain on screen. The phone Corgi capture showed a navigation arrow over the text; the HUD stacking order has since been raised while a tooltip is visible and needs a fresh visual check.
- Fixed the missing separator before the Corgi recharge state and removed duplicate hole wording. Typecheck, lint and focused combat suite pass.
- An attempted L4 key 4 capture timed out because the rack was hidden after the fixture's level change; that attempted fixture was removed. Key 4 captures remain open. Full `npm run test:smoke` remains open: its one-worker run exceeded the 240-second budget.

## Follow-up (20:31 CET)

- Re-ran `E2E_PORT=5171 SCENE_PORT=5172 SMOKE_WORKERS=1 npm run test:smoke`. Both GPU limit checks, the gameplay/L10 rack case, and WebGL pedestrian case passed; the run reached the 240-second budget and exited 124 before completing the remaining cases and public smoke. This is not a full smoke pass.
- Inspected the refreshed 390×844 Corgi capture after the stacking change: the tooltip is above the navigation arrow, its role, G key and Ready state are readable, and it sits above the rack within the viewport.
- A direct L4 scene fixture confirmed Army MG in the loadout, but the HUD became hidden between frames and the key 4 hover timed out. Temporary capture code was removed. Key 4 captures and a full smoke pass remain open.

## Follow-up (20:43 CET)

- Captured and inspected key 4 at 1280×720 and 390×844 in L4 with Army MG equipped. Both show a legible bold “Army MG”, its role and key 4 above the rack, fully within the viewport. The scene fixture cleared L4's intro story lock and cinematic state before displaying the HUD; it does not verify the natural intro transition. Images are in `test-results/s203/`.
- Together with the earlier inspected hole and Corgi captures, the requested views have been visually reviewed. The complete `npm run test:smoke` gate remains open because the one-worker run exceeded 240 seconds after four passing cases; the focused gameplay and L10 rack case passed separately.

## Follow-up (20:45 CET)

- Ran the two QA smoke cases not reached before the single-worker aggregate timeout separately: WebGPU pedestrians and unflagged WebGPU menu-to-L1 both passed (2 tests, 33.7 seconds).
- Built the public artifact and ran `@public-smoke` separately with one worker: passed (1 test, 15.7 seconds). All individual smoke cases have now passed across separate runs, but the required aggregate `npm run test:smoke` command has not passed its 240-second wall-time gate. The full remote unit command also exceeded 240 seconds; the prescribed local full-suite plus remote L4 fallback passed, as recorded above.

## Time-box ending (20:50 CET)

- A further single-worker aggregate `npm run test:smoke` attempt again passed the two GPU limit cases, gameplay/L10 rack case and WebGL pedestrian case before the 240-second reservation expired (exit 124; 245.7 seconds). The aggregate smoke gate remains open; the other cases and public smoke passed separately as recorded above.
- The one-hour limit stated in the brief has elapsed. The requested changes and report are committed; the aggregate smoke time budget remains the outstanding gate. The remote full suite timed out without a test failure and its specified local-full-suite plus remote-L4 fallback passed.
