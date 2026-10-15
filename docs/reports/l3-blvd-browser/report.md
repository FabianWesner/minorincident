# l3-blvd-browser lane report

Status: **not ready to merge**. The three-hour lane produced concrete fixes, but the final-source Boulevard run finishes with **8 deaths**, exceeding the unchanged five-death limit. The checkpoint-preserving rollback passes its focused regression. No deployment or merge was performed.

See [review.md](review.md) for root causes, changes, the two genuine test-driver fixes, and visual review. Police damage remains at 50%; infected recovery and retained corpses remain enabled. No protected reference files, specifications, or staticCollision source were changed.

## Final validation

The final source was rebuilt after the checkpoint-preserving rollback; final `npm run typecheck` and `npm run lint` both passed.

- Browser: `E2E_PORT=3476 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L3.spec.ts tests/e2e/levels/objective-waypoints.spec.ts --grep 'T-E21|boom is occupied' --project=chromium --workers=2`. **Candidate before checkpoint-preserving rollback: 5 passed, 1 failed (4.4 minutes)**: the five L3 cases are 4/5; the occupied-boom case passes. Boulevard finishes with **7 deaths** against the unchanged limit of 5 (starting reproduction: 18). Five deaths are before leaving Boulevard, two at x=159 and x=154 on the approach. Commerce finishes with 2 deaths; Oak with 3. All three real-input routes pass the compound-empty, boom closure, rescue membership and hand-off assertions before the final Boulevard death assertion. The campaign L4 briefing case also passes.
- Hetzner L3: `npx vitest run tests/levels/L3.test.ts tests/levels/L3-follow.test.ts tests/levels/respawn-all-levels.test.ts tests/unit/levels/l3-static.test.ts tests/sim/controls.test.ts --maxWorkers=4` through `tools/remote/run.sh`. **Candidate result: 66 passed, 1 failed (67)**. L3-follow 18/18, all-level respawn 17/17, static 8/8 and controls 3/3 passed. Main L3 was 20/21: T-E21-18 detected first-retry removal of 10 live IDs at fallback (limit 3). A fallback-only exception still failed at the corridor checkpoint, so the first-retry standing-crowd change was rolled back for every checkpoint. The final targeted restore/recovery/repeated-retry regression run **passes 3/3** (T-E21-18 plus two retained-body cases, 92 seconds on Hetzner); a complete final 21-case rerun is not claimed.
- Hetzner unit/sim: all `tests/unit` and `tests/sim` files run with at most four workers. Command: `bash tools/remote/timing-isolated.sh npx vitest run tests/unit tests/sim --exclude tests/sim/levels/l10-arrival.test.ts --maxWorkers=4`, dispatched through `tools/remote/run.sh`. The two L10 arrival cases run separately on another runner to avoid competing with the main battery. The isolated high-quality L10 arrival case timed out at its existing 120-second timeout; low passed. **Main battery: 2487 passed, 7 skipped, zero failures (376 files passed, one skipped; 864 seconds)**. Together with the isolated arrival file: 2488 passed, 1 timed out, 7 skipped (2496 tests). This battery used the candidate before the first-retry rollback; final mission-specific retry cases were rechecked separately. An earlier full battery passed both arrival cases but failed the then-blocked HMG anchor; that anchor is corrected in final source.
- Earlier focused input validation: all 14 `input-mouse.spec.ts` browser tests passed, including the new near-foot assist regression. Controls/fast-click browser checks passed (11); new simulation controls and retained-body regressions are included in the final remote battery.
- Scene Lab: five new catalog scenes, high/low quality, zoom 1.5/1/0.5, WebGPU and WebGL2. **WebGPU 30/30 and WebGL2 30/30 passed**. Native game-camera captures additionally cover both backends, high/low, zoom 1/0.5.
- E18 timing: **2 passed, 1 failed** in one bounded quiet reservation (4.7-minute measurement batch, about 9 minutes including admission). High and low passed. Phone frame p95 failed: defence 34.7 ms, horde 34.9 ms, rescue 33.5 ms against 33.333 ms. Phone simulation p95 (5/5.6/5.1 ms), draw calls, triangles and active-count limits passed. No budget was relaxed and no quiet batch was immediately chained. The later change only restores original first-retry thinning and does not affect this god-mode measurement path.

