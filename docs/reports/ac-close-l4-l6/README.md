# E22–E24 acceptance closure — 2026-10-22

Starting source: `769d9f8ce`. The ten partial criteria in the 2026-10-18 sweep remain unaccepted until the evidence below proves their full scope. Historical green runs do not supersede later failures. All browser work is headless, one worker/session, on ports 4081/4082; native timing uses the shared quiet wrapper in reservations of at most twenty minutes. The local browser remains reserved for the QA lane until 09:15 UTC.

## Authorized specification clarification

The orchestrator explicitly authorized the E24-AC19 rewrite on 2026-10-22: the tunnel stress fixture must have **at least 40 infected on high and the low-tier cap of 30 on low**, each within its own tier's E18 budgets. The criterion is marked `CLARIFIED 2026-10-22 (orchestrator)`. This resolves the conflict between the old literal 40-infected requirement on both tiers and E24-AC13's low cap of 30. Survivor count, effects, quality budgets and the 50 ms breach/abandon limit are retained. `tests/perf/l6-budgets.spec.ts` already asserts these distinct population floors; fresh execution is required before acceptance.

## Criterion ledger

| Criterion | Current assessment | Required closure evidence |
| --- | --- | --- |
| E22-AC04 | Pending current proof; the corrected actual-bus probe failed all 17 configurations on Oct 16. | Corrected-bus smoothness at the unchanged 0.6 px RMS limit, plus ride/control mechanics. |
| E22-AC12 | Pending inherited visual proof. | Four Alpha moves with boundary, repeat/cooldown and restore; shared phone/occlusion bars; existing level mechanics retained. |
| E22-AC19 | Pending scored review. | Safe/war/tank/collapse A/D/G/H review, each ≥7, all must items, no P0/P1. |
| E22-AC20 | Pending current measurement; historical low turn maximum 60.7 ms exceeds literal 50 ms. | Native peak/caps and all specified beat maxima ≤50 ms, both tiers. |
| E23-AC17 | Pending current route; the Oct 15 pass predates the Oct 16 Sam→Mia failure. | Ordinary cellar→Sam→Mia→all five→shutter route, photos and zero console errors. |
| E23-AC18 | Pending scored review. | All four recognizable safe/fallen pairs, vulnerable five-person group and sunset, each ≥7, no P0/P1. |
| E23-AC19 | Newer shared fixes pass the historical three-load L5 check (+3.29% high / +5.18% low heap); fresh five-load proof remains pending. | Both backends/tiers/zoom limits, original frame/counter/draw-regression budgets, warmed heap/GPU growth ≤10%. |
| E24-AC15 | Pending pixel matrix; latest broad verification still fails the old body-box eye sampler. | Player contrast ≥3:1, body-isolated brightest red eyes and tier-correct hero shadow at both spots across backends/tiers/zooms. |
| E24-AC18 | Pending scored review and phone overlap proof. | Seven-photo route, corrected retreat composition, calm/failure/retreat/night A/D/G scores ≥7 and phone gate prompt clear of HUD. |
| E24-AC19 | Authorized clarification applied; execution pending. | High ≥40 / low 30 infected, ≥25 moving survivors, native tier budgets and ≤50 ms transitions; warmed retention ≤10%. |

## Execution record

The first remote attempt was rejected by the workspace network sandbox before any job started (SSH `Operation not permitted`, wrapper exit 69). After network access was enabled, the selected current-product unit/level run completed on runner `2.31.10.108`: **231 passed / zero failed / 2,084 excluded or skipped by the existing name filter**, exit 0, 1,929.42 seconds. This includes the continuous L1→L6 campaign with the real L5 handover and the frozen L5 balance assertions. It is a selected run, not the full unit suite. [Receipt](evidence/initial-node-summary.json), [raw JSON](evidence/initial-node.json.gz), [full log](evidence/initial-node.log.gz). The product source matches the starting commit; subsequent changes so far are documentation and acceptance instrumentation only.

Opened historical images during triage: L4 boundary-refuge high war and low collapse; L6 pickup/closed-gate backend/tier sheet; L5 vehicle-travel five-person group. They expose the intended compositions but do not close the current-tree matrix or scored review.

## Acceptance instrumentation

