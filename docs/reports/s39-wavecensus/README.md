# s39-wavecensus

## Finding

The zero L7/L8 counts came from census setup that never reached the production spawn gates; source inspection does not support a gameplay diagnosis of missing cohorts.

- **L7:** `LevelSevenEncounters.start()` calls `prepare()` and directly spawns opening group 701, but the test then only entered its director-drain loop while `director.queue.length` was already nonzero. It never called `c.update()`, which both detects the road thresholds for later cohorts and records active production arrivals in `state.arrivals`. The test therefore observed an empty ledger by construction. The census now moves the courier across the authored thresholds, ticks the mission controller and director, and drains admitted batches without changing group-count or goal-area assertions.
- **L8:** the test advanced to `startedAt + 3600` while `guideDone` was still 0. `calmTicks()` returns 7200 ticks for an unresolved guide, so `update()` correctly did not breach the zoo or release tunnel arrivals at 60 seconds. The test now sets `guideDone = 1`, representing the guide-aborted branch whose production calm duration is 3600 ticks, then keeps the real breach, outlet releases, movement, and goal-area assertions.

## Verification

- Read `docs/process/lessons-learned.md` and traced the relevant controller, director, and tunnel-emergence paths in `src/sim/missions/LevelSevenEncounters.ts`, `src/sim/missions/LevelEightZoo.ts`, and `src/sim/outbreak/HouseEmergence.ts`.
- Required `sh tools/ops/slim-worktree.sh "$PWD" --no-assets` was attempted first, but the script could not lock shared Git worktree config at `/Users/wesner/Workspace/minorincident/.git/worktrees/s39-wavecensus/config.worktree` (`Operation not permitted`).
- Requested nightly command `sh tools/remote/run.sh "$PWD" -- npx vitest run --project nightly tests/qa/invariants/waves.test.ts` did not execute: runner reported no healthy Hetzner runner and rejected Mac fallback for this command.
- `sh tools/remote/scale.sh add` could not provision a runner because the sandbox could not resolve the remote API hostname (`nodename nor servname provided, or not known`).

The corrected nightly census remains unverified until a healthy remote runner is available. No gameplay or AI code was changed.

## Executed diagnosis (2026-11-11)

After sandbox access was restored, slimming succeeded and the exact requested remote command completed on 94.130.181.173 (job `/srv/mi/jobs/s39-wavecensus-706337-22601-1794398138`, exit 1, 41.13 s). Both L4 tests passed; both census tests failed with the assertions preserved.

| Cohort | High actual / assertion | Low actual / assertion |
| --- | --- | --- |
| L7 700 | 122 / 122 | 62 / 62 |
| L7 701 | 21 / 71 | 21 / 36 |
| L7 702 | 36 / 71 | 36 / 36 |
| L7 703 | 35 / 70 | 35 / 35 |
| L7 704 | 36 / 71 | 36 / 36 |
| L8 initial outlets 0–5 | 6, 0, 7, 6, 5, 5 | 3, 0, 4, 3, 3, 3 |
| L8 sustaining outlets 0–5 | 1, 0, 0, 1, 0, 0 | 1, 0, 0, 1, 0, 0 |

Every admitted identity in this table reached its asserted goal area. L1/L2/L3/L6/L10 also matched all census counts and goals.

### Which cohorts actually do not spawn, and why

- **L7:** none of the measured groups is zero after driving the controller. The smaller counts are explicit current production quotas: `prepare()` authors 20 runners + one Alpha for 701; `advanceEncounters()` authors 35 runners for each of 702–704, with Alphas on 702 and 704. Extra ranks have separate pack IDs: 705 holds 15 low / 50 high runners; high-only packs 712–714 hold 35 each. The old assertions assign those populations to the original pack IDs and also omit the newer packs. Do not treat the original empty ledger as missing gameplay spawns.
- **L8 initial outlet 1 (east):** genuinely zero in this scenario on both tiers. The breach loop tests the outlet goal's nav connectivity to the courier with the current route gates closed and skips outlets 0–3 when no path exists. Outlet 1 is the only first-four outlet skipped in this run. `prepare()` checks connectivity before closing the route cells, so its successful initialization does not imply this later gate passes. East-region entry is a separate trigger (`regionOutlets(4, 1)`) after sealing.
- **L8 sustaining outlets 1, 2, 4, 5:** genuinely zero in this stationary south-region scenario on both tiers. The timer calls `regionOutlets(here, i)` rather than releasing one from every outlet. South region 2 selects only 0 and 3; north region 1 selects 2, east region 4 selects 1, plaza region 8 selects 4 and 5. No later region traversal is driven by this fixture.
- **L8 initial outlets 4 and 5:** high-tier count is explicitly 5 each in the breach loop, rather than the census's 6; low remains 3. These are plaza hatches. The extra K9 at outlet 2 accounts for its 7 high / 4 low actual count.

This is a precise scenario diagnosis, not a green census claim. Making this census green with full authored coverage requires measuring the split L7 packs and driving the sealed L8 route regions, rather than lowering existing count assertions. No gameplay changes were made. The prior verification-blocker notes above describe the first attempt and were resolved for this run.
