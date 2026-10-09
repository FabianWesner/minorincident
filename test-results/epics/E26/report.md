# E26 physics props and barricades report

Implementation HEAD: `08f46ba6` on `lane/e26` (baseline `cf758240`). E26 remains **in-progress**: AC02–16 pass their functional checks; AC01 passes for the 32 environment props but is incomplete under the literal every-movable-asset scope. Performance comparison is recorded below. No acceptance threshold was changed.

## Changes and commits

- `f757229e`: repaired authored physics metadata in 11 source/delivery prop GLB pairs; geometry buffers preserved. Added explicit GLTF-space collider support, regenerated physics/collision data, strict geometry/COM/mass/reference validation. Shopping cart is the specified 35 kg. Existing valid compound colliders remain intact.
- `73a8beae`: spawn reset/remove behavior, correct collider-local COM, actual kick launcher and momentum damage, delayed heavy blast release, 2 Hz displaced-prop navigation and runner detour/attack, 72-tick runner sandbag vault and cover, car bracing/checkpoint reconciliation, complete lab bot, shared Node/browser tape, Scene Lab scenarios.
- `b6eb2be2`: separate coverage meter and brace progress meter, with browser assertion.

- `08f46ba6`: clears interrupted vault state when an infected is reused from the pool, with T-E26-11b coverage.

No new dependencies or level mission logic changes. Existing PropSystem, barricade interactions, combat, navigation, vehicle, and render systems were reused.

## Acceptance criteria

| AC / test ID | Result | Evidence |
| --- | --- | --- |
| 01 / T-E26-01 | **Incomplete globally** | Strict source GLB test passes for every E26 movable environment prop: mass band, collider endpoints within 15% of visual bounds, COM inside, explosion reference lookup. Dedicated vehicles retain incompatible class bands; see `vehicle-mass-conflict.json`. |
| 02 / T-E26-02 | Pass sim/e2e/perf | 300 props, 60 ticks: zero awake and zero matrix uploads in browser. |
| 03 / T-E26-03, 03b | Pass sim | Real 35 kg cart moves forward with player velocity in 50–60% range; heavy prop remains fixed until shoulder upgrade. |
| 04 / T-E26-04 | Pass sim | Actual kick input launches cone at 6 ±0.5 m/s; >4 m/s cone deals `cause: prop` damage and knocks down runner. |
| 05 / T-E26-05 | Pass sim | Pending impulse at next tick, positive Y, exact linear distance ratio, outside-radius cone stays asleep. |
| 06 / T-E26-06, 06b | Pass sim | Real blast queues ≥250 props; awake count ≤60 and therefore ≤150, farthest frozen first. Existing 12-body ordinary cap retained. |
| 07 / T-E26-07, 07b | Pass sim | Reset to settled spawn transform asleep in one tick; remove flag disables entity/body. |
| 08 / T-E26-08 | Pass sim | Displaced dumpster nav block within 30 ticks; short detour selected, long detour attacked; loose-prop approach exercised. |
| 09 / T-E26-09, 09b | Pass sim | <80% rejected; union coverage does not double-count overlaps; 90-tick brace creates HP sum, pins props and blocks nav. |
| 10 / T-E26-10 | Pass sim | Ten runners' defined DPS and Brute 5× checked; same-tick release/impulse/nav reopen. |
| 11 / T-E26-11 | Pass sim | Runner crosses low sandbags in 72 ticks, crawler/Brute cannot; direct front bullet/projectile damage blocked, broken-cover control damages player. |
| 12 / T-E26-12 | Pass sim | 120-tick board-up gives 200 HP; each repair restores 25%; movement interrupts. |
| 13 / T-E26-13 | Pass sim | Parked car: 100% coverage, 2× current car HP, pinned body, dynamic release on break. |
| 14 / T-E26-14 | Pass sim | One-time remote seeds 1–10: two braced slots, 100 player HP, 0 versus 8 core arrivals each seed (100% reduction). Default gate remains single seed. `ab10.json`. |
| 15 / T-E26-15 | Pass sim/e2e | 3,600-tick push/kick/two-blast tape: repeated Node hashes match and Node/browser hashes match. |
| 16 / T-E26-16 | Pass visual/vision | W0/W5 scenes and catalog, game camera; ghost, actual 95% coverage bar, plank overlay, crack/shake and airborne released bench inspected. `vision-review.md`. |

## Validation

Commands use headless Metal browsers and private ports. Heavy Vitest ran remotely. No 20-seed bot gates ran.

