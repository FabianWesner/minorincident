# s123 — L9 APC driving lean

Status: **Correction committed; six complete native drives meet the 20° bound, continuous bus asphalt hold passes, and current vehicle campaign and remote unit gates pass. Fresh threat audit passes; original physical-input reproduction remains open.** No deployment, push, or main movement.

## Finding and correction

The original high-quality >20° event in the native probe was on its default `detour` path, not on asphalt: the path runs at z=-305 while the authored road is centered at z=-330. At tick 4096 near x=58, the APC had no raycast wheel contacts, was descending at 0.83 m/s and had already rolled 21.1°; peak roll reached 22.9°. This is a real uncontrolled chassis lean during unsupported/off-road driving, but it does not establish a missing collision chunk. The browser observation at tick 3255 remains an unisolated real-input tip report.

`VehicleBody.stabilizeTilt` now applies a finite, capped restorative angular impulse to the APC while the player is driving it in L9. The spring engages above 60% of the 20° bound (or when angular rate predicts excessive lean); ordinary smaller suspension lean is left intact. It does not change zombie stats, vehicle speed, collision geometry, or use view-side righting.

The probe now records per-tick roll/pitch maxima and supports `--attitude-check`, which fails if either axis reaches 20° during `phase=driving`. The complete HIGH primary-road drive passed that assertion and finished the L10 handover at tick 10,989, with no position jumps. Its peak driving attitude was 1.99° roll / 11.4° pitch. A 90° attitude is recorded after driving in the authored outskirts crash/fall sequence; it is outside the player-driving bound and remains visible in the raw result.

## Native driving results

Three primary polylines (`road`, `countryside`, `dry-shortcut`) were sampled in HIGH and LOW for 9,000 ticks each with `--attitude-check`. No sample reached 20°. Peak values were identical across quality tiers because quality does not change simulation physics:

| Route | Peak roll | Peak pitch |
| --- | ---: | ---: |
| Road | 1.99° | 11.42° |
| Countryside | 2.89° | 10.60° |
| Dry shortcut | 14.13° | 11.94° |

The full HIGH road run completed. A 10-second alternating full-steer burst on the primary road route also stayed below the bound (8.48° roll / 12.06° pitch); that perturbation sample ended before route completion. All six route/tier rows and the full-route result are summarized in the companion JSON. Native probe raw captures remain in ignored `test-results/s67-l9stuck/`.

## Required holds and audits

- **Bus on asphalt:** reran the native 120-second hold fixture at HIGH and LOW for on-road, corner-cut, and wide-detour APC placements. All six spawned; each sampled the bus 240 times, and the largest distance from the authored asphalt polyline was 0.020 m (bound: 6 m).
- **Threat audit:** unchanged full `npm run qa:threat` completed in 304 s with **0 fail flags**. L9 skilled and passive routes both completed with 0 L9 flags.
- **Typecheck and lint:** passed after the final source and probe edits.
- **Vehicle campaign motion gate:** could not start. `npm run qa:vehicle-campaign-motion` exited before cases because the browser pool could not bind `127.0.0.1:4329` (`EPERM`). The machine-wide local CPU slot also reported an active GPU/browser reservation; it was not bypassed.
- **Unit suite:** the required unchanged `sh tools/remote/run.sh "$PWD" -- npm test` found no healthy runner. `sh tools/remote/scale.sh add` could not resolve the remote API host in this network-restricted environment. Local fallback was not admitted while the GPU/browser reservation was active. No test cases were trimmed.

## Browser QA needed

Repeat the original headless HIGH WebGL2 real-input road capture through the browser pool after its reservation clears. Include aggressive player steering, kerb/ramp contact, and bus/APC contact while logging per-tick attitude; review the captured frames for tipping. Then rerun `npm run qa:vehicle-campaign-motion` and the unchanged remote unit command. This report does not claim those unavailable gates or manual WebGPU review passed.

## Continuation audit

Network and filesystem access restored. The unchanged remote unit suite passed on 46.225.66.90: 27 files, 105 passed/1 skipped, 127.6 seconds. Typecheck and lint pass. Vehicle campaign gate is running through the prescribed pool. Corrected probe maxima accumulation: each axis must update every tick independently. Previous per-axis numerical summaries remain provisional pending refreshed measurements. Original tipping root cause, baseline comparison, explicit kerb/ramp and bus-contact coverage remain incomplete; the goal is not complete.

The complete vehicle campaign motion gate subsequently passed all eight cases (L9, L7 bus, L4 parked, L4 tank; HIGH and LOW), exit 0, through one headless browser pool reservation on port 4984. Receipts are summarized in results.json. Prior infrastructure failure descriptions above are historical and superseded by these successful gate and remote suite reruns.

## Chassis axis correction

Further audit found yaw mixing in the spring and probe angle formulas. Corrected chassis roll to atan2(-localZ.y, localY.y) and pitch to asin(localX.y). Full HIGH primary-road drive passes --check, completes tick 10989, peaks at 5.75 degrees roll and 11.40 degrees pitch during driving. Typecheck/lint pass. Earlier campaign/remote/threat receipts predate this runtime correction and require revalidation. Root-cause isolation and kerb/bus-contact coverage remain open.

## Controlled native contact evidence

Added tools/qa/apc-tilt-contact.ts: actual Rapier APC, shared chassis controller and suspension, native ground, kerb/ramp and bus fixtures. Initial setup only; no pose writes during the 600-tick samples. Both wheel ray contacts and hull manifold contacts are counted. Without stabilization, ramp roll reaches 45.82 degrees and a 30 m/s side bus impact inverts the APC. With stabilization, all four fixtures have verified contact and stay below 15 degrees on both axes (ramp roll 14.85, bus-side roll 8.94; rear ram pitch 5.81). The unchanged native suspension/contact system can generate rollover momentum; the bounded spring arrests that momentum before tipping. These are isolated native physics fixtures, not full L9/browser contact coverage. Probe exits nonzero if any stabilized fixture misses contact or reaches 20 degrees. Typecheck/lint pass. Original s122 trigger and older-baseline comparison remain unproven.

