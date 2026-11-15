# s120-testspeed

## Change

Moved `tests/engine/mission-interactions.test.ts` unchanged to `tests/nightly/mission-interactions.test.ts`. Its single test loads all ten level worlds and combines the all-level ring/input/view predicate sweep with long L1, L2, L8, L9 and L10 scenarios. The test strategy says work slower than about 15 seconds belongs in nightly. The test remains covered by `npm run test:nightly`; the regression-injection check below confirms the view predicate assertion remains active.

No assertions were removed and no source files were changed. This retains total collection at 150 cases and 45 files. Default `npm test` remains 129 Vitest cases collected across projects, with 106 cases run in its default project.

## Timing evidence

The supplied runner baseline was 234 seconds overall, with the interaction test at about 142 seconds. After the move, the Mac default run took 97.5 seconds; a separate JSON reporter run measured individual files. These Mac timings are directional and are not a substitute for runner measurements.

The runner pool had no healthy/provisioned Hetzner runner. `sh tools/remote/run.sh "$PWD" -- npm test` exited 69, and `sh tools/remote/scale.sh add` could not resolve its cloud API hostname. Therefore no post-change runner timing or consecutive remote receipts are available yet. The requested ≤150-second runner result remains unverified.

Per-file before/after timing inputs and provenance are in [timings.json](./timings.json).

## Coverage proof

- Temporary regression injection: changed `src/render/InteractionView.ts:isMissionInteraction` to always return false. The moved test failed at `L1 pickup view` (`expected false to be true`) on the test's view-predicate assertion. The injection was reverted.
- The unmodified nightly test passed: 1 file, 1 test; duration 74.32 seconds on the Mac.
- `git show HEAD:tests/engine/mission-interactions.test.ts | diff -u - tests/nightly/mission-interactions.test.ts` produced no differences.
- Default `npm test`: 150/150 collection, 45/45 files, 106/106 default tests passed, 97.5 seconds on the Mac.
- `npm run typecheck` and `npm run lint` passed.

## Next gate

Restore runner availability, then run `sh tools/remote/run.sh "$PWD" -- npm test` twice consecutively. Capture runner per-file timings and confirm each run is at most 150 seconds. If not, continue reducing runtime while retaining the same assertions and use regression injection for every changed test.
