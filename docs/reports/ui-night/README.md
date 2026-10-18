# ui-night: interaction bounds and night threats

**Acceptance is incomplete.** Browser admission reached the binding fairness cap; the remaining checks below are unmeasured. This is an implementation/evidence handoff, not an epic closure.

The coverage/brace/repair prompt now measures its final wrapped content before clamping its translated box to the visual viewport, with an 8 CSS pixel inset and responsive maximum dimensions. This also covers the L6 service gate's one-bar explanation. Coverage, interaction eligibility, damage, break and gate mechanics are unchanged.

Crowd clothing receives a modest diffuse moon bounce, with the previous Fresnel rim reduced to one quarter. The audit's almost-black surfaces and pale internal seams become continuous colored bodies. Both regular infected and infected pedestrians use this shading. Player aura, practical lights, eye emission and the driven vehicle's existing hero rim retain their independent controls. No geometry, assets, draw-count budgets or pixel thresholds were changed.

The old E25 eye fixture simulated 90 ticks after spawning: AI turned toward the courier and away from the camera. Moving its spawns behind the courier was also invalid: they moved into a lit sidewalk and the sampling rectangles included unrelated bright surfaces. The final fixture warms the camera first, then draws the same three production idle spawns facing the camera without simulating a chase. Red dominance >=60, hue 330–20 degrees, player contrast >=3:1 and the >800 player-pixel requirement remain unchanged. The test now checks both actual backends and both quality tiers.

Seven `ui-night-*` entries in `tests/scenes/catalog/` cover W0/W5 damage/break, the production L6 gate, four threat facings and storm/fog/snow. Weather QA places the threat beside the courier so close zoom contains the whole figure. The original weather-lab fixtures and their pixel checks remain in `tests/visual/weather.spec.ts`; the original six mood checks now also run on both backends and tiers.

`tests/e2e/interaction-viewport.spec.ts` checks actual DOM bounds at zoom 0.5/1/1.5 and 1600×900, 390×844, 844×390. Each backend/tier covers coverage, intact/full (prompt correctly hidden), damaged/repair, airborne break and the L6 gate. Captures include the DOM prompt, unlike canvas-only shots.

## Visual review

Opened the audit fog frame, enlarged its threat, the same production fog scene after shading changes, the four-facing diagnostic and initial WebGL catalog sheets. [Fog comparison](fog-detail-comparison.jpg), [full fog capture](fog-after.png), [camera-facing diagnostic](facing-after.png).

The audit body's blue-white seams dominate almost-black clothing. Afterward the shirt, trousers and shoes are filled surfaces, the ash-green arms are distinct, and the rim is subordinate. Four facings establish that hats/heads can physically hide eyes from an elevated rear view; this is not repaired by making eyes shine through geometry. The close weather sheets include a complete moving threat throughout fog, snowfall and storm rain. The courier stays identifiable; warm lamp/window/car pools, colored shadows, wet surface sheen, fog and flakes remain visible. The W0 close sheet shows a complete prompt below the top inset, the ghost line, planks and post-break bench motion. Opened all six retained WebGL review montages: [high 0.5](review-webgl-high-z0.5.jpg), [high 1](review-webgl-high-z1.jpg), [high 1.5](review-webgl-high-z1.5.jpg), [low 0.5](review-webgl-low-z0.5.jpg), [low 1](review-webgl-low-z1.jpg), [low 1.5](review-webgl-low-z1.5.jpg). They show implementation-stage captures, including the initial L6 fixture. Captures precede the final separation of crowd fill from the vehicle rim and the visual-viewport maximum-size refinement. The final expanded L6 closure/damage/break scene has not executed.

## Validation

| Check | Result |
| --- | --- |
| Typecheck, lint, fresh production build | pass; final runtime changes were built by the E25 verifier |
| Full Hetzner unit run, <=4 workers | 1,584 passed, seven skipped, one failure: unchanged E29-AC01 traceability; [summary](unit-summary.txt) |
| E25 selected Node + smoke assertions, remote, one worker | 32 passed / zero failed; [results](E25-node.json) |
| Initial WebGL catalog, both tiers, zoom 0.5/1/1.5 | 42/42 numeric gates pass; [rows](catalog-webgl2.json) |
| Refined WebGL storm/fog/snow catalog, same matrix | 18/18 numeric gates pass; [rows](catalog-webgl2-weather.json) |
| Original eye probe, before fixture repair | reproduced failure: red dominance -59; [log](eye.log.gz) |
| Rejected northwest-spawn experiment | all four backend/tier cases fail: sampling includes bright sidewalk/lamp surfaces; [log](eye-fixed.log.gz) |
| First viewport test | correctly found hidden full-health repair prompt; expectation corrected afterward; [log](panels.log.gz) |
| Final corrected eye/viewport/weather regression set | unmeasured: cancelled at fairness cap |
| Final WebGPU matrix, phone bounds, expanded L6 states | unmeasured: cancelled at fairness cap |
| Native E18 budgets | unmeasured; no quiet reservation acquired, no budget pass claimed |
| Full sim + tests/levels on Hetzner | still active at handoff; initial shared-runner E18 timing assertions fail; [partial log](sim-snapshot.log.gz) |
| Isolated sim performance repeat on Hetzner | waiting for both runner slots at handoff; [partial log](sim-perf-isolated-snapshot.log.gz) |

`MI_VERIFY_REMOTE_SIM=1 E2E_PORT=4499 SCENE_PORT=4500 npm run verify -- E25` passed typecheck/lint/build and its 32 Node assertions; it was terminated as its Mac browser phase queued. E26/E28 full verifier repeats and the deploy-gate browser battery have not run. No epic status was changed.

The [fairness record](fairness-stop.json) conservatively accounts for **1,932 seconds (>32 minutes)** of cumulative browser admission wait, excluding several completed queues and startup allowances. Both final queued browser groups and the verifier were stopped. No quiet reservation was held, no batches were chained and no other lane's processes were stopped. Source of the stop is the job's binding 30-minute browser-slot rule.

The full sim/levels command continues through `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/sim tests/levels --maxWorkers=4`, with live local output `/tmp/ui-night-sim.log`. The isolated repeat uses `bash tools/remote/timing-isolated.sh npx vitest run tests/sim/performance --maxWorkers=1`, with live output `/tmp/ui-night-sim-perf-isolated.log`. These are authorized remote runs; neither is a claimed pass. The retained logs are snapshots, not final results.

## Remaining acceptance work

After browser capacity is available, repeat the final three-file browser set (`e25-lighting`, `interaction-viewport`, `weather`) and `scene:catalog -- --matrix --filter 'ui-night-*'` on WebGL2/WebGPU after a fresh build. Inspect both tiers and all three zooms, including phone portrait/landscape and the expanded L6 states. Run native lighting/weather/barricade E18 gates through one bounded quiet batch (<=19 min including queue), release it, and report unmeasured work if admission exceeds the fairness cap. Keep all pixel thresholds and budgets unchanged. Collect the final remote sim/levels and isolated timing results before claiming E18 closure.

No specs, budgets, protected reference trees, collision source, dependencies, deploy or merge were changed.
