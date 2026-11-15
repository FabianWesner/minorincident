# s118 L9 bus and hatch defence

Status: **in progress; not green**. Runtime fixes and diagnostic evidence are committed on this lane; no push, deploy or main movement.

## Current verdict

- **Asphalt native samples pass:** all three driven APC paths (road, corner cuts, wide countryside detour) on HIGH+LOW complete L9, with100% half-second bus samples within6m. Worst4.885m. See [six-driven-paths.json](six-driven-paths.json). No authored asphalt exceptions claimed. Spawn screen visibility is not yet proven, and half-second sampling does not establish every simulation tick.
- **Passenger participation fails:** exact bus passenger windup events are absent in all six drives; peak living passengers within5m during hatch-open is0 or1, below3. First attack within15s is therefore unproven/failed. Passenger stats were not tuned; unsuccessful delivery trials were reverted.
- **Vehicle motion gate fails HIGH:** fresh headless browser L9 subset has stable source, LOW pass, HIGH fail due zero hatch contacts. See [browser-l9-motion.json](browser-l9-motion.json). Full campaign gate remains unqualified.
- **Focused vehicle tests pass:**2/2 after nearest-road projection correction. Typecheck/lint pass after lifecycle guard. Full remote suite previously failed the parked-APC assertion before its correction; a current full remote run remains required. Earlier threat audit had0 flags, but predates later runtime fixes and needs rerun.
- **Remaining work:** fix physical passenger delivery/arrival and targeting; prove HIGH+LOW hatch thresholds; verify offscreen spawn and continuous tick asphalt invariant; rerun full remote suite, E31 verification, vehicle campaign motion and L9 threat audit on final runtime.

The sections below retain historical trials and intermediate failures. Later current verdicts supersede earlier observations.

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

## Current focused regression recheck

On current committed asphalt runtime, focused `vehicles.test.ts` fails the parked-APC bus approach: closest X gap43.970642m versus required<13.845m (1passed/1failed). Earlier focused success preceded later bend steering changes and is superseded. Gate remains red. Added read-only passenger `telegraph` event observation for exact attack windup starts with attack/target IDs; typecheck/lint pass. No fresh windup-event runtime receipt yet.

## Road projection correction

Bus steering now projects the actual bus position onto the nearest authored asphalt segment before advancing its lookahead. This fixes the off-road initial-pose parked-APC regression without changing its threshold: focused vehicles2/2 pass (29.93s). Typecheck/lint pass. All six120-second native fixtures spawn and remain within6m (worst2.526m), releasing six passengers. JSON refreshed. Full driven pursuits, hatch participation and broader gates still need completion.

## Current projection runtime native drives

Fresh HIGH primary-road and LOW road-detour (corner-cut) ordinary drives both complete. Exact telegraph windup observer records zero bus passenger windups in each; peak hatch proximity is0 HIGH and1 LOW. Current asphalt distances and sample counts are in `current-driven-checks.json`. Participation remains failed, and full six driven path/tier coverage is not yet complete.

## Earlier entry trial

Moving bus entry threshold from APC x110 to x-100, retaining125m asphalt setback and ordinary bus speed, still completes HIGH with zero exact passenger windups and zero within5m. First visible-bus sample2490, hatch5309. Trial reverted. Earlier entry alone does not overcome relative speed/delivery geometry. See `rejected-earlier-entry.json`.

## Wide off-road APC driven coverage

Ordinary primary countryside drives (APC travels far north of the bus asphalt) complete in HIGH and LOW. LOW242 samples/max2.546m, HIGH238 samples/max2.546m; zero bus samples outside6m. Both exact windup sets empty, peak hatch proximity0. See `wide-driven-checks.json`. This expands real native path coverage but preserves the failed passenger requirement.

## Six native driven paths consolidated

`six-driven-paths.json` contains measured bus positions every30ticks through completion for road, corner-cut road detour, and wide countryside APC drives on HIGH+LOW. All6 complete;100% sampled centers within6m, no authored exceptions. Worst4.885m LOW road. Exact passenger windups empty for every row; peak within5m is1 on corner-cut rows and0 elsewhere. This proves sampled asphalt adherence for the requested three native driving paths on both tiers, while passenger participation remains failed. Spawn offscreen screen geometry and browser QA still unverified; current full suite/threat/vehicle campaign gates still need rerun.

