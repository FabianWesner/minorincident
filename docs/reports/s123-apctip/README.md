# s123 — L9 APC driving lean

Status: **APC driving lean correction implemented; native driving bound and full L9 threat audit pass. Vehicle browser gate and remote unit suite remain blocked by shared infrastructure.** No deployment, push, or main movement.

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