```sh
npm run typecheck
npm run lint
npm run build
sh tools/remote/run.sh "$PWD" -- npm run test:unit -- --maxWorkers=4
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/sim/barricades.test.ts --maxWorkers=2
sh tools/remote/run.sh "$PWD" --pull test-results/epics/E26/vitest.json -- npx vitest run -t '@E26|@smoke' --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E26/vitest.json
sh tools/remote/run.sh "$PWD" --env E26_AB_SEEDS=10 -- npx vitest run tests/sim/barricades.test.ts -t T-E26-14 --maxWorkers=2
E2E_SLOTS=1 E2E_PORT=3426 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels tests/e2e/barricades.spec.ts --project=chromium --workers=2
E2E_SLOTS=2 E2E_PORT=3427 sh tools/e2e-lock.sh npx playwright test tests/e2e/barricades.spec.ts tests/e2e/levels/L4.spec.ts --project=chromium --workers=1 --grep 'T-E26|T-E22-18'
E2E_SLOTS=2 E2E_PORT=3427 sh tools/e2e-lock.sh npx playwright test --grep @smoke --workers=1
E2E_SLOTS=1 npm run scene -- specs/scenes/barricade-ui-W0.json specs/scenes/barricade-ui-W5.json --out test-results/epics/E26/visual --size 1280x720
E2E_SLOTS=2 SCENE_PORT=3427 npm run scene:catalog -- --filter 'barricade-*' --jobs 1 --size 960x540 --out test-results/epics/E26/catalog
```

Typecheck/lint/build pass. Full unit suite: **117 files, 414 tests passed**. E26 simulation file: **21 passed**. Selected E26/smoke: **29 passed, 958 skipped**. Additional props/animals/static-collision checks passed (6 + 10 + 3 tests). One-time A/B: **1 passed**. Browser levels plus E26 first run: **21 passed, 1 failed** with transient crater-asset 404s during a concurrent rebuild; stable-build rerun: **4 passed**, including that L4 playthrough and all three E26 browser tests. Browser smoke: **26 passed** across Chromium, four mobile profiles, and WebKit. Final current-HEAD E26 browser rerun: **3 passed** (zero sleeping updates, actual brace/repair/break with distinct coverage meter, Node/browser physics hash). `browser-final.json`.

Scene Lab **2/2 pass** and catalog **2/2 pass**: zero console errors, 50 draw calls, 63,754 triangles, zero static pairs/actor hits/piercing. Captures inspected and described in `vision-review.md`; evidence kept at ≤1600 px width.

`verify E26` was executed as its component stages with remote Vitest, native local browsers, and quiet timing, rather than running its heavy Vitest stage locally.

## Performance before and after

Native Apple GPU, one browser worker, `E2E_SLOTS=1`; `tools/perf/quiet-run.sh` owns both browser slots and waits for load <3 and no other headless Chrome. Baseline source is `cf758240`. Before L2/L3/E26 load 2.72; before L1 frame spots load 2.56. Quiet preflight logs and raw JSON are in `before/` and `after/`.

Baseline commands:

```sh
E2E_SLOTS=1 E2E_PORT=3426 PERF_CONDITIONS_LOG=test-results/e26-baseline-conditions.jsonl sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx playwright test tests/perf/l1-budgets.spec.ts tests/perf/l2-budgets.spec.ts tests/perf/l3-budgets.spec.ts tests/perf/barricades.spec.ts --project=chromium --workers=1
E2E_SLOTS=1 E2E_PORT=3428 PERF_CONDITIONS_LOG=test-results/epics/E26/before/l1-conditions.jsonl sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx playwright test tests/perf/l1-spots.spec.ts --config=/tmp/mi-e26-baseline/playwright.config.ts --project=chromium --workers=1
```

The separate pristine baseline build was needed because `l1-budgets.spec.ts` records draw/triangle counts only; L1 frame time uses `l1-spots.spec.ts`.

After command:

```sh
E2E_SLOTS=1 E2E_PORT=3425 PERF_CONDITIONS_LOG=test-results/epics/E26/after/conditions.jsonl sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx playwright test tests/perf/l1-budgets.spec.ts tests/perf/l1-spots.spec.ts tests/perf/l2-budgets.spec.ts tests/perf/l3-budgets.spec.ts tests/perf/barricades.spec.ts --project=chromium --workers=1
```