## Browser lifecycle correction

With sandbox restrictions lifted, the vehicle campaign gate starts successfully on4974. Its L9 setup exposed a crash: quality setup requests chunk residency before the APC exists. `busSupport` now returns null until that car exists. Typecheck/lint pass. The gate attempt was stopped (exit130) after already failing L9 rows and a hot-reload context loss; it supplies no green gate claim. A clean fixed-source rerun remains required.

## Fresh L9 browser motion gate

Fixed-source headless pooled L9 subset runs HIGH/LOW successfully through setup on4974; command exit1. LOW passes. HIGH fails because hatch/rail-stall windows contain zero contacts (59frames/1actor), despite no correction failures and measured other contacts max1.8cm. Both sourceStable true. See `browser-l9-motion.json`. This is no full vehicle campaign gate pass; other campaign fixtures and hatch participation remain outstanding.

## No-fire rail diagnostic

Added optional `L9_RAIL_PASSIVE=1` input policy to the existing native probe: empty input during rail hold, ordinary skilled behavior elsewhere. HIGH courier dies tick5848,9.67s after hatch5268; no bus passenger within5m or windup before death. No health/actor/threshold changes. This rules out player fire as the sole explanation for missing bus arrivals; current delivery is late even before shooting. Diagnostic is not a completion run. Typecheck/lint pass.

## Closer ram delivery trial

A trial combining18m ram-warning range (from42m),1.75 pursuit speed share, hull-gap rail braking and near-held-APC release still completed HIGH with zero windups and zero within5m. Reverted all trial changes. No gate/threshold relaxation retained. See `rejected-close-ram.json`. Passenger delivery remains unresolved.

## Six-passenger arrival working trial

Bus speed share3 +18m ram-warning range (instead of42m) permits all6 passengers within5m of APC during HIGH no-fire rail hatch. Guarded engine-target handoff still yields no exact windups. Courier dies tick6300/hatch5173. Runtime trial remains uncommitted: requires realistic pacing review, attack fix, LOW/full-drive/asphalt/regression checks. Typecheck/lint pass. See `six-passenger-arrival-trial.json`. Earlier asphalt receipts describe committed runtime, not this trial.

## Hull windup measurement correction

The attack observer now includes `vehicle.attack-windup`, whose targetId is the attacking infected and sourceId the APC. Earlier empty telegraph results did not prove absence of hull attacks. Current uncommitted speed-share3/18m-ram/guarded-handoff trial with ordinary no-fire rail input: HIGH6 within5m, first hull windup1.97s after hatch; LOW2 within5m, first4.05s. Thus HIGH diagnostic meets participation thresholds; LOW proximity still fails. See `hull-attack-trial.json`. Runtime trial still requires pacing/asphalt/full regression qualification.

## Current delivery trial gate results

Near-held-APC exit spacing30ticks improves LOW to4 within5m and first hull attack3.15s; HIGH6/1.97s. Both no-fire diagnostics meet numeric passenger criteria. However updated `bus-route.json` is now trial evidence and fails asphalt (max8.832m), and focused vehicle test fails the unchanged90tick ram telegraph expectation because trial18m warning range is too short. Typecheck/lint pass. Uncommitted trial is not releasable: pre-bend braking and compatible ram telegraph/commit distance must be fixed; all final gates remain required.

## Pre-bend braking correction in working delivery trial

Working fast pursuit brakes55m before authored interior road vertices to7m/s, then uses existing turn braking. Ram warning returns42m/90ticks with lateral alignment<8m, preserving the unchanged telegraph regression. All6 extended fixtures now pass asphalt (max2.315m), and focused vehicle tests2/2 pass (30.83s). Earlier HIGH/LOW delivery pass receipts predate this braking correction and must be rerun. Runtime remains uncommitted until final participation/static checks.

## Braking participation revalidation failure

Revalidated speed-share3/55m-braking runtime fails both no-fire tier participation diagnostics (0near/0windups before courier death). Earlier delivery passes predate braking and cannot qualify this runtime. Lower share2/25m-braking HIGH trial also fails0/0. Latest working runtime is uncommitted and not qualified; current asphalt JSON still describes preceding share3/55m trial. See `braking-participation-trials.json`. Typecheck/lint passed before the latest two numeric adjustments, whose full checks remain open.

