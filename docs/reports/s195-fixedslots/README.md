# s195 fixed weapon slots

## Implemented

- `src/data/weaponSlots.ts` is the fixed key and per-level weapon table. It combines authored level start racks with the known L2/L3/L5/L7 pickups and the L10 hangar/field arsenal. Keys are shared by melee variants (`1`) and throwables (`0`); G remains the corgi lure.
- Number-key selection, rack labels, pickup hints, and next/previous ordering use those fixed keys. Owned variants stay available for cycling; the HUD displays the highest-tier owned weapon for a shared key. Per-level weapons that have not been acquired render as dimmed, numbered holes.
- The previous recording key map remains available for v1 recordings. Saves still store weapon IDs; the migration test loads a v1 save containing nail gun and army MG and verifies keys 7 and 4.
- The native pickup regression collects the nail gun, selects it on 7, collects the army MG, then selects the MG on 4. The nail gun remains available on 7.
- Bot weapon selection required no changes: the threat audit still reports zero fail flags.

## Verification

- Focused: `tests/engine/input.test.ts`, `tests/engine/combat.test.ts`, `tests/engine/world-systems.test.ts`, `tests/engine/save-progression.test.ts` — 24 passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — passed locally: 106 tests in 27 files; test-budget reported 150/150 planned cases and 106.2 s / 240 s.
- `npm run qa:threat` — passed: 0 fail flags in 277.0 s. The bot weapon paths required no changes.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test` could not run: no healthy Hetzner runner is provisioned. The required remote green result remains open.

## Visual captures

The requested high-quality, zoom-1 L4/L8/L10 start and post-pickup captures are not available yet, so there are no images to describe. `tools/scenelab/s195-fixedslots.ts` contains the headless capture flow. The browser pool could not start in this environment (`listen EPERM` on its loopback service port), and `tools/e2e-lock.sh` exited before launching a browser. Retry through the browser pool, inspect the six images, then add a visual description here and one contact sheet.

## Commits

- `9c1cf667` Add fixed weapon key mapping
- `7a5cd980` Render fixed campaign weapon keys
- `e6a10e75` Keep level weapon rack holes visible
- `e896a7c3` Align weapon cycling and save migration

This report records current progress; the visual capture review and remote test gate remain incomplete. The test-budget count was kept at 150 by folding the v1 save assertion into the existing save-decoding test.