## Corrected full-drive matrix

All six corrected-axis native drives completed: HIGH/LOW primary road, road detour (corner cut), and countryside primary (wide off-road). Every driving tick remained below 20 degrees on both axes; worst pitch 12.18 degrees, worst roll 10.79 degrees. Bus asphalt distance was measured on every visible native tick: 44,784 samples, zero outside 6 m, worst 3.479 m. Independent tier receipts in results.json supersede earlier duplicated/provisional tier summaries. Typecheck/lint pass. git diff 683da8f8 266ec466 -- src/sim/vehicles/VehicleBody.ts is empty: chassis susceptibility predates batch 103, although the original browser incident trigger is still unisolated.

## Corrected runtime gate reruns

On b58ec0b5, unchanged remote npm test passes (94.130.181.173, 146.8 s, 27 files, 105 passed/1 skipped). Full vehicle campaign motion gate passes all eight HIGH/LOW cases, exit 0, using the single headless reservation on SCENE_PORT=4984. Current receipts supersede the pre-axis-correction gate receipts. Original real-keyboard s122 tipping trigger and fresh threat audit on corrected runtime remain outstanding.

## Fresh threat qualification

Full unchanged npm run qa:threat passes on corrected runtime: 330.2 seconds including wrapper, 0 fail flags. L9 skilled and passive both complete with 0 passive flags. Source/observer hashes and revision retained in results.json. Remaining completion gap: reproduce and inspect the original real-keyboard road-driver tipping sequence, including visual suspension feel; controlled native fixtures and bot driving do not prove that exact observation fixed.

## Physical keyboard road sample

QA build passed. Headless pooled HIGH WebGL2 zoom1, real keyboard road driver, debug menu entry, 120 wall seconds: 6738 sampled driving ticks, max chassis roll 15.19 degrees / pitch 10.94 degrees, no 20-degree breach; suspension deviation reached 0.25 m. The sample ends unfinished with one death, zero objective skips and one disclosed route assist; command exit1 reflects incomplete gameplay and is not a completion pass. Personally inspected original-size t2707 (leapers on hull, bridge approach) and t5411 (barricade contact) captures: APC upright in both. These sparse stills cannot prove continuous natural suspension feel or isolate the exact original tick3255 incident. Raw photos and physical input log remain under test-results/s123-apctip/physical-high; summarized result is in results.json. No exhaustive visual absence claim.

## Contact settling trace correction

Extended the isolated fixture floor from 150m to 1500m half extent after traces showed the driven APC left the smaller floor near the end of the 600-tick sample. Updated contact results supersede earlier fixture maxima. Corrected fixtures all have verified contacts and pass the 20-degree bound: kerb 0.43/0.19 degrees roll/pitch, ramp 14.85/8.68, bus-side 8.94/0.09, bus-rear 0.05/5.81. At tick590 all stabilized fixtures settle to essentially zero roll/pitch and angular speed, with compressed suspension around 0.245m. Sampled suspension and angular response traces are retained in results.json. This supplies numeric settling evidence, not a human feel verdict.

## Completed aggressive steering drives

On current runtime, a 600-tick alternating full-steer burst (ticks2400–2999, sin(tick/55)) followed by ordinary route tracking completes HIGH at tick12079 and LOW at tick11264. HIGH maximum driving roll/pitch 12.32/12.06 degrees; LOW 9.58/11.32 degrees. Zero 20-degree breaches. Bus road census: 6953 HIGH +6948 LOW native ticks, zero outside6m; worst2.369m HIGH,0.331m LOW. These completed corrected-axis trials supersede the earlier incomplete steering sample.

## Native corrective-torque ablation

Added explicit L9_DISABLE_TILT diagnostic option to the native probe. It replaces only the corrective-torque method with a no-op; route input, contacts, residents, bus and chassis physics remain native. HIGH road detour now reproduces roll23.12 degrees (first crossing tick4096, all4 wheels unsupported, descending0.83m/s). Corrected runtime same route completes below12.2 degrees. Primary asphalt route without correction stays below20 degrees for7200ticks (roll10.53/pitch16.86), so the ablation does not reproduce the original physical-keyboard road incident. It isolates a supported native failure mechanism—uncontrolled roll momentum after asymmetric support/contact—and confirms the spring fixes that mechanism. No evidence attributes the original incident to dropped terrain residency. Typecheck/lint pass.

## Physical keyboard causal comparison

The same HIGH WebGL2 zoom1 physical-keyboard road harness with only corrective torque disabled reproduces49.15-degree roll over6987 observed driving ticks. First20-degree breach at tick2757: x−67.56/z−333.24, speed~16.3m/s, upward velocity2.31m/s, diagonally opposed wheel contacts[true,false,false,true]. This establishes a native road-driver tipping mechanism from asymmetric wheel support and ensuing angular momentum. Corrected keyboard sample:6738ticks, peak15.19-degree roll/10.94-degree pitch, no breach. Timing is not identical between wall-clock keyboard runs; this is a causal torque ablation, not an exact tick3255 replay. Both bounded runs are unfinished and record one death; no mission completion claim. Together with full corrected native drives and contact fixtures, evidence supports the finite restoring spring preventing this reproduced tipping mechanism. Typecheck/lint pass.
