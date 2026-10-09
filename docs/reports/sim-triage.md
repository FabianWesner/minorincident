# Simulation triage — 2026-10-09

Base: `436b8ed7`. Worktree/branch: `lane/sim-triage`. No deployment or merge.

The supplied task reported 20 failures but did not include the original log. The complete unmodified Mac baseline found **7 failed, 451 passed, 6 existing deferred skips** across 64 files. The complete fresh remote baseline found **10 failed, 448 passed, 6 existing deferred skips**, in **1321.83 s** on runner `2.31.51.253`. The original additional failures cannot be named or classified without their log. The reproduced failures were listed before implementation.

| Test | Class | Root cause / evidence | Fix commit |
| --- | --- | --- | --- |
| `tests/sim/npc/campaign.test.ts` / `T-E08-11-high` | Runner-perf noise | Remote p95 **4.107705 ms** exceeded 4 ms. Unmodified Mac full campaign passed all six levels; largest high-tier p95 **2.860417 ms**, budget 4 ms. Density, movement, attacks and corgi immunity passed. | None; budgets unchanged |
| `tests/sim/npc/campaign.test.ts` / `T-E08-11-low` | Runner-perf noise | Remote test exceeded its **120,000 ms** timeout (149.78 s). Unmodified Mac full campaign passed inside that timeout; largest low-tier p95 **2.083875 ms**, budget 6 ms. Density/retention and immunity passed. | None; budgets unchanged |
| `tests/sim/performance/horde.test.ts` / `T-E18-02-200` | Runner-perf noise | Remote p95 **7.031370 ms**; isolated Mac p95 **2.132917 ms**, budget 4 ms, all 600 measured ticks retain 200 living infected. | None; budgets unchanged |
| `tests/sim/ai/director.test.ts` / `T-E07-11` | Runner-perf noise | Remote p95 **7.612144 ms**; isolated Mac p95 **2.256958 ms**, budget 4 ms. A full Mac suite also misses when browser work competes for CPU. | None; budgets unchanged |
| `tests/sim/missions/campaign.test.ts` / `T-E12-07-L1` | Stale expectation after PO change | L1 now enters `result` directly after the live-input bay finale (`753e18a3`, `c5d7474c`); the old check demanded a cinematic. The one-step-per-cheat assertion remains. | `4773c4ad` |
| `tests/sim/barricades.test.ts` / `T-E26-07` | Stale expectation after PO change | Retained displaced props (`713c48cd`) recover above their current ground instead of returning home asleep. Check location, orientation, identity, health, enabled state and wake state. Expected height uses Rapier's Float32 representation, with exact equality. | `4773c4ad` |
| `tests/sim/districts.test.ts` / `T-E10-02` | Stale expectation after PO change | The open/raised bay (`c5d7474c`, `465c49e6`) is reachable with runtime compound GLB solids. The fixture used obsolete filled placement footprints. It now matches runtime solids, movable-prop exclusions, walkable supports and 0.5 m grid resolution. All compositions, tiers and seeds remain checked. | `4773c4ad` |
| `tests/sim/m1-world.test.ts` / `M1-06` | Stale expectation after PO change | Feet-on-drawn-ground (`465c49e6`) puts roots on raised sidewalks; the fixture required a universal 0.7 m height. It now checks the exact ground-supported height. All movement/idle and collision checks remain. | `4773c4ad` |
| `tests/sim/bicycle-knockoff.test.ts` / `an infected reaching a rider who has stopped also tips the bike over beside her, never elsewhere @E19` | Stale expectation after PO change | PO L1 vision-only pursuit (E19 §5.2): the spawned infected faced away from the stopped rider, outside its 90° sight cone, so it wandered. Face it toward the rider; knockoff, nearby fallen bicycle and distance checks remain. | `4773c4ad` |
| `tests/sim/ai/infected-stuck-l2.test.ts` / `L2: infected never stand frozen (single seed, 150 s)` | Real regression | A route-starved infected drops successive search probes behind the same obstacle and remains frozen **8.4 s**. The stuck watchdog now uses the existing collision-checked pocket escape to walk to a clear point before resuming goals. Same seed now has maximum unintended stop **3.2 s**, with **27/55,497** samples still >2 s (0.05%). | `3b85692f` |