## Evidence

Ignored local artifacts: `test-results/l3-blvd-browser/final-qa-webgpu/`, `final-qa-webgl2/`, `final-camera-webgpu/`, `final-camera-webgl2/`, plus `test-results/epics/E21/` for playthrough and performance output. Logs: `/tmp/l3-browser-final-exact.log`, `/tmp/l3-levels-final-exact.log`, `/tmp/l3-unit-sim-final-exact.log`, `/tmp/l3-unit-l10-arrival-final.log`, `/tmp/l3-final-e18.log`.

Native captures use the ordinary complete policy with god mode only for visual review. They are not evidence of survivability. All eight native captures were opened and inspected. WebGL2 and WebGPU match in composition and counts. Render capture budgets pass on both backends (high: 182–203 draws, 929326–992037 triangles; low: 153–169 draws, 303180–335527 triangles). Timing is measured separately.

## Remaining work

The unchanged real-input route remains the acceptance gate. Further work must address the Boulevard checkpoint losses and the exposed approach around x=154–170 without changing the route/death limit, removing returning corpses, or weakening police-damage rules. The complete candidate browser run has no army-compound or hand-off assertion failure; its sole failure is the Boulevard death count. Trial movement/speed/population/medkit changes were removed; original population, arrivals, speeds, recovery and medkit placements remain.

The top-level `npm run verify -- E21` orchestrator was not rerun within the time limit; the selected browser, simulation, rendering and timing commands above provide the measured scope.

Final retry checks: `/tmp/l3-checkpoint-last.log` (T-E21-18 and retained-body retry cases), `/tmp/l3-browser-last.log` (fresh-build Boulevard and occupied boom, E2E_PORT 3482). The earlier 7-death result belongs to the candidate before restoring first-retry semantics and must not be treated as a final-source survival measurement. The fresh final-source Boulevard run **finishes with 8 deaths**: seven before leaving the street, one at x=153 on the approach. Its compound-empty, closure, group and hand-off assertions pass; only the unchanged death limit fails. The occupied-boom companion case passes. Final batch: **1 passed, 1 failed, 2.9 minutes**.

Final first-retry rollback validation: T-E21-18 passed across every authored checkpoint. The updated second-retry body test retains the same assertions for surviving standing count, corpse identity, director membership and recovery timestamp; only the number of retries changes to match the reverted first-retry behavior. No pre-existing test assertion was loosened.

Remaining gates are therefore explicit: Boulevard survival is red; phone E18 frame p95 is red; the isolated L10 high arrival timed out; the entire final L3 file/full E21 orchestrator was not rerun after restoring original first-retry semantics.

## Final outcome

- Final build, typecheck, lint and diff whitespace checks pass. Worktree contains only this lane's committed changes; no merge/deploy.
- Final focused checkpoint/recovery/second-retry cases: 3 passed; final Boulevard/occupied-boom browser cases: 1 passed, 1 failed (8 deaths, limit 5).
- Five new scenes: both backend matrices 30/30; all eight native Boulevard captures inspected. Readable sidewalk and cutaways; close low-quality camera partly crops courier. No camera or LOD asset change was attempted.
- E18 high/low pass; phone frame p95 fails at up to 34.9 ms. Simulation, draw, triangle and population limits pass in that phone capture. Reservation is released; no browser or quiet jobs remain.
- Unit/sim candidate battery: 2487 passed, 7 skipped; separate L10 arrival 1 passed/1 timeout. Main L3 candidate 20/21; its checkpoint failure is fixed by the final focused rerun, but the whole final file is not rerun. Do not present the lane as all green.
