# Sol continuation, 2026-10-15

The starting source is `cd9d8e838` (pose optimization `cf2ae8b20`). The working tree was clean, including `src/assets/staticCollision.ts`. No additional renderer or simulation change has been made.

Fresh `npm run build` passes on the Mac. `sh tools/remote/run.sh "$PWD" -- sh -c 'npm run typecheck && npm run lint'` passes on Hetzner; exact output is retained in `sol-build.txt` and `sol-static-checks.txt`.

The committed-state unprofiled phone baseline was queued at 06:47:57 UTC with `E2E_PORT=3473 PERF_CONDITIONS_LOG=/tmp/sol-l3-baseline-conditions.jsonl python3 /tmp/sol-l3-bounded.py sh tools/perf/quiet-run.sh npx playwright test tests/perf/l3-budgets.spec.ts --project=chromium --workers=1 --grep phone`. The external supervisor caps the entire batch, including queue time, at 20 minutes and terminates only its own process group. No new browser measurement is available at this checkpoint.

The full unit/sim/levels suite is running on Hetzner with `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`. Final counts and browser acceptance will be recorded when available.

## Browser outcome

Final WebGL2 and WebGPU matrices both passed 18/18 on the unchanged committed renderer. Actual tier/backend gates passed, all requested combinations were inspected, and eight comparable camera/weather sheets are byte-identical to the retained baseline. See `sol-review.md` and commit `8696a6de`.

The two quiet phone requests never reached preflight or launched a browser. They exited 124 and released their own process groups. Queue accounting in `sol-browser-admission.json` totals at most 1,788 seconds (29m48s), including the successful visual queue; no more browser admission is attempted under the binding 30-minute cutoff. The phone and final high/low native timing remain unmeasured; no post-continuation CPU sample was collected. Previous 34.1/32.8/32.3 ms phone figures are historical camera/weather-only measurements and do not measure the committed pose source.

## E21 verification attempt

`MI_VERIFY_REMOTE_SIM=1 E2E_PORT=3475 npm run verify -- E21` passed typecheck, lint and its fresh build. The remote Node phase waited for runner capacity, then queued on a runner without starting. The full unit/sim/levels run had already reproduced `T-E21-03` (newbie deaths), which blocks the same verification gate; the browser queue cutoff also precludes its later browser phase. The duplicate queued request was therefore terminated by its exact local launcher PID at 07:41 UTC, cleaning up only that detached remote job; the verifier exited 130. This is an incomplete verifier run, not a green `verify` result. Exact output and command statuses are in `sol-verify-e21.txt` and `sol-verify-e21-checks.json`.

## Final remote results

Full command: `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`. Exit 1; 429 files, 2,789 passed / 12 failed / 9 skipped, 3,179.41 seconds. Unit subset: 1,466 passed / 0 failed / 7 skipped across 247 files. The changed-renderer regressions (`pose-texture`, `footprint-uploads`, `occluder-footprint`) pass. Exact failures are retained in `sol-remote-suite.txt`, full output in `sol-remote-suite.log.gz`, and suite counts in `sol-remote-counts.json`.

The full run reproduces the L3 newbie gate (5 deaths versus <=2) and L4 tank interval (14.1167 s versus <=12.8 s). L10 full route and the L1–L9 and L6 campaigns pass. Ten other failures are timing assertions/timeouts, including the functional-project L10 campus corridor performance assertion. No simulation source is changed by this continuation.

Focused timing command: `MI_RUNNER_IP=2.28.24.66 sh tools/remote/run.sh "$PWD" -- bash tools/remote/timing-isolated.sh npx vitest run -t 'T-E31-19-S4-200|T-E32-21-E3-high|T-E08-11-high|T-E32-20-perf-200|T-E07-11-alpha-200|T-E07-11-alpha-physical-200|T-E07-11-zoo-s2-200|T-E32-11-perf-200|T-E32-21-E3b.*high' --maxWorkers=1`. Both runner slots were held for the timing project. Exit 1: 4 passed / 5 failed, 2,801 unmatched tests skipped. NPC patrol, Alpha, physical Alpha and Mega-move checks pass in isolation. Crossing residency, L10 assault, L10 dispersal, zoo specials and the high-tier L10 route-arrival timeout still fail. The separate functional-project campus-corridor timing failure was not rerun. These results do not establish a green global E18 gate. Exact assertions are in `sol-timing-recheck.txt` and full output in `sol-timing-recheck.log.gz`.

## Remaining acceptance

The committed renderer still needs an admitted, fresh-build, unprofiled quiet L3 phone run, including defence/horde/rescue; if it fails, collect a current CPU profile before another optimization. Final high/low native budgets, fallback hitch checks, browser crowd regression, smoke and the complete deploy gate remain unmeasured in this continuation. No performance improvement is inferred from the visual pass. The binding browser queue cutoff ended local browser work for this job.

## Disk cleanup

No extra baseline worktree or build copy was created in `/tmp`. Following the orchestrator's low-disk notice, removed this worktree's completed ignored `dist/` (~306 MB) and the two duplicate raw Scene Lab output directories (~88 MB). All 36 reviewed sheets, actual backend/tier gates, comparisons and reports remain committed under this directory. There was no active local preview when the generated build was removed. Rebuild before any future browser run. Temporary helper scripts and logs are deleted after preserving final evidence; remote private jobs are cleaned by `tools/remote/run.sh`.
