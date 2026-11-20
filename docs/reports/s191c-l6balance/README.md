# s191c — L6 survivor firepower and threat

The shelter's living survivors receive pistols and one shotgun as the retreat begins, targeting about half of the roster including carried guns. Existing guns are retained. Armed walkers cover a grabbed survivor while continuing in the column; gun allocation is distributed across formation lanes. The extra weapons are issued at retreat, so the opening breach is covered by Marcus and the player. Zombie counts, stats, wave cadence and caps are unchanged. L6-07 direction remains open.

The earlier s191b HIGH real-input seed 1 comparison reported 6 → 4 player deaths. That measurement predates this balance candidate and cannot establish its death count. No new real-input HIGH comparison was run.

## Checks

- `npm run qa:threat -- --levels L6`: zero L6 flags; the expected `PARTIAL_LEVEL_SELECTION` flag causes exit 1.
- `npm run qa:threat`: zero fail flags, 463.9 s. Passive breach cohorts first attacked at 9.82 s and 7.53 s. Skilled damage met the 30 HP criterion; the kiting sample passed at 3 landed hits/min.
- `npm run typecheck`, `npm run lint`, and `npx vitest run tests/engine/missions.test.ts --maxWorkers=4`: passed (5 focused tests).
- Remote `npm test`: three unchanged runs exceeded the 240 s runner limit (241.2 s, 245.5 s and 241.3 s). A fourth unchanged run passed: 27 files, 105 tests passed and one skipped, 219.3 s. Test collection was 150/150 after combining adjacent progression cases without removing assertions.

No specs or threat evaluator were changed. This candidate has not been assessed by a human player.
