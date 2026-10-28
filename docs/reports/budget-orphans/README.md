# Budget collector process cleanup

Source commits on `lane/budget-orphans`: `7dba1856a`, `ede0949f6`, `1436c4c79`.
The proof runs use source commit `1436c4c79`; subsequent report changes contain evidence only.

## Cause and change

The old watchdog waited for its immediate child to exit and returned without cleaning its process group on successful exit. A wrapper could therefore leave a TERM-ignoring grandchild reparented to PID 1. Tracking descendants by parent PID at cleanup time also loses children after their parent exits. In addition, the collector used synchronous subprocess calls, so terminating the collector itself did not forward cancellation to its watchdog.

The watchdog signals its dedicated process group on normal exit, timeout and cancellation, escalates TERM to KILL after five seconds, and retains identity-checked cleanup for detached browser descendants. The collector now waits asynchronously, forwards TERM/INT/HUP to the watchdog, waits for cleanup and removes its collection directory in `finally`. Cancellation preserves the signal exit status.

The existing tools test now exercises successful wrapper exit with a leftover grandchild, collection timeout, collector termination and watchdog termination. Every invocation also asserts that its `mi-test-budget-*` collection directory was removed. Fixture cleanup targets only the PIDs recorded by that fixture. No test cases or dependencies were added: collection remains **144/150 cases, 40/45 files**.

## Quiet admission

Default pool admission and legacy quiet-run use the same process classifier. It distinguishes executable commands from scheduler text quoting commands, reports PID/CPU/elapsed time, and excludes candidates older than the admission session when they are over ten minutes old and report 0% CPU. New processes, processes started during the admission session and candidates with CPU activity continue to block. Pool-owned browser descendants are excluded separately.

The pool wrapper logs admission waits, load, blockers and ignored idle candidates; its failure message includes the configured admission cap and last conditions. Legacy admission uses the same classifier and bounds its polling delay by the remaining deadline.

## Evidence

Validated on 2026-10-28. Typecheck and lint passed. All six required command repetitions passed:

| Command | Run 1 | Run 2 | Run 3 | New Vitest/npx processes after each run |
| --- | --- | --- | --- | --- |
| `npm test` (104 tests) | 21.6 s | 26.1 s | 21.4 s | 0 / 0 / 0 |
| `npm run test:smoke` (6 QA + 1 public browser check) | 224.1 s | 179.7 s | 183.1 s | 0 / 0 / 0 |

The fresh blocker was logged by PID and admission exited 75 after **3.33 s** for a three-second cap. The subsequent normal `quiet-run.sh` command completed through exclusive pool admission in **10.70 s**, with `quiet: true`, load 2.82 and no busy processes. The lane-owned daemon then exited.

Run `python3 docs/reports/budget-orphans/evidence/prove.py` to reproduce the pre-fix watchdog leak and execute the complete proof. `--resume` continues already successful command repetitions only when the source commit is unchanged.

- [Summary and per-run process results](evidence/summary.json)
- [Before/after `ps` snapshots](evidence/ps.jsonl)
- [Reproducible proof driver](evidence/prove.py)
- Unit logs: [1](evidence/test-1.log), [2](evidence/test-2.log), [3](evidence/test-3.log)
- Smoke logs: [1](evidence/smoke-1.log), [2](evidence/smoke-2.log), [3](evidence/smoke-3.log)
- Quiet admission: [bounded wait](evidence/quiet-cap.log), [successful command](evidence/quiet-success.log), [conditions](evidence/quiet-conditions.jsonl)

The proof uses a lane-owned pool on port 4327, one headless browser worker and preview ports 4331–4333. It respects the existing machine-wide browser locks and never uses port 3300. Process snapshots compare each run with its baseline; unrelated pre-existing npm processes are recorded and left untouched. The proof driver stops its own daemon before its final snapshot.

An earlier proof process ended during a scheduler restart, taking its private pool away during the first smoke attempt. Its [smoke output](evidence/smoke-1-interrupted.log) and [pool log](evidence/pool-interrupted.log) are retained. That interrupted attempt does not count toward the required three completed smoke runs.
