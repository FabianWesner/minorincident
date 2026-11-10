# r29-respawn: L10 checkpoint-restore frame (350 ms -> 33 ms)

## Why the r28 fix broke L10
r28-l7l10 (72aa9109) stopped `Destruction.rebuild` from emitting `world.blocker.changed` for blockers whose state did not change. Re-applied here: L10 skilled threat run = `tick-budget` (reproduced, 43.8 s wall), so the revert was right.

Measured cause (not the "stale grid" guess in the queue): with the old diff the AI nav grids (`infected.nav`, admission grid, Mega grid) had the same blocked cells and blocker ids as the full re-announce, so the grids were not cell-stale. What the diff removed were the side effects of the events: every `world.blocker.changed` bumps `NavGrid.revision`, drops the reach/previous-reach memos, resets the running search (`target`, `searching`), invalidates `nearestMemo`, and makes `InfectedSystem` clear all active goals/paths and `Barricades` clear its decisions. With zero events after a restore none of that happens and infected keep pre-death search/reach state. Clearing infected goals/paths by hand was not enough (L10 skilled still tick-budget; test-results/r29-firstfix2), so the grid-level caches (reach memo, search state, nearest memo) matter. I did not isolate which single cache; the new fix keeps all of them.

## New fix (src/sim/ai/NavGrid.ts)
Events stay exactly as before (every side effect kept). `NavGrid.setBlocker(id, wall, true)` remembers the geometry each live blocker was baked with (`blockerGeometry`: extents, player halves, nav footprint). A repeated announcement with identical geometry for a blocker already in the grid only refreshes the reference/buckets, resets `target`/`searching`, invalidates the nearest memo and returns, skipping the two `updateBlockerCells` passes (the `NavGrid.intersects` work, 333 of 390 ms in the r28 CPU profile). `revision`, reach memos and the player-route grid are handled as before. New, moved or removed blockers take the full path. Cells depend only on current state, so an unchanged blocker cannot change them. `rebake()` refills the geometry map. `NavGrid.fastReannounce` is a test hook (false = pre-r29 path).

## Equality evidence
`tests/engine/navigation.test.ts` (folded into the existing dynamic-blockers test; the test budget is 150 cases): a synthetic grid fast vs full, and on L10 and L8 (damage 80 destructibles, 200 ticks, restore, repeat, restore) every AI grid (`nav`, admission, districts, Mega) compared fast vs full: 0 differing cells, identical blocker ids (L10: 1313 per grid, L8: 429).

## Results
| check | before | after |
|---|---|---|
| L10 low/WebGL2 respawn frame, 3 deaths (tools/perf/r28-respawn.ts, port 4887) | 350, 333, 350 ms | 33, 33, 33 ms (p95 16.8, max 33) |
| native `Mission.restore` L10 | 60 ms | 17 ms |
| native `Mission.restore` L8 | 13 ms | 12 ms |
| `qa:threat` L10 skilled | complete | complete, 0 flags |
| `qa:threat` L8 skilled | complete | complete; SLOW_FOLLOWER 354/363 + FOLLOWER_WAIT = Mac baseline |

L8 browser respawn probe: not reachable (the harness times out waiting for the respawn, same as r28); L8 shares the restore code and its grid equality passes.
