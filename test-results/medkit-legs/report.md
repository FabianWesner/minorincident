# Medkit between the courier's legs — 2026-10-10

## Root cause and fix

The medkit was a world pickup, not a held action or E26 carryable. `Companion.update()` fetched every available pickup within six metres and moved its world transform directly onto the player. At full health, `Pickups.update()` deliberately leaves a medkit unconsumed. The corgi therefore deposited the visible red case between the courier's legs and could bring it back whenever the courier moved more than a metre away. This applies to the ordinary L1/L2 pickups and the L3 route packs: all use `Pickups.spawn()` and the same companion system.

The existing warning-only companion mode (`safe`, D-GROVE/D-CORRIDOR) did not guard fetching, contrary to E19 and E20's inherited corgi rule. Fetch selection now respects that mode. Fetch-enabled scenarios also reject medkits/soda at full health. Pending targets are revalidated each tick, so healing during a fetch or restoring a stale target cannot move unusable loot to the courier. No rendering workaround or new inventory was added.

## Regression evidence

`tests/sim/npc/medkit-fetch.test.ts` covers full-health approach/touch/depart/repeated approach, both companion modes, healing during an in-flight fetch, restored item targets in warning-only mode, and one-shot healing in fetch-enabled mode. Before the fix, the medkit's X changed from 5 to 0 (the player's position), reproducing the screenshot. After the fix all five cases pass. The existing item-fetch/courage/lure suite still passes (13 tests with the new cases).

## Scene Lab replay

Run `SCENE_PORT=3368 sh tools/e2e-lock.sh npx tsx tools/scenelab/medkit-fetch.ts`.

The fixture crops shipped L1, L2 and L3 district layouts at real route pack coordinates: D-GROVE (17.25, 6.25) for L1/L2 and D-CORRIDOR (-66, -3.4) for L3. It uses the real courier, corgi, pickup system, headless WebGL2/ANGLE Metal, and game follow camera at zoom 0.5. For each level the courier walks to the full-health medkit and leaves, takes 70 damage, walks back to heal, then leaves again. Assertions require actual arrival, an unchanged unconsumed world transform at full health, healing/consumption at partial health, and zero fetch events or console errors. These are isolated visual fixtures using the default +50 HP kit at the route coordinates; the mission's L3 +40 HP tuning is unchanged.

## Vision review

Inspected all six full-resolution game-camera captures. Foreground fences are omitted only from the isolated fixture to expose the legs; the medkit stays visible and the game camera angle is unchanged. No production scenery or pickup renderer was changed.

- L1 full / partial (sheet f0/f1): the upright red case is on the sidewalk behind and right of the courier after the full-health touch/departure. Her shorts, hips, both legs and shoes are fully visible and clear. After the injured pass the sidewalk case is absent, and her body remains clear.
- L2 full / partial (f2/f3): the same route position under midday lighting shows the bright red/white kit on the pavement, separated from the courier; after healing it is absent. The courier's hips and legs are clear in both images.
- L3 full / partial (f4/f5): the corridor cafe/lamp backdrop and the full courier silhouette remain readable. The case sits separately at the lower right after the full-health pass and disappears after the injured pass. No red case is attached to, between, or overlapping her legs.

All six scenario assertions passed, with zero console errors and zero corgi fetch events. The reviewed contact sheet is `scenes/sheet.jpg`; f0–f5 are the six review cells in the order above. Individual PNGs and incidental validation captures were removed after review.

## Completed validation

- `npm run typecheck`, `npm run lint`, `npm run build`: passed, including the rebuilt merged worktree.
- Remote `vitest run tests/unit tests/sim/npc/medkit-fetch.test.ts tests/sim/npc/followers.test.ts tests/levels/l1-medkits.test.ts --maxWorkers=4`: 131 files, 459 tests passed. The first remote snapshot contained an already-corrected event-union type error in the new test; the final complete run passed.
- Remote `vitest run -t @smoke --maxWorkers=2`: 6 passed.
- `E2E_PORT=3367 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels --project=chromium --workers=2`: all 31 passed (9.6 min), including real input L1–L6 and all three L3 streets.
- `E2E_PORT=3369 sh tools/e2e-lock.sh npx playwright test --grep @smoke --workers=2`: all 26 passed (1.5 min), desktop, mobile, WebKit.
- `git merge main`: clean fast-forward through a93caf8f (L6 shader prewarming and two browser test corrections). Specs and reference files were not edited; this lane did not deploy or merge into main.

- `E2E_PORT=3370 MI_VERIFY_REMOTE_SIM=1 npm run verify -- E08`: passed; typecheck, lint, build, 38 selected remote tests and 31 selected browser tests green.
- Final capture fixture typecheck/lint: passed.
