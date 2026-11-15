# s118 L9 bus and hatch defence

Status: **in progress; not green**. This report records the first routing change and its native probe. The required spawn/residency behavior is still incomplete, so no completion claim or commit is made.

## Findings and change

`LevelNineDriving` previously recorded the APC's recent positions and used that trail to place and steer the pursuit bus. Because the player can take gravel and open-ground shortcuts, this made the bus leave the asphalt. The bus now uses the authored `road` polyline in `layouts/D-CROSSING/routes.json`, spawns at a point 125 m behind the APC's progress on that line, follows the asphalt toward the rail crossing, and brakes near the rail to deliver its six passengers.

The native HIGH/LOW probe is [bus-route.json](bus-route.json). On-road and corner-cut fixture cases spawned the bus and measured maximum centreline offsets of 0.53–0.56 m, with all six passengers released. The wide-detour case did not spawn in either tier because the asphalt chunk is not resident. In LOW, neither near-road case spawned in this first probe run. Those rows are failures, not excluded samples. The implementation therefore does not yet satisfy the all-path/all-tier spawn requirement.

## Validation so far

- `npm run typecheck`: passed after correcting a stale `trail` reference.
- `npm run lint`: passed.
- `node --import tsx tools/qa/s118-l9-bus-proof.ts`: failed the assertions for missing spawns in the stated rows; JSON retained as diagnostic evidence.
- `npm run qa:vehicle-campaign-motion`: browser pool startup failed because its local listener could not bind `127.0.0.1:4329` (`EPERM`). No browser was opened.
- `node --import tsx tools/qa/threat-audit.ts`: passed; L9 skilled complete, L9 passive complete, 0 passive flags (full audit: 304.0 s, 0 fail flags).
- `npm run verify -- E31`: could not start; Node `tsx` IPC listener bind failed with `EPERM` in the sandbox.
- `sh tools/remote/run.sh "$PWD" -- npm test`: not run; no healthy remote runner was available, and the command does not allow this suite in the local Mac fallback.

## Open requirements

- Coordinate road-chunk residency with the off-road APC and bus so the bus can spawn and remain on asphalt for on-road, corner-cut and wide-detour paths in both tiers.
- Measure continuous road distance for the full pursuit in all six path/tier combinations and verify the bus remains offscreen at spawn.
- Prove the delivered infected reach the hatch, first attack within 15 seconds of hatch-open, and at least three within 5 m of the APC on HIGH and LOW.
- Re-run `npm run verify -- E31` and `npm run qa:vehicle-campaign-motion` in an environment where the required local IPC/browser pool listeners can bind.
- Run the required remote unit suite when a healthy runner is available.
- Save the required committed JSON and final report with a **Browser QA needed** section.

## Browser QA needed

The bus routing, visibility, hatch attack timing and passenger proximity still need headless browser confirmation at HIGH and LOW. Browser QA was not attempted because the configured browser pool failed before launch.

## Continuation validation

Removed the missed-ram sideways velocity impulse, which independently threw the bus off asphalt. Typecheck and lint pass. The now-available remote runner completed the full unchanged `npm test` command in 210.5 seconds: 105 passed, 1 failed, 1 skipped. The failure is the L9 parked-APC bus approach assertion in `tests/engine/vehicles.test.ts:310`: closest distance 60 m versus required <13.845 m. This is a real unresolved regression of the current road-stop implementation. No commit or green-gate claim is made.

Rail braking now applies only during the unrestarted rail stall; evacuation approach restores gap-based braking. The focused `vehicles.test.ts` suite passes (2/2, 31.81 s), as do typecheck and lint. Full remote suite must be rerun after this correction. Road residency and passenger participation remain open.

## Road collision residency correction

The bus now requests collision residency for its pending asphalt spawn or current position. Chunk selection reserves that support within the existing tier budget by replacing the furthest APC prefetch chunk. The six native 30-second fixtures now all spawn and all measured centers stay within 6 m (worst 5.256 m at the return bend). HIGH/LOW wide-detour fixtures release no passengers within that window; this remains incomplete. These are stationary APC setup fixtures, not the required full pursuit driving paths or hatch participation proof. Typecheck and lint pass. Earlier missing-spawn results above are superseded by the current JSON, while full route, hatch and gate requirements remain open.

## Extended bend measurement

Extended the stationary native fixtures to 120 seconds. This exposed a 8.979 m return-bend excursion in both wide-detour cases. Reducing pursuit lookahead to 6 m and braking above 5 m/s when steering error exceeds 0.15 radians brings the worst sampled offset to 2.657 m; every sampled position in all six fixtures is within 6 m, and all six passengers release in every fixture. Typecheck and lint pass. This remains fixture evidence, not full driven pursuits or hatch attack timing/proximity qualification.

