# Sol continuation, 2026-10-15

The starting source is `cd9d8e838` (pose optimization `cf2ae8b20`). The working tree was clean, including `src/assets/staticCollision.ts`. No additional renderer or simulation change has been made.

Fresh `npm run build` passes on the Mac. `sh tools/remote/run.sh "$PWD" -- sh -c 'npm run typecheck && npm run lint'` passes on Hetzner; exact output is retained in `sol-build.txt` and `sol-static-checks.txt`.

The committed-state unprofiled phone baseline was queued at 06:47:57 UTC with `E2E_PORT=3473 PERF_CONDITIONS_LOG=/tmp/sol-l3-baseline-conditions.jsonl python3 /tmp/sol-l3-bounded.py sh tools/perf/quiet-run.sh npx playwright test tests/perf/l3-budgets.spec.ts --project=chromium --workers=1 --grep phone`. The external supervisor caps the entire batch, including queue time, at 20 minutes and terminates only its own process group. No new browser measurement is available at this checkpoint.

The full unit/sim/levels suite is running on Hetzner with `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`. Final counts and browser acceptance will be recorded when available.
