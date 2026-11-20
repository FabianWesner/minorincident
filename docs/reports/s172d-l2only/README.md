# s172d-l2only — L2 forecourt reach fix

Source: only `src/levels/L2/layout.ts` and `src/sim/missions/LevelTwoRescue.ts` from s172b commit `285ad6c9` were applied. No L8 source, tooling, zombie-stat, corpse-removal, or teleport changes are included.

## L2 rows: before → after

The before values below are the fresh-main/native comparison recorded in `s172b-l2l8` (base `0e3db71b`); after values are its matched candidate receipts, with local reruns on this worktree noted where available. This worktree is based on newer main `cd8ddcd0`, so these are historical comparison data, not a current fresh-main comparison. A current remote baseline and candidate comparison remains open.

| Row | Before → after | Current local candidate evidence |
|---|---|---|
| L2-01 | NOT CHECKED → NOT CHECKED | Not changed by this fix; browser/PO clauses remain unverified. |
| L2-02 | NOT CHECKED → NOT CHECKED | No changed clause reported. |
| L2-03 | NOT CHECKED → NOT CHECKED | No changed clause reported. |
| L2-04 | PASS → PASS; LOW doors tick 3226 → 3472 | Current local run remains PASS; all four native event-order checks pass. |
| L2-05 | NOT CHECKED → NOT CHECKED | No changed clause reported. |
| L2-06 | NOT CHECKED → NOT CHECKED | Available admission clauses pass; aggregate remains incomplete. |
| L2-07 | FAIL → PASS; bounded reach LOW complete/stationary 95.24/88.89% → 100/95.83%; HIGH 100/92.11% → 95.65/94.12% | Local LOW/HIGH acceptance: zero fresh failing rows; all four reach values ≥90%. |
| L2-08 | NOT CHECKED → NOT CHECKED; HIGH rescue census at 60/120 s 47/45 → 40/37 | Available clauses remain passing; aggregate incomplete. |
| L2-09 | NOT CHECKED → NOT CHECKED; HIGH first death 78.53 → 108.23 s | Available clauses remain passing; aggregate incomplete. |
| L2-10 | NOT CHECKED → NOT CHECKED | No changed clause reported. |
| L2-11 | NOT CHECKED → NOT CHECKED; fixture changed to LOW escape area 25, groups 3→4, chasing 11.11→11.54%, six singles; HIGH area 34→33, groups 4, chasing 12.96→3.64%, six singles | Current local fixture and all four checkpoint cases pass on both tiers; controls identical. |
| L2-12 | PASS → PASS; LOW complete attack rate 21.93 → 14.24/min | Current local aggregate PASS; HIGH complete is 14.12/min. |
| L2-13 | NOT CHECKED → NOT CHECKED | No changed clause reported. |
| L2-14 | NOT CHECKED → NOT CHECKED; LOW admitted cluster 12 → 13 | Available clause remains passing; aggregate incomplete. |
| L2-15 | NOT CHECKED → NOT CHECKED | No changed clause reported. |
| L2-16 | NOT CHECKED → NOT CHECKED | Visual/PO review not rerun. |

`NOT CHECKED` aggregate labels mean other required clauses are absent; they do not mean the listed measured clauses failed. Current local acceptance exit 2 reflects 16 incomplete rows (LOW) and 13 incomplete rows (HIGH), with zero fresh failing rows in either tier. Browser clauses were skipped.

## Validation and open gates

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Local `npm run qa:accept -- --level L2 --tier low --skip-browser`: L2-07 PASS; 27 fixture clauses and four checkpoints without errors; aggregate 0 fresh failing / 16 incomplete.
- Local `npm run qa:accept -- --level L2 --tier high --skip-browser`: L2-07 PASS; 27 fixture clauses and four checkpoints without errors; aggregate 0 fresh failing / 13 incomplete.
- Remote acceptance could not start: `tools/remote/run.sh` reported no healthy Hetzner runner and that this command is ineligible for the local Mac fallback.
- Full local `npm run qa:threat` exceeded its unchanged 600-second budget (600.6 s) and ended during the run; no complete zero-flag result exists.
- Local `npm test` completed in 201.8 s: 26 files passed, one failed; 105 tests passed, one failed, one skipped. Failure: `tests/engine/l4-contact.test.ts` / `checkOutsideWireRouting`, with two real LOW perimeter actors stopped. The required remote suite and isolated remote L4 rerun could not be started because no runner was available.
- No current fresh-main vs candidate all-row comparison, remote L2 acceptance, remote unit pass, or complete zero-flag threat result is established.

This report records available evidence; it does not claim blocked remote gates or incomplete aggregate rows are satisfied.

## Remote retry

The runner became available on November 20. Remote LOW and HIGH `qa:accept -- --level L2 --tier <tier> --skip-browser` each completed their native routes, 27 fixture clauses and four checkpoints with identical control and no errors; each aggregate reported zero fresh failing rows and 16 incomplete rows (exit 2). The commitless runner checkout emitted Git provenance errors. These runs did not retain the remote reports, so they do not independently establish per-row reach values or a fresh-main comparison. Remote unit and full threat gates remain open.

Remote unchanged `sh tools/remote/run.sh "$PWD" -- npm test` subsequently passed on committed source `f8323463`: 27 files, 105 tests passed and one skipped, 228.8 s within the 240 s budget. This includes a passing `tests/engine/l4-contact.test.ts` on the remote runner. The earlier local L4 failure remains recorded above.

Remote full `npm run qa:threat` on source `1f56082d` timed out at 600.8 s (exit 124 inside the budget wrapper; remote wrapper exit 1). Several stages remained queued, so no complete audit or flag count was produced. The full zero-flag gate remains open.

## Fresh baseline comparison

Remote split-tier `qa:accept --level L2 --tier low|high --skip-browser` was rerun against exact parent `cd8ddcd0` and candidate `01c5812d`, with reports pulled. Baseline LOW reported two failing rows and 14 incomplete; candidate LOW zero failing and 16 incomplete. Baseline HIGH reported two failing and 12 incomplete; candidate HIGH zero failing and 13 incomplete. All runs had 27 fixture clauses and four checkpoints without errors, identical control, and commitless-runner Git provenance errors. Comparing checks by tier, policy and clause yielded 63 matched LOW checks and 103 matched HIGH checks, with no missing baseline checks and no PASS → FAIL changes. Split-tier aggregate statuses do not qualify missing browser and other clauses.

Current parent → candidate bounded reach: LOW complete 95.24 → 100%, stationary 88.89 → 95.83%; HIGH complete 100 → 95.65%, stationary 92.11 → 94.12%. In the combined HIGH report L2-07 is FAIL → PASS; L2-04 and L2-12 remain PASS; L2-14 is FAIL → NOT CHECKED; all remaining rows are NOT CHECKED → NOT CHECKED. L2-14's incomplete candidate status does not establish its full row passes. The zero-flag full threat gate remains open.
