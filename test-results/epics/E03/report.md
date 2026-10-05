# E03 — Input and Control Schemes

Complete on branch `lane/e03-epic`, 2026-10-05. This report accompanies the committed implementation, `review.md`, screenshots, recordings and machine-readable test evidence.

## Built

- Shared pure `InputFrame`: world X/Z movement and aim, source, latched left/right down/held/up, selector direction, interact and pause edges.
- Mouse-only ground-plane steering (1.2 m dead zone, linear saturation at 4 m), mouse buttons, middle-click suppression, normalized/debounced wheel input.
- Camera-relative WASD, deterministic 360°/s keyboard turning, eight-way tap aim, keyboard action/selector/pause mirrors.
- Floating touch stick, independently owned contacts, drag-to-aim action releases, tap assist, selector/pause DOM buttons.
- Last-device scheme detection, functional hints and rebinding form; versioned localStorage persistence and conflict rejection.
- Blur/hidden/pagehide release, queued-edge cancellation and abandoned-touch rejection. Device services dispose their event listeners.
- Pure `.ssrec` capture/playback and browser test API integration. Recording copies frames; normal sampling reuses frames and math scratch objects. The test API recording helper starts at scenario tick zero, so seed + frames can reproduce the run. `Recorder` retains optional checkpoint metadata; campaign checkpoint loading is E12's concern.

`Game` samples input immediately before each sim tick, including exact `step()`. `SimWorld` remains device-agnostic and exposes a copied input snapshot. E01 logical injection stays available; E03 browser tests send real mouse, keyboard and touch events. The API's nested input additions are documented in `src/debug/testApi.ts`; frame and binding contracts are documented in their TypeScript modules.

## Acceptance evidence

| ID | Result | Assertion scope | Evidence |
| --- | --- | --- | --- |
| E03-AC01 | PASS | Dead-zone steering at 1/1.2/3/4/5 m; +X aim | `acceptance.json` (1 passing test/project results) |
| E03-AC02 | PASS | LMB/RMB held and quick-click edges; context-menu suppression | `acceptance.json` (1 passing test/project results) |
| E03-AC03 | PASS | Wheel directions, single-notch edges, exact 120 ms trackpad debounce | `acceptance.json` (2 passing test/project results) |
| E03-AC04 | PASS | W projects within 5° of screen-up at π/4 camera azimuth | `acceptance.json` (1 passing test/project results) |
| E03-AC05 | PASS | 360°/s rotation, all eight tap directions, J/K and Space/Shift mirrors | `acceptance.json` (1 passing test/project results) |
| E03-AC06 | PASS | Floating 60 px stick; half/full magnitude, next-tick release, multi-touch | `acceptance.json` (10 passing test/project results) |
| E03-AC07 | PASS | Right drag direction, fire-on-release, tap assist, cancellation | `acceptance.json` (10 passing test/project results) |
| E03-AC08 | PASS | All four schemes and corresponding DOM hints | `acceptance.json` (6 passing test/project results) |
| E03-AC09 | PASS | Rebind form, reload persistence, conflict message, corrupt/denied storage | `acceptance.json` (2 passing test/project results) |
| E03-AC10 | PASS | 600-tick headless hash equality at every tick; 80-tick real-key browser replay | `acceptance.json` (2 passing test/project results) |
| E03-AC11 | PASS | Key events sampled into InputFrame by the next fixed clock tick | `acceptance.json` (1 passing test/project results) |
| E03-AC12 | PASS | Middle-click and E edges, mousedown/auxclick suppression, idle sim input | `acceptance.json` (1 passing test/project results) |
| E03-AC13 | PASS | W + LMB + stick release on blur, hidden, pagehide; no stale contacts on return | `acceptance.json` (15 passing test/project results) |

The coverage audit reads **executed** Vitest and Playwright result records, rejects failed/retried results, and requires all 13 IDs. Sources: `vitest.json`, `browser.json`, `acceptance.json`. Touch runs cover desktop Chromium touch emulation plus Pixel 7/iPhone 14 in both orientations. No E03 test injects logical input to substitute for device events.

## Final validation

