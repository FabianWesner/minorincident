# s195 fixed weapon slots

## Implemented

- `src/data/weaponSlots.ts` is the fixed key and per-level weapon table. It combines authored level start racks with the L1/L2/L3/L4/L5/L7 pickups and the L10 hangar/field arsenal. Keys are shared by melee variants (`1`) and throwables (`0`); G remains the corgi lure.
- Number-key selection, rack labels, pickup hints, and next/previous ordering use those fixed keys. Owned variants stay available for cycling; the HUD displays the highest-tier owned weapon for a shared key. Per-level weapons that have not been acquired render as dimmed, numbered holes.
- The previous recording key map remains available for v1 recordings. Saves still store weapon IDs; the migration test loads a v1 save containing nail gun and army MG and verifies keys 7 and 4.
- The native pickup regression collects the nail gun, selects it on 7, collects the army MG, then selects the MG on 4. The nail gun remains available on 7.
- Bot weapon selection required no changes: the threat audit still reports zero fail flags.
- `8ff43012` keeps the rack visible when a level has holes but the player carries no weapons. Typecheck, lint and the focused input test passed after this change.

## Verification

- Focused: `tests/engine/input.test.ts`, `tests/engine/combat.test.ts`, `tests/engine/world-systems.test.ts`, `tests/engine/save-progression.test.ts` — 24 passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — passed locally: 106 tests in 27 files; test-budget reported 150/150 planned cases and 117.0 s / 240 s.
- `npm run qa:threat` — passed: 0 fail flags in 277.0 s. The bot weapon paths required no changes.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: three attempts timed out around 240 s. The unchanged rerun completed in 227.6 s with 104 passed, one skipped and one failure in `tests/engine/l4-contact.test.ts`: the LOW perimeter routing assertion at line 780. The remote gate remains open; investigate that failure before treating the suite as green.
- Follow-up: `npx vitest run tests/engine/l4-contact.test.ts --project default --configLoader runner` passed locally (63.43 s). Two subsequent unchanged remote suite attempts both timed out at 241.1 s and 240.8 s, so neither reproduced nor cleared the remote routing failure.

## Visual captures

The [contact sheet](rack-captures.jpg) shows HIGH, zoom 1, headless WebGL2: L4 start and after MG, L8 start and after launcher, L10 start and after machete (left to right, top to bottom). The rack sits at the lower left. In L4 the dim 4 becomes the MG icon, with 1 and 2 staying put. In L8 the dim 9 becomes the launcher, with the other tiles stationary. In L10 the unarmed icon becomes the machete at 1 and the dim weapon holes remain in place. The icons are small at this full-screen scale, but the selected tile and hole contrast are visible.

The harness enables the UI and asserts each spawned, retained pickup was collected. L4's opening story lock and cinematic are cleared by the fixture to expose the HUD; the resulting view is a staged HUD capture, not a playthrough of the arrival. The other pickups are also spawned at the player for this comparison.

## Commits

- `9c1cf667` Add fixed weapon key mapping
- `7a5cd980` Render fixed campaign weapon keys
- `e6a10e75` Keep level weapon rack holes visible
- `e896a7c3` Align weapon cycling and save migration
- `58423093` Fold fixed key migration into save test
- `ee511111` Update s195 verification report
- `5574a8ee` Complete per-level weapon slot sets

The remote test gate remains incomplete. The test-budget count was kept at 150 by folding the v1 save assertion into the existing save-decoding test.
