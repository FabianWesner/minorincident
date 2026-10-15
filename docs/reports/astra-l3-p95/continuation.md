# Sol continuation, 2026-10-15

The starting source is `cd9d8e838` (pose optimization `cf2ae8b20`). The working tree was clean, including `src/assets/staticCollision.ts`. No additional renderer or simulation change has been made.

Fresh `npm run build` passes on the Mac. `sh tools/remote/run.sh "$PWD" -- sh -c 'npm run typecheck && npm run lint'` passes on Hetzner; exact output is retained in `sol-build.txt` and `sol-static-checks.txt`.

The committed-state unprofiled phone baseline was queued at 06:47:57 UTC with `E2E_PORT=3473 PERF_CONDITIONS_LOG=/tmp/sol-l3-baseline-conditions.jsonl python3 /tmp/sol-l3-bounded.py sh tools/perf/quiet-run.sh npx playwright test tests/perf/l3-budgets.spec.ts --project=chromium --workers=1 --grep phone`. The external supervisor caps the entire batch, including queue time, at 20 minutes and terminates only its own process group. No new browser measurement is available at this checkpoint.

The full unit/sim/levels suite is running on Hetzner with `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`. Final counts and browser acceptance will be recorded when available.

## Browser outcome

Final WebGL2 and WebGPU matrices both passed 18/18 on the unchanged committed renderer. Actual tier/backend gates passed, all requested combinations were inspected, and eight comparable camera/weather sheets are byte-identical to the retained baseline. See `sol-review.md` and commit `8696a6de`.

The two quiet phone requests never reached preflight or launched a browser. They exited 124 and released their own process groups. Queue accounting in `sol-browser-admission.json` totals at most 1,788 seconds (29m48s), including the successful visual queue; no more browser admission is attempted under the binding 30-minute cutoff. The phone and final high/low native timing remain unmeasured; no post-continuation CPU sample was collected. Previous 34.1/32.8/32.3 ms phone figures are historical camera/weather-only measurements and do not measure the committed pose source.