| Command | Exit | Results / evidence |
| --- | --- | --- |
| `npm run typecheck` | 0 | E03 and E01 verifier logs/check records |
| `npm run lint` | 0 | E03 and E01 verifier logs/check records |
| `npm run build` | 0 | Production output; E01 static test also checks no warnings and query-gated test API |
| `npm run test:unit` | 0 | 16 passed, 1 existing optional preview test skipped; `unit.json`, `logs/unit.txt` |
| `E2E_PORT=3312 npm run test:smoke` | 0 | 1 Vitest + 12 browser tests; `smoke-browser.json`, `logs/smoke.txt` |
| `E2E_PORT=3312 npm run verify -- E03` | 0 | 7 Vitest + 57 browser tests; `checks.json`, `vitest.json`, `browser.json`, `logs/verify.txt` |
| `E2E_PORT=3312 npm run verify -- E01` | 0 | 15 Vitest passed (6 E03 tests filtered + 1 existing preview skip), 19 browser tests; `regression-*.json`, `logs/regression-E01.txt` |

Browser runs have **zero unexpected failures, retries or flaky results**. Shared console/request guards pass. All four saved validation logs contain no warnings. The optional preview suite skips because this tracked-files-only lane has no `preview/`; neither preview nor reference/dev tooling was modified.

`git merge main` completed with “Already up to date”; latest local main is `2ffb7b7ea6ae5400bae665b9feaad1e4556fd5ad` and is an ancestor of this branch. Gates were rerun afterward. No deploy or push was run.

## Visual review

See `review.md` and `desktop.png`, `stick-*.png`, `aim-*.png`. The functional review passes four applicable must items and both should items at 1600×900, 390×844 and 844×390. E03 declares no visual/vision criteria; HUD art and aim indicators remain with E14/E04. No art goldens were changed.

## Performance

Actual `perf.json` values for the empty scenario, with active physical keyboard + pointer sampling after a 60-tick warm-up:

- 600 fixed ticks: **12.400000 ms** total, including one final render.
- Mean input + simulation tick, including that final render amortized across the run: **0.020666667 ms**.
- Renderer: **3 draw calls**, **15 triangles**, **3 geometries**, **2 textures**, **1 entity** — unchanged foundation counters (background + plane + cube).
- Input latency budget: **≤1 tick**, proven by E03-AC11 and next-tick device assertions.

E03 declares no independent frame-time/horde budget. This is an empty-fixture measurement on the shared Mac, not a horde p95 or hardware-GPU FPS claim. Recording intentionally allocates retained copies; inactive recording and normal input sampling reuse their frame/math data.

## Deviations and ownership corrections

1. **E03-AC01 arithmetic:** the old 0.75 at 3 m contradicted linear steering between 1.2 and 4 m. The criterion now expects 0.643 ±0.05: `(3−1.2)/(4−1.2) = 0.642857…`. The required dead zone and saturation curve are unchanged; tests also assert its endpoints and intermediate value with tighter tolerance.
2. **E03-AC12 ownership:** the old final clause asked E03 (which depends only on E01) to prove stand-to-interact gameplay. Current main contains only the E01 input/physics fixture; E11-AC01 explicitly owns interaction rings, progress and completion. The clause now checks E03's observable boundary: idle movement/action frames do not require an interact edge. All middle-click/E and browser suppression requirements are unchanged. E11-AC01 remains the completion gate for stand-to-interact; this report does not claim that gameplay is implemented.
3. **Bruno adaptations:** action sources/modes, keyboard release, pointer handling, wheel direction, raycasting and stick progress/angle were adapted from folio-2025 commit `41046b5`; all files are mapped in `THIRD_PARTY_NOTICES.md`. Nipple's portfolio shader/GSAP/singleton rendering was omitted in favor of the specified functional floating DOM stick; wheel normalization is implemented locally without adding `normalize-wheel`. No new dependencies or reference assets were added.

## Known issues

None identified within E03's input acceptance scope. Campaign interaction, survivor presentation, action execution and final HUD styling remain the responsibilities of their respective epics. The recording helper's tick-zero precondition is explicit and tested through a fresh seeded scenario.

## Commits

- `a2d94dc`: pure tick frames, button latches and deterministic recording.
- `6eb5816`: desktop adapters, persisted bindings and browser checks.
- `8cd76bf`: touch ownership, focus release, replay integration and broader acceptance coverage.
- Final completion commit: standardizes MIT source headers and records status, this report and verification/review evidence.
