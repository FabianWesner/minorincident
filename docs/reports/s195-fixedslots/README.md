# s195 fixed weapon slots

## Implemented

- `src/data/weaponSlots.ts` is the fixed key and per-level weapon table. It combines authored level start racks with the L1/L2/L3/L4/L5/L7 pickups and the L10 hangar/field arsenal. Keys are shared by melee variants (`1`) and throwables (`0`); G remains the corgi lure.
- Number-key selection, rack labels, pickup hints, and next/previous ordering use those fixed keys. Owned variants stay available for cycling; the HUD displays the highest-tier owned weapon for a shared key. Per-level weapons that have not been acquired render as dimmed, numbered holes.
- The previous recording key map remains available for v1 recordings. Saves still store weapon IDs; the migration test loads a v1 save containing nail gun and army MG and verifies keys 7 and 4.
- The native pickup regression collects the nail gun, selects it on 7, collects the army MG, then selects the MG on 4. The nail gun remains available on 7.
- `5fbb8e3d` updates the L9 bot to use fixed keys 3 and 4 and fixes the playtest driver's key-0 spelling. The existing input test now checks repeated key 1 and 0 cycling.
- `6aec445a` checks the explicit key list for every level and verifies that acquiring each listed key fills its hole without changing the other positions. Focused input, typecheck and lint passed.
- `c0b2809e` versions new fixed-key recordings and decodes older position-based number-key selections using their historical ordering. `71ff414c` also restores historical wheel and side-specific ordering on replay. Focused input, codec and combat tests (14), typecheck and lint passed after the changes.
- `e39b2f9b` restores the original version 1 recording behavior for selecting innate fists even when another melee weapon is carried. Input and codec tests, typecheck and lint passed.
- `05dcec15` orders side-specific touch selection by fixed key and applies L8's swap lock to historical replay selections too. Input and combat tests (12), typecheck and lint passed.
- `99995b82` highlights the shared rack key when any of its owned variants is selected, while retaining the best owned icon. Input tests, typecheck and lint passed.
- `0d7c900a` shows the fixed-key pickup hint for every keyed weapon, including machete and throwables without role text, and for repeat pickups. Input tests, typecheck and lint passed.
- `8ff43012` keeps the rack visible when a level has holes but the player carries no weapons. Typecheck, lint and the focused input test passed after this change.
- `895d2cb7` filters carried weapons by the predefined level keys when drawing a campaign rack, including when an older save contains an out-of-set weapon. Typecheck, lint and the focused input test passed.

## Verification

- Focused: `tests/engine/input.test.ts`, `tests/engine/combat.test.ts`, `tests/engine/world-systems.test.ts`, `tests/engine/save-progression.test.ts` — 24 passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — passed locally after the final historical cycling change: 106 tests in 27 files; test-budget reported 150/150 planned cases and 143.3 s / 240 s.
- `npm run verify -- E06` — passed before the final historical cycling compatibility change: typecheck, lint and 106 local tests; 150/150 planned cases, 153.5 s / 240 s for the test gate. The final compatibility change passed its focused input, codec and combat tests, typecheck and lint.
- `npm run qa:threat` — passed after the bot change: 0 fail flags in 424.6 s.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: three attempts timed out around 240 s. The unchanged rerun completed in 227.6 s with 104 passed, one skipped and one failure in `tests/engine/l4-contact.test.ts`: the LOW perimeter routing assertion at line 780. The remote gate remains open; investigate that failure before treating the suite as green.
- Follow-up: `npx vitest run tests/engine/l4-contact.test.ts --project default --configLoader runner` passed locally (63.43 s). Two subsequent unchanged remote suite attempts both timed out at 241.1 s and 240.8 s, so neither reproduced nor cleared the remote routing failure.
- A focused remote run reproduced the routing failure in 175.60 s: actor 373 remained near (-6.23, 9.49) for 301 ticks, with scripted target (-3.18, 6) and no rail damage. The same test passes locally. Its relationship to the weapon change has not been established; no zombie behavior or test criteria were altered.
- Baseline comparison: the same focused remote command on detached pre-s195 commit `94ec745d` failed at the same assertion with the same actor 373, start tick 17127 and position (-6.229738661833887, 9.491315724578172). This establishes that this remote routing failure predates s195. The required remote suite remains red; no zombie behavior or test criteria were altered.
- Latest remote full suite, before the final historical cycling compatibility change, completed in 188.5 s: 104 passed, one skipped and the same L4 actor 373 routing assertion failed. The remote gate is still red.

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