- `tests/e2e/acceptance/l4-alpha.spec.ts` retains the four named Scene Lab fixtures and captures before activation, impact/expiry, saved/restored cooldown and the second activation. It checks exact inside/outside charge/slam/roar boundaries, the throw pickup boundary, rejection one tick before eligibility and the next activation exactly at cooldown expiry. It preserves the same thrown corpse identity. Shared wall/resistance/damage tests remain required.
- `tests/e2e/acceptance/l6-readability.spec.ts` adds the two-spot backend/tier/zoom matrix. A with/without-crowd image pair isolates actual infected pixels from unrelated lamps and survivor bars. The **whole-body** brightest pixel still must meet the original red margin (60) and hue (330–20°) and lie at the projected emitted-eye geometry; player contrast stays ≥3:1. The old default test remains present for comparison until native evidence identifies its failed pixel.
- `tests/e2e/acceptance/l6-phone-panel.spec.ts` uses real touch contexts, both phone orientations, all three player zooms and four gate states. It asserts zero overlap with visible objective, subtitle/story, vitals, map, weapon-rack and action-button rectangles as well as the original viewport bounds.
- The existing lifecycle fixture now uses five settled loads for L5/L6/L7, begins each mission before measuring deferred residency, checks actual backend/tier and preserves the unchanged 10% heap/geometry/texture limit. The L5/L6 budget fixtures can select actual WebGPU as well as WebGL2; L6 also asserts ≥25 moving survivors and active emergency/headlamp state.
- The L7-entry browser fixture previously teleported only the courier to its corridor checkpoint while leaving the cohort at Northgate. Production correctly requires every living follower within 18 m. The fixture now stages the cohort as the existing unit checkpoint test does, with an explicit distance assertion; all checkpoint, death/restore, roster and arsenal assertions are retained.
- `MI_VERIFY_REMOTE_E2E=1` now splits E24 functional checks onto the runner as it already does for E23. Both use one local worker. Native visual/input/photo and quiet performance stages remain explicit.

Typecheck and lint have passed during preparation. These new browser checks are not yet reported as executed or accepted.

## Shared Alpha simulation proof

The current-product four-file Alpha/physical/support/L4-systems run initially had 59 passes and one stale fixture failure: `T-E07-06-alpha-melee` kicked the Alpha with player 1 and then manually assigned the soldier as its target. The shipping hit-provocation rule correctly retains the attacker for twelve seconds, so this did not exercise ordinary soldier contact. The fixture now uses fresh arenas for kick resistance and unprovoked soldier contact, explicitly verifies the player provocation, and retains every HP, reaction, 72-tick knockdown and attack-interval assertion. **All 60 now pass**, remote runner `2.28.24.66`, 8.28 seconds, exit 0. No gameplay tuning changed. [Receipt](evidence/alpha-sim-summary.json), [before](evidence/alpha-sim-before.json.gz), [after](evidence/alpha-sim-fixed.json.gz), [log](evidence/alpha-sim-fixed.log.gz).

The targeted remote `PO #21b` browser run exhausted its existing 300-second timeout in initial checkpoint reconstruction (`step(65)`), before any Sam→Mia route action. This is **not route acceptance evidence**. [Result](evidence/sam-mia-remote-before.json.gz), [log](evidence/sam-mia-remote-before.log.gz). A fresh native route is still required after 09:15 UTC.

The full `npm run test:unit -- --maxWorkers=4` remote run also completed successfully on runner `94.130.181.173`: **1,871 passed, zero failed, seven existing pending**, 348.40 seconds, exit 0. [Receipt](evidence/full-unit-summary.json), [raw JSON](evidence/full-unit.json.gz), [log](evidence/full-unit.log.gz). This run includes the updated five-load policy and verification tooling's unit coverage; it does not execute their browser measurements.

## Clarified L6 population preflight

A remote Node test mirrors the shipping perf fixture's preparation, including the real complete bot, retained dead infected, staged followers, existing deficit fill and exact final thirty ticks. Both tiers pass: **26 moving adult survivors, high 40 / low 30 infected, emergency and headlamp active**, tick 8,124. This proves population feasibility, not native performance. [High](evidence/l6-population-high.json), [low](evidence/l6-population-low.json), [test](evidence/l6-population.json.gz), [log](evidence/l6-population.log.gz).

Native L5/L6 budget instrumentation now checks the actual follow rig at 0.5× / 1× / 1.5× without advancing the paused peak population. It retains the original draw/triangle, awake-prop, hero-light, shadow-map, particle/gib/puff/chunk limits; native samples also retain per-step sim p95. L6 additionally records collected heap and requires the measurement to end in L6. These are additional gates, not accepted results. The query-gated camera test API gained an immediate zoom method solely for this matrix.

The verifier now classifies corrected-bus pixel smoothness and the new Alpha captures as native visual checks. E22/E23/E24 split-selection regression checks pass remotely (four tooling tests total), preserving one native worker and remote functional/simulation commands. [Tooling result](evidence/verify-tooling.json.gz), [log](evidence/verify-tooling.log.gz).

Remote SwiftShader visual trial: the Alpha charge case timed out at 300 s after saving its telegraph/activation captures; all four L7-entry cases timed out at 180 s in handover readiness or the `night-exit.png` capture, before the corrected corridor assertion. [Trial result](evidence/alpha-l7-remote-before.json.gz), [log](evidence/alpha-l7-remote-before.log.gz). The verifier keeps these entry/zoom screenshots and the Sam→Mia visible-guidance/click trial in its native visual stage. Their unchanged assertions and timeouts remain enforced; no result is accepted from this remote trial.

L6's original physical-input route gained periodic recent courier attack/hit diagnostics, without changing any input policy or gameplay/result assertion. These will distinguish a driver aim failure from a mission failure if the native rerun remains red.

## Phone prompt defect and correction

