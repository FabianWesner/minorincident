# S64 — animal/infected foot slide

**Goal met and verified.** The full scene gate passes **87/87** rows. Supplemental contact coverage passes **152/152** rows: all 23 infected catalog definitions plus the production Mega pursuit, at LOW/HIGH, zoom 1/1.5, day/night.

## Root fix

Animal clip transitions blended after the paw solver, pulling already planted soles toward the outgoing pose. `CrowdLocomotion` now blends before the contact solve, so the final displayed pose retains world-space plants. This shared-path bug affected both quality tiers. No gameplay speeds/stats, thresholds, classes, rows, LOD geometry, cadence or solver budgets changed. The earlier cadence hypothesis was disproved and reverted.

## Measurements and validation

| LOW close zoo actor | Before p95 | After p95 |
| --- | ---: | ---: |
| Flamingo | 5.2 cm | 0 cm |
| Zebra | 18.5 cm | 0.7 cm |
| Elephant | 5 cm | 1.6 cm |

- `SCENE_PORT=4973 npm run scene:gate -- --out test-results/s64-full-gate`: **87/87 passed**, zero known failures or missing rows, WebGL2/WebGPU, 12.4 minutes. [Named motion assertions](motion-gate.json).
- Supplemental existing-fixture matrix: **152/152 passed**, WebGL2, both tiers/zooms/lighting states. [Coverage and per-row assertions](supplemental-matrix.json). Original motion scripts and 3 cm thresholds retained. Day uses L1 lighting; night uses L8-zoo (Mega L10-night). Flamingo uses a follow camera so both zooms apply. Crow remains naturally airborne and must pass its existing complete finite moving-foot-track checks.
- Final source typecheck and lint: passed.
- Remote full suite: **27 files, 106 passed / 1 skipped**, collected **150/150** budget cases, **207.3 s / 240 s**, exit 0 on 94.130.181.173. Command: `sh tools/remote/run.sh "$PWD" --pull test-results/timings/test.json -- bash tools/remote/timing-isolated.sh --whole-run npm test -- --pool=forks --maxWorkers=4`. [Receipt](remote-unit.json). Earlier thread-pool runs on another runner timed out; no test sources or limits changed.
- Frame-cost delta: **perf pending**, permitted by the task. Solver count, cadence, geometry and draw count are unchanged; only existing blending/contact order changes.

## LOW close visual review

Opened the LOW flamingo day close sheet: alternating lifted/supporting feet stay attached through walk/run frames. Opened dedicated LOW zebra and elephant sheets, 50 frames at five-frame intervals: zebra keeps attached legs and changes hoof positions through movement and stopping; elephant keeps attached legs and visible feet through movement/turning. The first elephant crop cut off its feet and was replaced with radius 10. Still sheets support pose/attachment review; continuous gate probes establish slide acceptance. The LOW zoom-1.5 lineup sheet was also opened.

Local artifacts: `test-results/s64-full-gate/webgl2-low-2/foot-slide-flamingo-day@low/sheet.jpg`, `test-results/s64-review/s64-close-zebra-low/sheet.jpg`, `test-results/s64-review/s64-close-elephant-low/sheet.jpg`.

No push, deployment or main-branch changes performed.
