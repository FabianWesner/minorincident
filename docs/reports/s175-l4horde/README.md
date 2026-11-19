# s175-l4horde — L4 hold repair and verification

## Merged-source follow-up

Main `1b213208` was merged at `da4f1775`. The full threat audit was run in two local deterministic shards (235.8 s and 301.6 s) and merged: **0 flags**. LOW stationary is 50.15 s / 66 at breach / 52 sustained, peak living 80; HIGH is 51.08 s / 62 / 46. Remote acceptance completed all native routes, fixtures and checkpoints, but report construction failed on missing historical criterion `G-28`; its pulled receipts show LOW complete/stationary peak infected plus reservations 80/80 and living character identities 120/119, HIGH 103/130 and 162/163. The generated acceptance report was therefore not produced.

Remote `npm test` passed unchanged on rerun: 27 files, 105 passed, one skipped, 214.9 s. The first run had a 30 s combat-test timeout under load. Typecheck and lint passed after the merge. Both remote threat shards hit their 600 s budget under load; the completed local shards above cover all stages. The historical result and blocker statements below describe the earlier pre-merge checkout.

## Result

On the current checkout, the fresh native L4 acceptance run passes L4-04 and L4-06 at both qualities. LOW reaches its 80 infected cap while keeping the living character census at or below 120. LOW first breaches at 50.15 s with 66 living infected and holds at least 52 living infected in the plaza after +45 s. HIGH remains within its L4-06 thresholds: 51.08 s, 62 at breach, and 46 minimum in the plaza.

The focused source fix and this report are committed as `25bd9e75` (`fix L4 low character headroom at the horde cap`).

The overall goal is not closed. The complete threat audit on this checkout has six L6 `SLOW_FOLLOWER` flags, and current `main` has advanced to `1b213208` while this checkout is at `dca40f7a`. Merging `main` failed because this environment cannot write `.git` worktree metadata (`ORIG_HEAD`). The required remote acceptance and unit suite also could not run because no healthy remote runner is provisioned. Results below are fresh local evidence on the current checkout, not post-merge evidence.

## L4-04: scale and cap clauses

Each cell is **before → after**. “Complete / stationary” follows the two native policies. The before values are the prior main acceptance receipt; after values are from the fresh local run on this checkout.

| Clause | LOW complete | LOW stationary | HIGH complete | HIGH stationary |
|---|---:|---:|---:|---:|
| Soldiers at turn | 10 → 10 | 10 → 10 | 20 → 20 | 20 → 20 |
| Civilians at turn, excluding soldiers | 32 → 32 | 32 → 32 | 64 → 64 | 64 → 64 |
| Peak concurrent infected | 58 → 80 | 58 → 80 | 82 → 82 | 90 → 92 |
| Peak concurrent characters | 101 → 119 | 101 → 118 | 162 → 162 | 163 → 163 |
| Contiguous war observations | 11,400 ticks → 10,680 | 11,400 → 11,400 | 11,400 → 11,400 | 11,400 → 11,400 |
| Armed civilian share at turn | 50% → 50% | 50% → 50% | 45.3125% → 45.3125% | 45.3125% → 45.3125% |
| Living infected + reservations + pending turns | 73 → 80 | 73 → 80 | 103 → 103 | 130 → 129 |
| Peak living character identities | 102 → 120 | 102 → 119 | 162 → 162 | 163 → 163 |

Every measured value is within its unchanged L4-04 target. The LOW get-up admission now waits for both an infected slot and character headroom; LOW spawn admission counts the same player/companion/character identities as the acceptance observer and leaves one character slot clear for same-tick transitions. HIGH’s admission behavior remains on its prior path.

## L4-05: arrival clauses

| Clause | LOW before → after | HIGH before → after |
|---|---:|---:|
| Distinct arrival street edges (target ≥3) | 6 → 6 | 6 → 6 |
| At least three directions separated by ≥60° | pass → pass | pass → pass |
| Maximum group from one source in one tick (target ≤5) | 5 → 5 | 5 → 5 |

L4-05’s measured arrival clauses remain satisfied in both tiers. Its separate browser visual review is still open in the repository status sheet.

## L4-06: plaza hold clauses

| Clause | LOW before → after | HIGH before → after |
|---|---:|---:|
| First physical breach (allowed 30–60 s) | 50.35 s → 50.15 s | 51.08 s → 51.08 s |
| Living infected at first breach (target ≥60) | 41 → 66 | 62 → 62 |
| Minimum plaza living infected after +45 s (target ≥40) | 13 → 52 | 46 → 46 |

Fresh hold receipts contain 8,700 post-45-second samples per tier. LOW’s director count at the end is 79; the 80 infected cap is not exceeded. HIGH continues to pass.

## Corpse and validation evidence

- No corpse removal or zombie stat changes were introduced. The existing corpse persistence checks passed locally: `tests/engine/infected-ai.test.ts` and `tests/engine/spawn-director.test.ts`, 9 tests total.
- `npm run typecheck` and `npm run lint` passed after the final source edits.
- Local `npm run qa:accept -- --level L4 --skip-browser` completed both tiers and reported L4-04 and L4-06 passing. The command exits 1 for other incomplete/failing L4 clauses outside this objective.
- The full threat audit was run as two deterministic stage shards and merged. It reported six flags, all on L6 early-close exit follower speeds: `SLOW_FOLLOWER:28`, `:38`, and `:42` in both the step and phase exit views. No L4 flags were reported. This checkout does not match current main, so the audit needs to be repeated after the required merge.
- `sh tools/remote/run.sh "$PWD" --pull docs/reports/fix51-verify -- npm run qa:accept -- --level L4 --skip-browser` and `sh tools/remote/run.sh "$PWD" -- npm test` both could not start: no healthy Hetzner runner is provisioned, and the Mac fallback does not allow these commands.
- Corpse persistence checks in source include the 101-body persistence case in `tests/engine/infected-ai.test.ts` and the 750-corpse pooling case in `tests/engine/spawn-director.test.ts`.

## Remaining to close

1. Merge current `main` into this worktree; the current sandbox denies writes under `.git`, so `git merge main` could not update `ORIG_HEAD`.
2. Re-run the remote L4 acceptance, remote `npm test`, and full `qa:threat` on the merged source. The goal requires zero threat flags.
3. The generated `docs/reports/fix51-verify` artifacts and `docs/qa/acceptance-status.md` were restored before commit. After merge, rerun the fresh measurements and update this report if any values change.