The fresh touch-context gate probe reproduced the defect at 390×844, frame zero, closest zoom: the prompt was clamped to (8,8), behind the health panel, with **9,632 px² overlap**. I opened the screenshot and verified the occluded title/instructions. The old placement only considered four story panels and could only move downward. [Measured failure](evidence/phone-overlap-before.json), [browser result](evidence/phone-before.json.gz), [log](evidence/phone-before.log.gz).

The replacement chooses the nearest position inside the visual viewport using free space beside, above and below visible HUD rectangles, with an 8 px gap. It considers vitals, map/weather, roster/objective, story/subtitles, weapon rack, Home/Pause and touch actions. Three Node regression tests pass, including the captured layout, sideways-only escape and viewport offsets. [Unit receipt](evidence/phone-position-unit.json.gz).

The first corrected browser run passed all **24 combinations** (two orientations × four gate states × three zooms), with zero measured HUD overlap, WebGL high on SwiftShader. I opened its closest-zoom capture and caught a remaining visual problem: the newly moved panel obscured the courier's face. The final placement and browser gate now also protect the courier body clearance used by GameView's world reveal, including portrait scale. This final extension remains under execution; the first HUD-only pass is not claimed as complete acceptance. [First pass measurements](evidence/phone-hud-first-fix.json), [result](evidence/phone-hud-first-fix.json.gz), [log](evidence/phone-hud-first-fix.log.gz).

The broader remote sim/level selection completed **194 passed / one 30-second timeout / 1,437 excluded by filter**. The timed-out file was the shotgun resistance case under four workers; all six shotgun tests then passed with one worker and the unchanged 30-second timeout (25.94 seconds for the file). Both results are retained; a focused pass does not convert the broad run to green. [Broad result](evidence/sim-level-before.json.gz), [broad log](evidence/sim-level-before.log.gz), [isolated shotgun result](evidence/shotgun-isolated.json.gz), [isolated log](evidence/shotgun-isolated.log.gz).

The full remote unit rerun after the courier-clearance fix passes **1,877 tests, zero failures, seven existing pending**, 353.04 seconds. [Result](evidence/full-unit-after-prompt.json.gz), [log](evidence/full-unit-after-prompt.log.gz). Subsequent verifier-only orchestration changes pass their five focused unit checks: the remote stage uses the required e2e wrapper/admission variables, E22 keeps separate stage receipts, and a browser failure remains red while later visual/perf stages still execute. [Tooling result](evidence/verify-tooling-complete.json.gz).

For the three full epic verifiers, temporary PATH wrappers serialize this job's local builds and all local/remote browser stages on one private lock. Native browser commands wait until **09:15 UTC before acquiring that lock**; remote Node stages may overlap. The pre-existing phone/eye trial must finish before another browser is admitted. The normal repository e2e and quiet wrappers still execute, including twenty-minute quiet reservations. The wrappers are retained verbatim for audit: [browser fence](evidence/verification-fence.sh), [admission](evidence/verification-fence-launch.sh), [build serialization](evidence/verification-fence-build.sh).

## Final remote phone / pixel trial

The final courier-aware layout passes **all 24 low-tier WebGL touch combinations** with zero HUD/courier overlap. High WebGL reached 15 zero-overlap combinations before the unchanged 300-second deadline; both WebGPU cases fail in the Linux software adapter at buffer creation, before layout measurement. These are not native backend acceptance results. I opened the final portrait/closest-zoom image: health/navigation remain clear, the courier's face and weapon remain visible, and the prompt sits on empty floor below her. [Low geometry](evidence/phone-final-remote-webgl-low.json), [high partial geometry](evidence/phone-final-remote-webgl-high.json), [trial results](evidence/phone-eyes-remote-final.json.gz), [log](evidence/phone-eyes-remote-final.log.gz).

The two WebGL-high z1 pixel probes identify actual emitted-eye maxima inside the projected eye geometry: shelter RGB **250/78/71**, red margin **172**, hue **2.35°**; tunnel **250/79/72**, margin **171**, hue **2.36°**. Tunnel player contrast is **5.7788:1**. Shelter contrast is **2.99866076:1**, literally below 3:1, so that case remains red; it is not rounded up. Native confirmation and the full matrix remain required. [Shelter](evidence/eyes-remote-webgl-high-l6-shelter-fails-z1.json), [tunnel](evidence/eyes-remote-webgl-high-l6-tunnel-retreat-z1.json).

## Runner audio prerequisite

E23's first formal remote browser check reached `loudness()` at `tools/audio/measure.ts:128` and failed because `ffmpeg` was absent on runner `2.28.24.66` (`command -v ffmpeg` returned no path). The current audio assertions and their thresholds are unchanged. The repository already depends on FFmpeg as a test CLI; it is now installed on `2.28.24.66` and `2.31.10.108`, and confirmed already installed on `94.130.181.173` (all version 6.1.1). The runner image's existing system-package list now includes that prerequisite. This changes test infrastructure, with no application/library dependency. The first failed audio result still requires fresh execution. [Runner 2.28 receipt](evidence/runner-ffmpeg-2.28.24.66.log.gz), [2.31](evidence/runner-ffmpeg-2.31.10.108.log.gz), [94.130](evidence/runner-ffmpeg-94.130.181.173.log.gz).
