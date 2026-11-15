# s118 L9 bus and hatch defence

Status: **in progress; not green**. This report records the first routing change and its native probe. The required spawn/residency behavior is still incomplete, so no completion claim or commit is made.

## Findings and change

`LevelNineDriving` previously recorded the APC's recent positions and used that trail to place and steer the pursuit bus. Because the player can take gravel and open-ground shortcuts, this made the bus leave the asphalt. The bus now uses the authored `road` polyline in `layouts/D-CROSSING/routes.json`, spawns at a point 125 m behind the APC's progress on that line, follows the asphalt toward the rail crossing, and brakes near the rail to deliver its six passengers.

The native HIGH/LOW probe is [bus-route.json](bus-route.json). On-road and corner-cut fixture cases spawned the bus and measured maximum centreline offsets of 0.53–0.56 m, with all six passengers released. The wide-detour case did not spawn in either tier because the asphalt chunk is not resident. In LOW, neither near-road case spawned in this first probe run. Those rows are failures, not excluded samples. The implementation therefore does not yet satisfy the all-path/all-tier spawn requirement.

## Validation so far

- `npm run typecheck`: passed after correcting a stale `trail` reference.
- `npm run lint`: passed.
- `node --import tsx tools/qa/s118-l9-bus-proof.ts`: failed the assertions for missing spawns in the stated rows; JSON retained as diagnostic evidence.
- `npm run qa:vehicle-campaign-motion`: browser pool startup failed because its local listener could not bind `127.0.0.1:4329` (`EPERM`). No browser was opened.
- `node --import tsx tools/qa/threat-audit.ts`: passed; L9 skilled complete, L9 passive complete, 0 passive flags (full audit: 304.0 s, 0 fail flags).
- `npm run verify -- E31`: could not start; Node `tsx` IPC listener bind failed with `EPERM` in the sandbox.
- `sh tools/remote/run.sh "$PWD" -- npm test`: not run; no healthy remote runner was available, and the command does not allow this suite in the local Mac fallback.

## Open requirements

- Coordinate road-chunk residency with the off-road APC and bus so the bus can spawn and remain on asphalt for on-road, corner-cut and wide-detour paths in both tiers.
- Measure continuous road distance for the full pursuit in all six path/tier combinations and verify the bus remains offscreen at spawn.
- Prove the delivered infected reach the hatch, first attack within 15 seconds of hatch-open, and at least three within 5 m of the APC on HIGH and LOW.
- Re-run `npm run verify -- E31` and `npm run qa:vehicle-campaign-motion` in an environment where the required local IPC/browser pool listeners can bind.
- Run the required remote unit suite when a healthy runner is available.
- Save the required committed JSON and final report with a **Browser QA needed** section.

## Browser QA needed

The bus routing, visibility, hatch attack timing and passenger proximity still need headless browser confirmation at HIGH and LOW. Browser QA was not attempted because the configured browser pool failed before launch.

## Continuation validation

Removed the missed-ram sideways velocity impulse, which independently threw the bus off asphalt. Typecheck and lint pass. The now-available remote runner completed the full unchanged `npm test` command in 210.5 seconds: 105 passed, 1 failed, 1 skipped. The failure is the L9 parked-APC bus approach assertion in `tests/engine/vehicles.test.ts:310`: closest distance 60 m versus required <13.845 m. This is a real unresolved regression of the current road-stop implementation. No commit or green-gate claim is made.

Rail braking now applies only during the unrestarted rail stall; evacuation approach restores gap-based braking. The focused `vehicles.test.ts` suite passes (2/2, 31.81 s), as do typecheck and lint. Full remote suite must be rerun after this correction. Road residency and passenger participation remain open.

## Road collision residency correction

The bus now requests collision residency for its pending asphalt spawn or current position. Chunk selection reserves that support within the existing tier budget by replacing the furthest APC prefetch chunk. The six native 30-second fixtures now all spawn and all measured centers stay within 6 m (worst 5.256 m at the return bend). HIGH/LOW wide-detour fixtures release no passengers within that window; this remains incomplete. These are stationary APC setup fixtures, not the required full pursuit driving paths or hatch participation proof. Typecheck and lint pass. Earlier missing-spawn results above are superseded by the current JSON, while full route, hatch and gate requirements remain open.