Baseline performance suite: **7 passed, 1 failed** (untouched L2 low gate max 50.5 ms versus 50 ms); separate L1 spots: **3 passed**. First after suite: **8 passed, 3 failed** (L2 high reveal 68.2 ms, L2 low peak p50 49.1 ms, L3 low fallback 53.5 ms). E26 stress budgets pass. Raw first-after measurements are in `after-first/`. A fresh pristine control at load 2.92 also failed L2 high reveal (64.4 ms), L2 low peak p50 (41.2 ms), and L3 low fallback (71.4 ms): **6 passed, 3 failed**. The paired current run started at load 2.69 and terminated with SIGTERM after six completed cases; its stale L2 low/L3 files were discarded and rerun separately. Completed current cases before interruption: stress high/low and all three L1 spots pass; L2 high fails reveal at 67.9 ms. The remaining three cases ran at a fresh quiet preflight load of 2.74: **1 passed, 2 failed** (L2 low peak p50 41.2 ms; L3 low fallback 52.8 ms). Together current has **6 passed, 3 failed**, matching the control case results. See `paired-before/` and `paired-after/`.

### Fresh control/current frame measurements (ms)

| Case | Pristine control p95 | Current p95 | Current sim p95 |
| --- | ---: | ---: | ---: |
| E26 stress high | 6.2 | 5.7 | 0.7 |
| E26 stress low, CPU ×4 | 10.8 | 11.6 | 2.9 |
| L1 morning | 11.0 | 12.0 | — |
| L1 accident | 11.2 | 10.2 | — |
| L1 horde | 11.9 | 13.0 | — |
| L2 high peak | 12.0 | 12.6 | 4.4 |
| L2 low peak | 54.2 | 53.2 | 30.0 |
| L3 high attack / boulevard | 10.0 / 12.4 | 9.3 / 9.0 | 3.1 |
| L3 low attack / boulevard | 36.1 / 32.1 | 31.4 / 30.9 | 14.2 |

The E26 heaviest case has 300 props, 60 awake, 30 infected and 180 barricade attacks. Current stress stays within E18 frame budgets (16.7/33.4 ms) and sim budgets (4/6 ms). Campaign no-regression is **not demonstrated**: L1 morning/horde and L2 high are slower in the fresh comparison; unchanged control measurements also drifted markedly from the original baseline. No thresholds were changed or failures suppressed. Auxiliary remote single-seed ABAB profiling (`node-profile.json`) shows populations/timelines differ after blocker interactions; it does not establish browser no-regression.

Fresh paired measurements used the same four test files, with the pristine baseline source built from `git archive cf758240` into `/tmp/mi-e26-baseline`, and public/node_modules symlinked to this lane. Metadata edits preserve mesh buffers. The control config set its webServer cwd to that pristine build and its tests to the pristine test directory:

```sh
E2E_SLOTS=1 E2E_PORT=3430 PERF_CONDITIONS_LOG=test-results/epics/E26/paired-before/conditions.jsonl sh tools/perf/quiet-run.sh npx playwright test tests/perf/barricades.spec.ts tests/perf/l1-spots.spec.ts tests/perf/l2-budgets.spec.ts tests/perf/l3-budgets.spec.ts --config=/tmp/mi-e26-baseline/playwright.config.ts --project=chromium --workers=1
E2E_SLOTS=1 E2E_PORT=3431 PERF_CONDITIONS_LOG=test-results/epics/E26/paired-after/conditions.jsonl sh tools/perf/quiet-run.sh npx playwright test tests/perf/barricades.spec.ts tests/perf/l1-spots.spec.ts tests/perf/l2-budgets.spec.ts tests/perf/l3-budgets.spec.ts --project=chromium --workers=1
```

Remaining perf and final browser commands:

```sh
E2E_SLOTS=1 E2E_PORT=3432 PERF_CONDITIONS_LOG=test-results/epics/E26/paired-after/remaining-conditions.jsonl sh tools/perf/quiet-run.sh npx playwright test tests/perf/l2-budgets.spec.ts tests/perf/l3-budgets.spec.ts --project=chromium --workers=1 --grep 'low|T-E21'
E2E_SLOTS=2 E2E_PORT=3432 sh tools/e2e-lock.sh npx playwright test tests/e2e/barricades.spec.ts --project=chromium --workers=1
```

## Deviations and remaining work

- AC01 literal global scope includes vehicle metadata whose authored physical masses exceed the concept's heavy range. Proposed clarification: apply these bands to E26 environment props; vehicles retain their E09 mass contracts. This proposal has not been applied to the acceptance table. E26 stays in-progress.
- The previous generic reset test required retaining a displaced pose, contrary to AC07. It now requires the spawn pose, asleep, with unchanged ID and HP; checkpoint pose preservation still has its own passing test.
- Baseline L2 low gate hitch already exceeded its existing limit by 0.5 ms. Fresh pristine/current controls both fail L2 high reveal, L2 low frame budget, and L3 low fallback. The campaign performance requirement remains open; no threshold was loosened.

Final report/status commit follows the implementation HEAD above. Use `git rev-parse HEAD` for the complete lane HEAD.
