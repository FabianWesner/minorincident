# Validation

## Passed

- TypeScript, lint and fresh production build.
- Final remote full unit suite: **1,517 passed, 7 skipped, zero failures** ([summary](unit.json)); nine focused geometry/ownership/see-through regressions passed.
- Browser smoke: **16/16**, including WebGPU transitions and crowd rendering.
- Scene Lab: **60/60** geometry cases, five scenes × two tiers × three zooms × WebGL2/WebGPU. Final reveal-cache pass: **12/12**. Actual backend checked; zero console errors; captures visually reviewed in [review.md](review.md).
- Native desktop E18 high horde, high/low horde budgets, L4 high, L5 high/low pass. [Native test results](native-budgets.json). Horde p95: **6.5 ms high / 11.4 ms low**; L5 p95: **11.3 ms high / 33.9 ms low** (low uses phone emulation with 4× CPU throttle).
- All eight full-level PO/street probes pass unchanged draw/triangle budgets; all 480 culling CPU samples ≤0.1 ms. [Measurements](measurements.md).

## Gates that are not green

- Native L4 low passes draw/triangle, sim and sustained-frame checks but has a **91 ms turn hitch against 80 ms**. It is not classified as a proven baseline failure; no baseline hitch comparison was run.
- Both E18 mobile L6 proxies fail before measurement: `tests/fixtures/scenarios/performance.ts` selects absent `D-MAIN` in the current L6 and reads `.origin` on undefined. No performance result exists for these proxies. Four physical/manual device cases skip as designed.
- The remote combined full unit/sim/levels run completed with **2,806 passed, 99 failed, 9 skipped** on an intermediate snapshot. The final full-unit pass resolves 97 geometry/mock failures. The isolated horde rerun passes all three tests after the combined run exceeded its 4 ms timing limit (4.746694 ms). Remaining render-free continuity failure: `T-CONT-01S`, **L2 213.033333 s > 210 s**. Full L1→L10 and L1→L9 campaigns passed. Simulation and collision source were not changed.
- Formal `npm run verify -- E18` did not pass: an initial busy-runner attempt had 11 simulation timing failures (333 passed, 2,570 skipped). A second attempt was cancelled while waiting for remote timing isolation so it would release its Mac browser reservation within 20 minutes. Native checks were then run separately. A standalone isolated remote retry also waited for both runner slots and was cancelled after about nine minutes without running tests; its result is unmeasured. See [busy checks](verify-busy-checks.json) and [busy tests](verify-busy-tests.json).

No budgets, performance limits, simulation criteria, or fixture assertions were loosened. No merge or deployment performed.
