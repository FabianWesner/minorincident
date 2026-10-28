# Smoke timing, 2026-10-28

`tools/qa/smoke.sh` now runs its six QA browser cases with two pooled workers.
The WebGL and WebGPU limit checks compile their five scenes concurrently. The
public build and its boot check still run after the QA phase, with one worker.

Measured on this Mac, through the shared browser pool, using
`E2E_PORT=3378 MI_SLUG=smoke-speed npm run test:smoke`:

| Wall time, seconds | Run 1 | Run 2 | Run 3 | Worst |
| --- | ---: | ---: | ---: | ---: |
| Before (`8ac48ff6d`) | 230.5 | 218.3 | 220.3 | 230.5 |
| After (`be681e0b0`) | 143.6 | 128.2 | 128.1 | **143.6** |

Every run passed all six QA cases and the public boot. Run 1 in each group built
both artifacts; runs 2–3 reused the existing clean-tree build cache. Timings
include collection, builds/cache restoration, browser checks and pool admission.
The enforced smoke budget remains 240 seconds; the requested target is 180.

All six runs linked 482 WebGL programs (73 crowd) and created 707 WebGPU pipelines
(78 crowd). Their complete unique layout sets match: 67 WebGL and 68 WebGPU,
including 15 crowd layouts per backend. The test sources, five scene inputs,
assertions, GPU limits and test inventory remain intact: 144/150 collected cases,
40/45 files. Only the shell worker argument and its explanatory comment changed.

## Regression injection

[over-limit.patch](over-limit.patch) splits the painted-skin flag out of its
packed crowd varying into a separately consumed `smokeSpeedOverLimit` varying.
After rebuilding QA, the existing two GPU-limit cases ran with two pooled workers.
Both failed at the crowd varying assertion: **15 received, ≤14 expected**. Each
backend compiled three unique over-limit layouts; every reported test error was
a varying-limit assertion. No limits or test assertions were modified.

The patch was reversed byte for byte. A subsequent full smoke passed in 126.4 s
with the original program counts/layouts. `npm test` passed 104 tests in 24 files
(21.6 s including collection); typecheck and lint also passed.

[measurements.json](measurements.json) retains the budget receipts, program
counts, canonical layout hashes, assertion-source hashes, injection errors and
restoration result. Its injection command plus the reversible patch reproduce
the failure; reverse the patch and rebuild QA to restore the original artifact.
