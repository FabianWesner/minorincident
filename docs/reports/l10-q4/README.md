# L10-Q4 finale / campaign consolidation

Scope: E32-AC17–26 and AC32. The [shared AC → test table](../l10-q3/README.md#ac--tests) now includes every Q4 row; [executed cases by AC](evidence/q4-coverage.json) show passing tagged coverage for all eleven requested criteria. Changes are QA tests, traceability and runner telemetry; gameplay, pacing, assets and budgets are unchanged.

The existing S6–S9 fixtures already cover all eight installed/charged/boss-dead combinations, exact charge/radius boundaries, held interaction and console presence, early/late boss death, checkpoint heat/enemies/boss state, all-species cure, unloaded snapshots, playable ending and fresh-world ending saves. Their assertions remain intact. Q4 adds missing `@E32-AC18` / `@E32-AC19` selection tags to minigun tests and corrects heat IDs to `T-E32-19-*`; these cases previously escaped the epic verifier because it selects AC tags, not T-IDs.

`tests/levels/L10-campaign.test.ts` adds `T-E32-32`: one new seed-1 campaign save, passed from L1 through L10 using existing completion bots and real campaign completion/save adapters. No god mode, teleport, HP/loadout/mission injection, preset substitution or checkpoint jump occurs after the campaign begins. The only save writes are the ordinary handover/completion transactions, including L8's exact APC transfer and Game.saveCampaign's live L10 arsenal/world materialization. Assertions cover roster history, retained abilities, L9's mandatory axe-only reset, all fifteen L10 objectives, boss death, explicit once-only release and credits victory. Per-level timing/deaths and the final save are retained as JSON. The runner now counts release signals during the run: a credits-time query of the bounded 10,000-event log can no longer cause a false zero-release assertion. This adds QA telemetry only.

E32-AC21 follows the accepted Mega-speed decision: cruise remains 0.7× run speed, even when arrival takes longer than the old 10–40 s target. Existing production-route arrival tests verify that full charge remains blocked until the same living boss dies. No arrival or campaign pacing is tuned here.

## One-seed campaign

`T-E32-32` passes on Hetzner: **L1→L10 credits, seed 1, 61:42.033 total gameplay, one death (L4)**. L10 is **26:10.017**, zero deaths, seven regional telemetry rows, all fifteen objectives, one release signal and one completion; the final validated save has `completedLevels = 10` and the infection-cleared flag. No pacing tuning or padded waits. This is the complete policy, not calibrated newbie timing. Credits are excluded from the official gameplay timer. [Measured per-level/region reports and handover summary](evidence/campaign-seed-1.json).

| Level | Gameplay time | Deaths |
| --- | ---: | ---: |
| L1 | 2:01.917 | 0 |
| L2 | 2:12.883 | 0 |
| L3 | 5:22.817 | 0 |
| L4 | 5:05.250 | 1 |
| L5 | 2:32.500 | 0 |
| L6 | 4:32.483 | 0 |
| L7 | 9:19.367 | 0 |
| L8 | 2:17.983 | 0 |
| L9 | 2:06.817 | 0 |
| L10 | 26:10.017 | 0 |
| **Total** | **61:42.033** | **1** |

## Validation

Full unit: **1,462 passed / 7 existing skipped**, exit 0. Focused finale consolidation: **47/47 passed**, exit 0 ([test IDs/results](evidence/finale-tests.json)). Scene Lab: **12/12 WebGL + 12/12 WebGPU** rows pass after a fresh production build, including both quality tiers and zooms 1.0/0.5 (plus 1.5). E32 verifier Vitest stage: **182/182 selected tests pass**, exit 0, including the continuous campaign and smoke selection. **Final full sim + levels: 1,332 passed / 2 failed / 2 existing skipped**, exit 1. Both failures are the untouched L3 assertions below; every E32 case and all timing cases pass in this recheck ([final result](evidence/sim-levels-final.json)). The requested global full-suite green gate remains blocked by L3. The aggregate verifier was stopped while queued for its browser stage after the cumulative browser wait limit; **no complete verifier pass is claimed**. Its typecheck/lint/build/remote Vitest stages all exited 0 ([stage results](evidence/verify-checks.json)). Heavy unit, sim and `tests/levels` suites run on Hetzner, at most four Vitest workers. The initial combined sim/levels sweep uses `tools/remote/timing-isolated.sh` for the timing project. The final recheck reserves both existing runner slots for the whole command with ordered `flock`, retaining the same four-worker maximum, all test files, assertions and deadlines. Local typecheck, lint and fresh production build pass.

Browser commands use private ports 34941–34945, headless Metal and one worker. Existing `qa-l10-final-release` and `qa-l10-epilogue` scenes are already in the matrix catalog and are reused because this lane changes tests/reporting only. Each backend runs high/low × zoom 0.5/1.0/1.5; required 0.5/1.0 captures are retained below. Native performance uses `quiet-run.sh` with an outer 1,100-second process-group deadline, below the 20-minute reservation maximum.

## Full-sweep findings

The first complete `tests/sim` + `tests/levels` sweep on Hetzner exited 1: **1,325 passed / 9 failed / 2 skipped**. [All failures and original assertion messages](evidence/sim-levels-initial.json) are retained. Seven failures are wall-clock limits: director 4.127 ms, L10 assault 4.067 ms, Mega audio 4.255 ms, Mega moves 4.542 ms, zoo S2 4.387 ms and zoo S3 4.377 ms versus the unchanged 4 ms cap, plus the high production arrival scenario exceeding its 120 s test deadline. The same E32 timing cases passed in the 182-test verifier on the other runner. No timing assertion, deadline or gameplay pace was changed.

Two additional failures are in untouched L3 tests, outside this finale consolidation: `tests/levels/L3-route.test.ts:38` finds a path but it lacks the required `x > 0, z < -24` segment, and `tests/levels/ally-combat-feel.test.ts:93` records a 0.201449 mean share of fighting officers stationary for over two seconds versus `< 0.2`. These need L3 ownership; this lane does not modify that route or combat behavior. The isolated full recheck retains the same tests: **1,332 passed / these same two L3 failures / 2 skipped**, exit 1. All seven timing/timeout failures pass on the final runner, with unchanged limits. The high arrival test takes 119.82 s against its 120 s deadline, so its runner sensitivity is retained as a QA finding. [Final result](evidence/sim-levels-final.json). The initial sweep remains recorded as failed.

## Native performance / browser fairness

One native Metal WebGL high / zoom 1.0 epilogue check passed, including five warmed R1/R7 revisits: frame p95 **8.9 ms**, sim p95 **0.6 ms**, **242 draws**, **304,858 triangles**, **237.55 MB** heap, 20 detailed chunks, 14 voices and six survivors. Heap rose from 233.48 to 237.55 MB (1.74%); geometry/textures stayed 645/166 and 174 corpses persisted. Every assertion in that existing check passed. [Raw measurements](evidence/perf/epilogue-webgl-high-z1.json).

The first 1,100-second batch spent most of its lifetime queued; it released at its deadline after this one pass. After a five-minute gap, the second attempt reached admission but failed its port check because the interrupted first batch had left its private preview alive. Only the confirmed worktree-owned server was stopped. After another five-minute gap, the final attempt used a fresh port; cumulative native slot/quiet waits reached the 30-minute cutoff as it reached admission; it was stopped before any further check completed. Pending native reservations and the verifier browser stage were stopped under the lane fairness policy. [Cancellation record](evidence/perf/browser-fairness.json) and batch logs are retained in [performance evidence](evidence/perf/). No reservation lasted 20 minutes, and batches were not chained back to back.

**Unmeasured here:** the other seven native epilogue backend/tier/zoom rows, all eight active-finale native rows and the aggregate verifier browser stages. Scene Lab already passed all required high/low × 1.0/0.5 × WebGL/WebGPU visual/counter pairs. Those functional scene gates do not establish native frame time, five-cycle heap stability or input-wiring performance for the unmeasured rows. E18 release-wide signoff remains open; no test or budget is loosened.

## Visual review

Opened the game-camera contact sheets on both backends, including high/low at zoom 1.0 and 0.5. Release: courier and colored clothing remain recognizable, the yellow interaction ring/arrow disappear after release, the objective changes to exploration, and expanding pale mist overlays the ground while leaving the silhouette visible. This isolated fixture shows the release HUD around the player.

WebGL and WebGPU production epilogue: the close starting crop shows the courier over the service apron; as the camera pulls out, survivors become visible alongside pipes, spherical tanks, filtration housings and cyan lights. High quality has substantially denser mist; low quality retains a clear player silhouette and thinner haze. The final frame presents the warm “Minor Incident” title and “The outbreak is over.” over the complex. No black replacement geometry or visible stand-in mesh was observed. The scene counters independently gate zero placeholder frames, fan operation, healthy safety, bounded survivors and movement. These focused captures do not sign off whole-level art or phone readability.


| Backend / tier | Zoom 1.0 | Zoom 0.5 |
| --- | --- | --- |
| webgl / high | [sheet](evidence/webgl-epilogue-high-z1.jpg) | [sheet](evidence/webgl-epilogue-high-z0.5.jpg) |
| webgl / low | [sheet](evidence/webgl-epilogue-low-z1.jpg) | [sheet](evidence/webgl-epilogue-low-z0.5.jpg) |
| webgpu / high | [sheet](evidence/webgpu-epilogue-high-z1.jpg) | [sheet](evidence/webgpu-epilogue-high-z0.5.jpg) |
| webgpu / low | [sheet](evidence/webgpu-epilogue-low-z1.jpg) | [sheet](evidence/webgpu-epilogue-low-z0.5.jpg) |

## Limits

The complete bot is a completion policy, not a calibrated novice/human timing model. The previously unresolved 45–50-minute calibrated newbie criterion remains open; measured campaign timings are reported without changing pacing or adding idle delays. Manual WebGPU and real iOS/Android measurements remain unperformed. Headless WebGPU automation is reported separately from manual device signoff. Q5/Q6 retain full device-input and release-wide performance/vision ownership.
