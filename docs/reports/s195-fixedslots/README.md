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
- Remote `sh tools/remote/run.sh "$PWD" -- npm test` ran twice on the provisioned runner; both runs timed out at 241.1 s and 240.8 s under load. The required remote green result remains open.

## Visual captures

The requested high-quality, zoom-1 L4/L8/L10 start and post-pickup HUD captures remain open. A headless capture attempt reached each level, but inspection showed the rack was hidden during the opening scenes; those images do not establish the HUD appearance. Update `tools/scenelab/s195-fixedslots.ts` to expose the live HUD and verify pickup acquisition, then inspect the six images and add a contact sheet.

Capture investigation: the test URL needs `ui=1`; without it `GameUI` is disabled and no HUD is mounted. With `ui=1`, L8 and L10 showed rack tiles, while L4 was still in its opening cinematic and its HUD was hidden. A subsequent attempt to advance past the cinematic did not produce a visible rack; the required six-image proof is still incomplete.

## Commits

- `9c1cf667` Add fixed weapon key mapping
- `7a5cd980` Render fixed campaign weapon keys
- `e6a10e75` Keep level weapon rack holes visible
- `e896a7c3` Align weapon cycling and save migration
- `58423093` Fold fixed key migration into save test
- `ee511111` Update s195 verification report
- `5574a8ee` Complete per-level weapon slot sets

This report records current progress; the visual capture review and remote test gate remain incomplete. The test-budget count was kept at 150 by folding the v1 save assertion into the existing save-decoding test.
