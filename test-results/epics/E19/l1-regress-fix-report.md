# L1 regression fixes

Branch: `lane/l1-regress-fix`. Merged `lane/l1-regress` as requested, reviewed its WIP, retained the navigation and respawn fixes, reverted its pedestrian distribution experiment, and deleted all seven diagnostic/tmp specs. No acceptance tests, assertions, thresholds, waypoints, timeouts, god mode settings or seeds were changed.

## Root causes

**Crowd outbreak, WebGL and WebGPU:** the courier could stand about 1 cm inside the navigation grid's conservative clearance around a parked sedan while the Rapier capsule still fitted. `ControlIntent.walk` clips movement through `NavGrid.move`; the existing recovery tolerated only 2 mm, so it rejected the courier's steps along the collider margin and left her outside attack range. The replacement tries bounded clearance cuts only when the starting position already fails the normal clearance check, allowing the body to slide out. The normal radius is retried on the next move. Both unchanged crowd tests now record 2 courier strikes and zero missing figures; the WebGL run recorded 12 transformations and 6 kills, and WebGPU recorded 14 transformations and 5 kills.

**Unassisted bicycle playthrough:** after dismounting, the same disagreement between a valid capsule position and the grid margin could stop the courier's click route before the garage waypoint `(23.1, 38.289)`. The clearance recovery restores movement through the existing controller and physics sweep. The unchanged playthrough completes all five objectives with zero deaths. A separate diagnostic build restored main's original respawn selection while retaining the movement correction: both crowd tests and the unassisted playthrough still passed (3/3), isolating the movement stall as the cause of the reported failures.

## Other real fixes retained or found during validation

- Respawn selection now floods connectivity once from the objective, using separate buffers. Previously, each candidate started a budgeted A* search and an unfinished search returned false; subsequent candidates restarted it, and the fallback could select an enclosed yard. A new regression distinguishes unfinished routes from enclosed cells and checks that connectivity does not reset an active A* search.
- Corgi facing is capped against final movement after automatic braking and crowd separation. The existing braking-slide test also failed with main's original NavGrid (81 degrees versus the existing 20 degree limit), then passed with the correction.
- L4's tank-triggered fuel-truck blast now credits the tank instead of `sourceId: 1`. The full Vitest command exposed 10 player kills for an evade-only courier. The unchanged L4 evade-only test passes with the proper source, and all five L4 browser checks were rerun against the rebuilt final code.

## Validation

| Check | Result |
| --- | --- |
| Requested crowd + L1 Playwright command, Chromium, one worker | 5/5 passed |
| Full `tests/e2e/levels`, Chromium, one worker | 19/19 passed |
| L4 browser checks after kill attribution correction | 5/5 passed |
| Remote `tests/unit`, four workers | 413/413 passed, 116 files |
| Remote navigation and L1 toys regressions | 31/31 passed |
| Remote L4 evade-only regression | Passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed |
| Exact remote `npx vitest run --maxWorkers=4` audit | Stopped at orchestrator request after target validations; audit findings below |

## Broader audit findings (deploy gate deferred to orchestrator)

The orchestrator requested an immediate commit after the target browser checks passed and directed stopping long campaign audits. The unqualified Vitest run was stopped before completion. Three assertions outside the reported browser regressions also reproduce using baseline movement code (the M1 height check was compared with main's original simulation NavGrid; the prop reset and director checks used original simulation NavGrid and AgentMotion):

- `tests/sim/m1-world.test.ts`, M1-06, line 114, expects every neighbor's y to equal `0.7`. The surface grounding code gives `0.83` on a 13 cm slab (`0.7 + groundHeight`). Lowering the figure or changing the assertion would contradict the current raised-surface behavior or the requested test restrictions.
- `tests/sim/barricades.test.ts`, T-E26-07, line 25, expects a fallen prop to return to its authored home asleep. `PropSystem.postPhysics` deliberately preserves the displaced x/z and orientation and wakes the recovered prop above the ground instead. This code is unchanged by the L1 fix.
- `tests/sim/ai/director.test.ts`, T-E07-11, requires simulation p95 <= 4 ms. The four-worker audit measured 8.55 ms. An isolated one-worker rerun measured 5.96 ms with the fix and 7.49 ms with main's original movement code on the same remote host. The threshold was left unchanged; the timing failure also reproduces without this change.

Focused remote reproductions and baseline comparisons are preserved in `neighbors.log`, `neighbors-baseline.log`, `prop-reset.log`, `audit-baseline.log`, `director-perf.log` and `director-baseline.log` in the evidence directory. Before being stopped, the broad audit also reported failures in `tests/sim/bicycle-knockoff.test.ts` (stopped rider), `tests/sim/npc/campaign.test.ts` (2), `tests/sim/missions/campaign.test.ts` (3), and `tests/sim/interact/gate-lockin.test.ts` (L3 reachability). Further investigation was superseded by the orchestrator's stop instruction. The queued stopped-rider baseline comparison was invalid because its temporary module override also intercepted the layout NavGrid (`bakeNav is not a function`); it provides no baseline conclusion. The audit is not claimed green. These assertions and the corresponding game behavior were left unchanged.

Local logs and crowd JSON evidence are in `test-results/epics/E19/l1-regress-fix/`. All browser runs were headless and used `tools/e2e-lock.sh`. No deployment or merge to main was performed.