## Latest pacing investigation

Share2/25m-brake ordinary skilled HIGH completes but has1near/0hullwindups. Share3/10m-brake HIGH no-fire diagnostic has0near/0hullwindups before death. Both use restored42m lateral-aligned ram warning; prior delivery passes used18m warning and therefore cannot be claimed for this runtime. Runtime remains an uncommitted failing trial. Next inspect speed-dependent ram approach eligibility while preserving unchanged90tick warning and regression.

## Speed-aware ram eligibility trial

Working warning range max(18,42-2*busSpeed), lateral alignment<8m, share3 and10m pre-bend braking: HIGH6near/first1.68s, LOW4near/first3.63s. Focused vehicles2/2 pass36.36s, unchanged warning assertions. Asphalt fixture worst6.906m fails6m; runtime uncommitted. See `eligible-ram-participation.json`. Need modestly earlier braking, then repeat combined criteria and all final gates.

##18m braking and LOW exit spacing

18m pre-bend braking passes all6 asphalt fixtures(max3.426m), HIGH6near/first4.2s, LOW2near/3.95s. Typecheck/lint pass. Further changing near-stop disembark spacing30→15ticks gives LOW3near/first4.4s. Latest runtime remains uncommitted: HIGH, asphalt, focused/full gates and skilled completion must be revalidated after exit-spacing change. See `low-exit15-trial.json`.

## Delivery implementation focused qualification

Current runtime: mission bus speed cap share3 (36m/s allowed straight-line cap),18m pre-bend braking to7m/s, existing5m/s turn braking, speed-aware ram eligibility preserving90tick warning,15tick exits near a held APC and guarded engine-waypoint→courier targeting. Infected stats unchanged. HIGH4near/first4.4s, LOW3near/first4.4s under disclosed ordinary no-fire rail input; full samples/windups in `participation.json`. All6 extended asphalt fixtures pass(max3.426m); focused vehicles2/2, typecheck/lint pass. This is focused qualification only: final six driven path sweeps, skilled completion, offscreen spawn, full remote suite, threat audit, E31 and browser vehicle gates remain required. Earlier current verdict predates this implementation.

## Final-runtime per-tick six driven sweeps

Current31e6a83b skilled drives all6 complete. Bus positions recorded every native tick continuously from spawn to completion, independent nearest-segment geometry: HIGH road1.996m/corner4.841m/wide3.885m; LOW road2.245m/wide3.873m pass. LOW corner fails92ticks outside6m, peak6.237m. See `final-six-driven-paths.json` with every tick position. This supersedes stationary-fixture and earlier-runtime asphalt passes for completion audit. Requires slightly earlier bend braking and revalidation; goal not complete.

## LOW corner excursion source

Per-tick failure peaks at tick11697,x490/z6.236 in bridge finale, not return bend. Trial braking after evacuationDone did not change result and was reverted: bus already busStoppedAt8379 with HP1178.65, so autopilot was removed before attempted brake branch. Stopped bus later moves toward bridge near APC; inspect stopped vehicle controls/contact and bridge checkpoint placement. LOW corner still92ticks outside6m. Typecheck/lint passed trial; `finale-stop-low.json` retains rejected attempt.

## Stopped bus handbrake trial

Stopped bus already receives zero throttle and regular brake. Adding existing handbrake after busStoppedAt reduces LOW corner finale peak straight-road z from6.236 to6.185m, still fails6m. Trial reverted. Ordinary drive still completes. Need inspect native contacts/bridge placement causing parked bus to travel into bridge; no pose teleport or infinite-mass lock retained.

## Gate-lane parking investigation

Detailed trace identifies stopped bus atx467.65/z0.386 against closed bridge gate before APC arrives. After evacuation APC pushes it onto bridge/off asphalt. Trial braking bus fromx425 interferes with the APC approach: LOW corner reaches36000ticks without completion, bus ends offroad. Trial reverted. Current runtime retains known92tick LOW corner excursion; no completion claim. Need park physically clear of APC while on authored asphalt, or resolve lane passing without a teleport.

## Physical passing space on final asphalt

Bus target uses z3 after x450 on the final12m-wide asphalt, leaving APC passage beside its gate stop. LOW corner ordinary skilled drive now completes with continuous per-tick bus max3.885m/0outside6m; see `passing-lane-low.json`. No teleport, physics lock, zombie stats or gate thresholds changed. Focused vehicle2/2, typecheck/lint pass. Other5final sweeps, current broad gates and visibility still require revalidation after lane change.