## Actual HIGH primary-road drive

Extended `l9-progress-probe.ts` with read-only bus samples and passenger attack-state transitions. The ordinary HIGH primary-road drive completes at tick 10711, first hatch opens at 5268, zero passengers reach 5 m during an open hatch, and zero passenger attack starts are observed. At hatch-open the bus is still near x281/z-330; it brakes around x374/z-252 and releases after the rail defense. The current fixed rail stop therefore delivers too late. Raw measured positions are committed in `high-driven-passengers.json`. Passenger arrival remains failed; this supersedes any implication that six disembarkations prove participation.

## Matched LOW driven measurement

The LOW primary-road native drive also completes (tick 10930), with hatch-open tick 5417, zero passenger attack starts and zero passengers within 5 m during an open hatch. Read-only geometry over the full recorded pursuit gives HIGH 237 samples, maximum asphalt distance 2.558 m; LOW 244 samples, maximum 4.983 m; zero samples outside 6 m in either drive. See `driven-summary.json` and both tier raw passenger JSON files. These complete-road drives strengthen the asphalt evidence but do not cover the required corner-cut/wide-detour driven paths. Both passenger participation gates remain failed. The bus catalog top speed is 12 m/s versus the APC road cap 18 m/s; pursuit timing must account for that gap without zombie stat changes.

## Rejected pursuit pacing trial

A mission-only bus speed share of 1.75 (21 m/s cap) released passengers before the HIGH rail hatch (first observation tick 4950, hatch 5268), but still produced zero attacks and zero within 5 m during hatch defense. L9 completed. The speed change was reverted; see `rejected-pacing-trial.json`. Earlier release alone is insufficient, so the next investigation must trace passenger pathing/targets and delivery location.

## Target handoff investigation

Found that `pursueCrossingVehicle` returned while the courier was exposed, leaving an engine scripted waypoint installed; `scriptedMovement` suppresses attacks. Working change hands that existing waypoint to ordinary courier targeting once, without resetting an already active attack each ten-tick update. Typecheck and lint pass. The initial handoff trial still completed HIGH with zero passenger participation; the final guarded handoff needs a fresh native run and regression validation before commit. Delivery timing remains unresolved.

## Guarded handoff runtime follow-up

Both the guarded handoff alone and its combination with a 1.75 bus speed share completed HIGH but still gave zero passenger attacks and zero passengers within 5 m. The combined trace shows repeated attracted states and passengers tens of metres behind during the rail hold. Speed override reverted again. See `rejected-handoff-pacing.json`; guarded handoff remains a working change, not a proven participation fix.

## Paired distance trace

Added APC pose, bus HP/stop tick and passenger target/heard/scripted fields to the existing observer. The HIGH normal-speed guarded-handoff drive completes but remains a participation failure. At tick 5280 bus (281,-330) trails APC (378,-239) by about 132 m; at tick 6180 the bus remains about 25 m away with no released passengers. Wreck tick is 6572, after the 20-second rail hold. Later passengers have target/heard IDs zero and attracted state while travelling toward the evacuation. See `target-distance-trace.json`. The next implementation must close the delivery distance before rail hold, then release and target ordinary infected without changing stats.

## Combined delivery working trial

The combined guarded target handoff + mission bus speed share1.75 + hull-distance stall braking + near-held-APC faster release improves HIGH primary-road peak passenger proximity to one within5m. L9 completes, but no passenger attack starts occur, so requirements still fail. Typecheck/lint pass. Runtime changes remain uncommitted pending correction and broader validation; see `combined-delivery-trial.json`.

## Ordinary target refresh trial

Repeated `press` while exposed did not improve the combined delivery trial: HIGH completes, peak proximity remains1, no passenger attacks. That extra target refresh was removed. Detailed earlier trace shows passengers losing HP and disappearing from the living sample during hatch fire; enough living bodies must arrive close together before combat thins them. No health/count/stat changes made. Combined delivery changes remain uncommitted and unqualified.

## Group release rejection and runtime cleanup

Grouped near-held-APC release with the combined delivery trial completes HIGH but produces zero within5m and zero attacks, worse than the staggered combined trial. Removed the grouped release, and reverted all uncommitted combined delivery/targeting/speed changes because none met participation. Runtime now matches committed asphalt fixes; diagnostic improvements/evidence remain. Passenger participation is still failed in both qualified native road runs. Full driven off-road path coverage, current full regression gates, and browser QA remain open.
