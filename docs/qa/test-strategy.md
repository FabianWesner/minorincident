# Test strategy

PO 2026-10-27: "Let an agent reduce the overall number of tests by a full rewrite. We have far too much tests. Even the shorter 16m is ridiculous slow. I think we should have 3-5% of all tests and only test cover that represent game engine logic or code that is used on more than one place to avoid side effects. Also make sure the new test strategy is applied afterwards so it doesn't grow fast again."

## The rule

**Keep only tests for game-engine logic, or for code used in more than one place (to catch side effects).**

Everything else is covered elsewhere and gets no test:

| Concern | Covered by |
|---|---|
| Engine logic (sim, combat, AI, navigation, collision, spawning, save/handover, input) | `tests/engine` (per change) |
| Code shared by many levels or tools (render contracts, asset validator, sim architecture, gate tools, QA drivers) | `tests/shared`, `tests/tools` (per change) |
| "Does the game boot and draw on both backends?" | `tests/e2e` (6 browser tests, `npm run test:smoke`) |
| Can every level be finished with real handovers? | `tests/nightly/campaign.test.ts` (one seed-1 bot run L1 → credits) |
| Content ratchets over all assets/districts (LOD fidelity, decorations, seams, placement) | `tests/nightly/content-invariants.test.ts` |
| Waves, scripted scenes, accessories, load times | `tests/qa/invariants` (`npm run qa:invariants`) |
| Performance | `tests/nightly/sim-budget.test.ts`, `tests/nightly/render-budget.spec.ts` (`npm run test:perf`, quiet window) |
| Level tuning, look, feel, one scripted scene | Scene Lab (`npm run scene:catalog`, `scene:matrix`), the Opus visual QA and the PO-style QA (`docs/qa/regression-gate.md`) |

Not allowed as tests: level-specific tuning checks, numbers or pixels pinned without an engine reason, lane receipts ("AC-xx passed once"), a second test for behaviour another test already covers, perf micro-assertions, visual goldens, tests of one-off scripted scenes.

## Layout and commands

| Path | Runs | Command |
|---|---|---|
| `tests/engine/*.test.ts` | every change | `npm test` (Vitest project `default`) |
| `tests/shared/*.test.ts` | every change | `npm test` |
| `tests/tools/*.test.ts` | every change | `npm test` |
| `tests/e2e/*.spec.ts` | every change touching runtime/render | `npm run test:smoke` (builds `build:qa` first) |
| `tests/nightly/*.test.ts`, `tests/qa/invariants/*.test.ts` | nightly, once per merged batch | `npm run test:nightly` (remote: `npm run test:nightly:remote`) |
| `tests/nightly/*.spec.ts` | nightly perf window | `npm run test:perf` |
| `tests/qa/invariants` (+ browser part) | before PROD batches | `npm run qa:invariants` |

`test:unit` and `test:gate` are aliases of `npm test`. `npm run verify -- E<NN>` runs typecheck, lint and `npm test` (per-epic AC tests were lane receipts and are gone).

Helpers that tools import (not tests) live in `tests/helpers`, `tests/e2e/{fixtures,canvas-frame,console-allowlist}.ts`, `tests/fixtures/{scenarios,perf}` (the game itself imports the scenarios) and `tests/scenes` (Scene Lab specs). `tests/fixtures/reports` is the evidence archive.

## Budget (enforced)

`tools/qa/test-budget.mjs` runs inside `npm test`, `test:smoke` and `test:nightly`. It fails when

- the collected test cases (Vitest all projects + Playwright e2e/perf + invariant browser specs) exceed **150**,
- test files under `tests/` exceed **45**,
- the default run (`npm test`) takes longer than **4 min** (smoke: 4 min, nightly: 20 min).

At the rewrite (2026-10-27) the suite had 120 collected (133 run) cases in 37 files; `npm test` took 10-15 s on the Mac and 45 s on a runner.

## How to add a test

1. Ask: is this engine logic, or code used in more than one place? If it is one level, one scene, one asset or a tuning value, it does not get a test: use a Scene Lab spec (`specs/scenes`, `tests/scenes/catalog`) or the PO checklist.
2. Prefer extending an existing test in the matching file (one test per behaviour family, loops over cases inside it) over a new `test(...)`. Every loop iteration labels its assertions (`expect(x, label)`).
3. Name tests after the behaviour, not the ticket ("aim assist picks the zombie closest to the aim ray", not "Q-196 @E05-AC11"). Quote the PO finding in a comment when it motivated the test.
4. Run the real system (SimWorld scenarios, the real validator, the real lock script); avoid mocks except for devices and the DOM.
5. Stay inside the budget. If you must add, merge or delete another test in the same change. Never raise the limits in `test-budget.mjs` without a PO decision.
6. A new per-change test must keep `npm test` well under 4 min: anything slower than ~15 s belongs in `tests/nightly`.

## Regression check

The rewrite was validated by injecting representative regressions into `src/` and confirming the new suite fails (determinism, save/carry-over, aim, collision, spawn admission, GPU limits, asset contract, skinned crowd). Numbers, coverage map and injection table: [test rewrite report](../reports/test-rewrite/README.md).
