# fix73-b — L4 census, collapse, corpses, and L5 follower pace

Base: `5a7f84b`  
Run date: 2026-11-06  
Scope: L4-12, L4-13, L4-17, L5-08 / G-13 high-tier follower pace.

## Result

The measured L5 high G-13 pace and waiting clauses pass on the current source. L4-12, L4-13, and L5-08 remain FAIL; L4-17 remains open pending visual verification. General L4–L6 acceptance controls pass. Evidence updates and one L4-17 code candidate were committed.

The shared headless browser pool could not start in this sandbox. The pool log reported `EPERM` for its Unix socket and `listen 127.0.0.1:4329`. The prescribed slim-worktree command also failed because it could not write the linked worktree's Git config outside the workspace. An initial Git index-lock attempt also failed, though later per-row evidence and code commits succeeded.

## Rows

| Row | Result | Evidence and remaining work |
|---|---|---|
| L4-12 | Open — FAIL | Reverted six-role native routes reproduced a minimum of 3 distinct infected looks in the nearest-20 census: low 10,679 checks, hash `c3184e26`; high 10,715 checks, hash `0bef7d9f`. The first collapse window still admitted the expected 2/edge low and 3/edge high. A trial that balanced archetypes around the player did not meet the look requirement in both tiers and caused a fresh L4-06 breach-count failure plus a high stationary mission failure; that trial was reverted. |
| L4-13 | Open — FAIL | The reverted source's first collapse windows passed at low 2/2/2 (tick 12889) and high 3/3/3 (tick 12925). The prior full-route observer found later misses: low 23/56 windows and high 5/9 windows. The reverted-source native routes completed, but a sustained admission plan meeting all later quotas has not been qualified. |
| L4-17 | Open — visual evidence missing | Commit `58a3280` lowers the pile-search threshold from `feet + .45` to `feet + .05` so the layout keeps searching for ground-level placements. No approved browser capture could be made and inspected, so this is not a verified fix. Historical inspected frames reported frozen-geometry peaks of 1.746 m low and 1.920 m high. The candidate must be visually measured and checked for limbs/player occlusion before closure. |
| L5-08 / G-13 high | G-13 high pace/wait: PASS; L5-08: FAIL | Current high-tier pace ratios for follower 28 are 1.000, 0.9749, and 0.8877 across seeds 1–3, with at least 46 samples each. Only seed 3 is below 0.95, so the existing rule requiring failure in at least two of three valid seeds does not flag G-13. The measured waiting upper bound is 0%. L5-08 remains FAIL because the current acceptance receipt reports a low-tier calm straight-walk formation failure; other clauses such as rendered bars and combat pace remain unmeasured. |

## Validation

- `npm run qa:accept -- --level L4 --reuse --skip-browser`: passed general controls; both complete routes completed, stationary routes met their tick budgets, fixtures passed 10 clauses per tier, and checkpoints passed 6 clauses per tier. Result: 0 fresh failing rows and 14 incomplete rows. This does not close the manual rows above.
- Earlier in this run, `npm run qa:accept -- --reuse --skip-browser` refreshed L4–L6 after the corpse-layout candidate. L5 reported a fresh L5-08 failure; L6 had no fresh failures. L4 was rerun after reverting the roster trial.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed.
- `npm test`: failed one existing process-cleanup assertion in `tests/tools/test-budget-tools.test.ts` (`successful wrapper still cleans its process group`; expected exit 0, received 1). Other reported tests passed.
- `npm run qa:threat`: completed alone with load below 6; final audit reported 0 acceptance fail flags. L4 high hold census: complete, 65 living at first breach, peak 93, minimum plaza population after 45 seconds 54, and all six arrival edges observed.

No raw visual captures were produced, so there were no new captures to delete. Key commits: `f5ef383` (L4-12), `2c24a1d` (L4-13), `80b5185` (high G-13 evidence), `ba3783d` (corrected high G-13 verdict and report), `58a3280` (L4-17 candidate), and `8030072` (L4–L6 acceptance receipts). The initial report commit was `823fd89`. Existing review text in the acceptance JSON remains historical and should be reconciled when the required visual evidence is available.

## Follow-up

Retry with the prescribed shared browser pool. Inspect every captured frame, refresh evidence and statuses for each row, run the full required group gates after accepted game changes, remove raw captures, and commit each accepted fix separately. Do not treat the corpse threshold candidate as closed without visual measurement. The discarded player-centered roster trial is not included in the commits.
