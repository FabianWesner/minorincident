# s90-l8handoff — L8 boarding handoff

## Finding and native reproduction

The driver-door gate in `LevelEightZoo.canBoardDriver()` required `hale-fallen` even after all 14 living passengers were seated. The departure controller also waited for that flag, so the door stayed unavailable and the APC never began its handoff if Hale had not been hit by the elephant charge.

Native reproduction was added to the existing `zooParkedBoarding()` vehicle test. With all six arenas complete and the 14 passenger boarding animations finished, clearing `hale-fallen` to represent Hale still alive made `canBoardDriver()` return false before the fix. The pre-fix command failed at that assertion:

```sh
node node_modules/vitest/vitest.mjs run --project default --configLoader runner tests/engine/vehicles.test.ts -t 'enter, drive and exit'
```

The failure reported `14/14 seated with Hale alive still unlocks the driver door: expected false to be true`.

## Change

Driver entry now depends on the outbreak being breached, all six arenas being complete, the escape/depart objective being active, and the complete living passenger roster being seated. Starting the authored APC drive-out uses those same completion facts and no longer waits for Hale to fall. The Hale elephant-charge story sequence remains unchanged and still plays when its authored conditions occur.

The merged native regression seats all 14 passengers, leaves Hale alive, enters with E at the driver door, and requires the scripted departure to finish within eight seconds. It also continues through the L9 handoff with the same APC.

## Validation

- Pre-fix native reproduction: failed as expected at the Hale gate.
- Focused vehicle/mission regression after the change: passed (one existing test, one skipped).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L8`: zero new L8 gameplay flags. The skilled route retains the same `step/escape:UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS` flag documented by the s79 baseline; passive has zero flags. The command exits 1 for the diagnostic partial-level selection and baseline skilled flag.
- `sh tools/remote/run.sh "$PWD" -- npm test`: passed on runner `46.225.66.90`, exit 0, 27 files, 106 passed / one skipped; 150/150 case collection guard; 208.8 s against the unchanged 240 s budget. This supersedes the initial network-blocked attempt.
- Remaining native coverage: load the actual elephant-yard checkpoint and exercise its handoff; the current regression constructs the completed-arena boarding state in a fresh world.

## Browser QA needed

No browser was used, per task constraint. Real-input QA should cover fresh L8 start and the elephant-yard checkpoint at HIGH and LOW, reach 14/14, then verify E at the APC driver marker advances to L9 within 15 seconds both when Hale has fallen and when Hale remains alive (including elephant defeated before Hale's charge). Confirm the live objective/marker identifies the driver door at 14/14.
