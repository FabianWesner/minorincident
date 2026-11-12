# s63-l2l7regress

Fixed the L2 ambusher lifecycle, L7 completion-policy stall and slow navigation fixture. No zombie stats or acceptance thresholds changed.

## Changes

- L2 retirement previously protected only the first ten ambushers for four seconds. Later staggered arrivals could be released offscreen before reaching the market. All market ambushers now remain until they reach the market and the player leaves the existing 60 m engagement distance. The unchanged nightly census proves all 24 arrive in both tiers.
- L7's completion bot could wait forever for a distant follower before reaching the bus, preventing the existing bus boarding recovery from owning stragglers. The route now continues to the bus. A regression assertion is merged into existing L7 navigation coverage.
- The A* resumption proof uses a smaller standalone grid and reuses an already loaded actor, avoiding another maze-world load. It retains the 10-expansion per-call limit, route length over 80 cells, eventual completion and blocked-cell assertions. No timeout was raised or test case added.
- The required typecheck exposed an existing Scene Lab serialized foot trace missing derived yaw at the vertical-step metric call. The conversion now supplies yaw explicitly.

## Verification

- Exact `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0, 27 files passed, 106 tests passed/one skipped, 150/150 case budget, **192.3 s / 240 s**. A* passed under suite load in 25.559 s; focused local run was 7.88 s.
- Remote `npx vitest run --project nightly tests/qa/invariants/waves.test.ts --maxWorkers=4`: exit 0, all four tests passed. L2 market census **24 authored, 24 admitted, 24 reached in both high and low tiers**.
- Remote threat audit `--levels L2,L7`: completed in 513.8 s. **L2=0 flags; L7=5 flags**, versus supplied current-main comparison L2=0/L7=6. The sixth global flag is `PARTIAL_LEVEL_SELECTION`, since this is the requested two-level diagnostic, not a campaign-wide audit. The command exits 1 for retained acceptance flags.
- L7 skilled seeds 1–3 all complete and are valid. Seed 2 completes at **106.85 sim seconds**, hash `0d8a2d48`, replacing the baseline 1200 s timeout/hash `93c3855b`. Seed 3 completes at 104.883 s. No follower pace flags.
- Remaining L7 flags: kiting attacks below 2/min, kiting landed hits below 2/min, corridor stuck chaser, encounters stuck chaser, follower wait upper bound over 10%. These remain visible rather than weakening their checks.
- `npm run typecheck`, `npm run lint` and `git diff --check`: passed.

Raw pulled audit receipts are in `test-results/s63-threat/` (untracked evidence). The compact committed receipt records outcomes and flags. No browser QA was needed. No checks remain running; nothing was pushed or deployed.