Additional browser-gate failure (outside the reproduced simulation list): L3 Oak Avenue intermittently stopped after a distant checkpoint respawn. The helper's midpoint framing projected the destination onto the weapon cards: for player `(-134.53, 1.433)` and target `(-90, 28)`, the 1600×900 projection is `(929.87, 782.57)`. The failure snapshot shows the RIGHT card active with corgi lure instead of the handgun, matching the HUD's rack-cycling click handler. `0871a034` centers the destination before the real click. Route, combat, screenshot and completion assertions are unchanged. All four L3 diagnostics also passed before this correction, confirming intermittence. The corrected complete levels suite passes **19/19**; Oak completes after **six deaths**.

Final validation:

- Focused stale fixtures: **5 passed**.
- L2 stuck regression and full L1 perception/pursuit file: **16 passed**.
- Final units: **116 files, 413 passed**, including the repository static test's typecheck, lint and production build.
- Baseline browser levels: **18 passed, 1 failed** (Oak Avenue travel). Oak Avenue on the AI fix: **1 passed**, crossing the checkpoint after four deaths.
- Final full simulation: **64 files, 458 passed, 6 pre-existing deferred skips**, **767.88 s**. One worker, simulation lock and quiet-run browser reservations; unchanged perf budgets. Full-run horde-200 p95 **1.534459 ms**; chasing-200 p95 **1.758875 ms**.
- Final complete browser levels: **19 passed**, **5.5 min**, headless Chromium/Metal, two workers, port 3417, `tools/e2e-lock.sh`. Oak Avenue completes after six deaths.
- Typecheck, lint and production build: **passed**. Typecheck/lint also rerun after the browser-helper correction.

Evidence under `test-results/sim-triage/`: `focused-baseline.json`, `stale-final.json`, `ai-fixed.json`, `unit-final.json`, `remote-baseline.log`, `mac-baseline.log`, `mac-campaign.json`, `mac-horde-200.json`, `mac-horde-100.json`, `mac-chasing-200.json`, `sim-quiet-final.json`, `sim-quiet-final.log`, `mac-final-horde-200.json`, `mac-final-campaign.json`, `quiet-conditions.jsonl`, `l3-diagnostic.log`, `e2e-final.log`, `e2e-final.json`.

Validation order matters: `tests/unit/static.test.ts` rebuilds `dist`. An attempted overlapping unit/browser run caused asset 404s while the production output was replaced, and was interrupted. Final browser validation runs after units. Performance gates use `tools/perf/quiet-run.sh` to reserve both browser slots and wait for load <3, plus `tools/sim-lock.sh` with one Vitest worker.

No performance budget was raised, no test was deleted or newly skipped, no tolerance was loosened, and no spec/reference file was changed. The six skipped E27 placeholders already exist on the base commit (AC09–13, AC15).

Reproduction commands (run in this worktree; do not overlap the unit build with browser tests):

```sh
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/sim --maxWorkers=4
sh tools/sim-lock.sh npx vitest run tests/unit --maxWorkers=4
npm run typecheck
npm run lint
npm run build
sh tools/perf/quiet-run.sh sh tools/sim-lock.sh npx vitest run tests/sim --maxWorkers=1
E2E_PORT=3417 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels --project=chromium --workers=2
```

Fixes: `4773c4ad` (five stale fixtures), `3b85692f` (AI), `0871a034` (browser click framing). Generated tracked test artifacts were restored; run evidence remains in the ignored evidence directory. The original additional ten claimed failures remain unidentified without the original log; both complete reproduced baselines and the final full-suite result are recorded above.