## Final passing-space runtime sweeps and full remote suite

All6 final a7a064ac skilled native drives complete with continuous every-tick bus positions,0ticks outside6m; worst3.885m. Refreshed `final-six-driven-paths.json` supersedes prior92tick failure. Required unchanged remote `npm test` passes:27files,106tests passed/1skipped,223.9s of240s budget,exit0. No suite trimming or timeout retry needed. Current browser campaign gate, L9 threat audit, E31 verification and offscreen-spawn proof remain open.

## Final L9 threat subset

Current runtime L9 subset completes both skilled/passive native routes with0L9 flags and0passive flags. Command exit1 comes only from audit-level `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`, expected for subset; no threshold or audit code changed. User explicitly permits L9 subset. Full receipt in `final-l9-threat.json`. This establishes L9 zero flags, not a whole-campaign threat gate.

## Full final-runtime vehicle campaign browser gate

Full command runs all8fixed-source headless pooled rows and exits1. BothL9tiers fail required hatch/contact coverage; allL7/L4rows pass. Measured contacts are within motion limits, but missing hatch windows cannot be treated as pass. See `final-campaign-motion.json`. This confirms goal remains incomplete despite native asphalt/participation and remote-suite passes. No gate edits or threshold changes.

## Browser hatch contact coverage inspection

Sampler steps the entire rail interval and requires visible living infected figures with soles near native hulls; its unchanged contact criterion cannot be satisfied by transient proximity/attack events alone. Current receipts have only one rendered infected actor in HIGH hatch samples and none LOW, so motion contact coverage remains missing. Native participation under no-fire input does not establish this browser gate. `browser-hatch-coverage-detail.json` records exact actor IDs/tick windows and coverage. No sampler threshold or runtime change made.

## Working offscreen admission guard

Added sampled bus hull points (length1m steps, sides/center, heights0/2/4m) against existing widest-camera `inFrame` with1.2margin before bus visibility activation. This strengthens distance-only admission but is uncommitted pending browser validation at both zooms/tiers and delivery revalidation. Typecheck/lint pass. No claim that visibility proof is complete.

## Offscreen browser spawn proof

Headless pooled browser probe runs ordinary bot driving with no actor/HP writes on HIGH+LOW at zoom1/1.5. At first visible bus tick, independently projected render-camera bus hull bounds are entirely outside viewport in all4cases; all buses spawn,command exit0. See `spawn-screen.json`, tool `tools/qa/s118-spawn-screen.ts`. Sampled hull admission guard and probe typecheck/lint pass. Evidence proves these4primary-route camera configurations; new guard can delay other path spawns and therefore final runtime route/participation gates still need revalidation.

## Named E31 verification passed

Remote `npm run verify -- E31` on1bcc3736 passes exit0: typecheck,lint,full unchanged unit suite27files/106passed/1skipped;230.7s within240s unit budget. Remote total315s includes static checks. Summary and log hash in `e31-verification.json`. Full vehicle browser gate remains red; completion is not claimed.

## Browser timing root cause and following-gap working fix

Full browser receipt shows bus already115–190m ahead at rail hatch (HIGH tick6300 APC378/-215,bus439/-35; LOW tick6000 APC378/-229,bus413/-121). Fast bus outruns slower browser bot then brakes at fixed railX, delivering too far ahead. Working controller brakes at12m along-road following gap (X share from road tangent), preserving asphalt steering. HIGH ordinary no-fire diagnostic now4near/first hull windup7.2s. Typecheck/lint pass. Uncommitted pending LOW/browser/asphalt/focused regressions.

## Following-gap fix qualified in browser L9 subset

Controller now brakes at12m along-road following gap so fast bus cannot run far ahead of slow APC. HIGH no-fire participation4near/7.2s; LOW3near/7.92s. Focused vehicles2/2pass30.43s; typecheck/lint pass. Unchanged fixed-source headless browser L9 subset passes both tiers, including hatch/rail-stall contact coverage (HIGH3actors/4contacts). `following-gap-browser.json` contains both verdicts. Commit this fix; then full8-row gate, six per-tick sweeps and final checks need revalidation.
