# L9-A1 · APC damage presentation review

Scope: E31-AC22 and the assets/audio portions of E31-AC16/19. The existing unarmed APC, physics and floor policy are retained. No GLB or audio recording was added. Evidence lives under `test-results/epics/E31/l9-a1/`; the comparison sheets and compact metrics below are committed here.

Opened and inspected all 72 game-camera cases: nine catalog scenes × high/low × zoom 1.0/0.5 × WebGL2/WebGPU. The recorded backends are actually `webgl` and `webgpu`, respectively, with zero console errors. [WebGL matrix](webgl2-matrix.jpg), [WebGPU matrix](webgpu-matrix.jpg), [WebGL driving](webgl2-driving.jpg), [WebGPU driving](webgpu-driving.jpg).

| Pair / boundary | Review |
| --- | --- |
| 76 → 75% | PASS: the healthy bonnet/flanks acquire dark creases with pale folded edges; the six-wheel silhouette stays intact. |
| 51 → 50% | PASS: the dents remain and white branching glass fractures appear on the side panes and sloped vision blocks. The glints remain visible on the shaded flank at both qualities. |
| 26 → 25% | PASS: the glass/creases persist, a light rear smoke column appears, and lamps intermittently fail. The frame sequence plus the lamp ownership test confirms flicker rather than an unrelated shared-material change. |
| 1 → 0% | PASS: the intact hull remains driveable with darker, denser pooled smoke and dead front/brake lamps. No flame or wreck shell appears. |
| Zero driving, f0–300 | PASS: exhaust trails behind the moving outlet instead of staying attached as five rigid spheres. Every configuration travels from x=-45 to -4.379 m, remains at 0 HP, reaches 10.56 m/s and reports zero body overlaps. |

Applicable vision checks (spec 90 A/C/D/F/G):

- **A PASS:** the specified cool dry-night palette retains olive/gold armor, teal glazing and purple-blue ground/shadows; the high three-quarter game lens is preserved.
- **C PASS:** healthy/damaged pairs retain the base hull, six grounded wheels, cab, paint/glass/rubber separation and unarmed silhouette; no branding or model replacement appears. The complete derived LODs meet the inventory caps.
- **D/G PASS:** in the [populated night fixture](performance.jpg), the courier's warm colors and ambient aura remain clear with all APC lamps dead. Rear smoke rises above the hull; the forward ground remains visible. At close zoom the vehicle fills more of the frame, as it does in the existing game camera.
- **F PASS:** the E31 HUD browser regression preserves current/max durability and the zero label “Barely functional” at desktop and phone sizes; the audio checks confirm damage captions and 32/16 voice limits.
- **Smoke PASS:** light smoke is sparse and pale; heavy smoke is darker and denser, with wind drift and a visible trail. Low quality emits fewer puffs without losing the damage stage. No fire, blast or mandatory exit is introduced.

Asset-pair score: **8/10**, all applicable must items pass, no P0/P1 finding. Small vision-block fractures are finer at zoom 1.0 than the side-pane fractures, but the cumulative damage and smoke stages remain distinguishable. The first iteration hid bonnet scars below the sloped armor and made shaded glass too subtle; final sheets above show the corrected surface positions and restrained moonlight glints. Healthy lamp copies preserve E25 HDR strength and the single-material GLTF draw contract; the final healthy/damaged pairs show glowing lamps before failure and dark lenses afterward.

Audio checks use the real Web Audio graph at both qualities: eight HP boundary fixtures, repeated engine events, then a physics rebuild from serialized entity components. Engine voices update in place, progressively lowering rate/cutoff and raising sputter gain; zero never plays `vehicle.fire`. Rebuild retains zero HP/stage 4 and emits no transition replay. The three existing E16 sprites retain their existing license records; runtime EQ/rate mixes require no new sample license.

## Budgets and validation

[Asset budgets](asset-budgets.json): complete hull + cab + 48 overlay triangles = **9,546 / 2,074 / 1,082** triangles, against **12,000 / 5,000 / 2,000**. Every derived state uses **four materials / 12 draws**. The original LOD0 GLB remains 160,964 bytes. Damage geometry is appended to the existing cab roof batch; the shared E27 pool stays capped at 400/120 puffs.

The [quiet-run conditions](perf-conditions.jsonl) confirm native headless Metal WebGL2, no concurrent browser/Vitest work, and load below 3. The populated fixture reuses L9-S1's stationary chase population (AI runs, movement is held spatially stable), at 0 HP with heavy smoke. High viewport: 1600×900; low: 390×844 and 4× CPU throttling.

| Quality / zoom | Infected | Frame p95 ms | Sim p95 ms | Draws | Triangles | Heap MB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| High / 1.0 | 200 | 4.8 | 0.9 | 57 | 274,953 | 104.7 |
| High / 0.5 | 200 | 4.4 | 0.9 | 45 | 188,797 | 105.8 |
| Low / 1.0 | 100 | 6.9 | 2.0 | 45 | 146,074 | 72.2 |
| Low / 0.5 | 100 | 4.3 | 1.8 | 40 | 119,976 | 61.2 |

All E18 limits hold in this lane fixture. Raw records: [high z1](high-z1.json), [high z0.5](high-z0.5.json), [low z1](low-z1.json), [low z0.5](low-z0.5.json). Scene Lab's isolated matrix peaks at 21 draws / 99,086 triangles on either backend. Full crossing route/stream/crash performance and physical iOS/Android checks remain the other E31 lanes' gates; this report does not claim those broader criteria complete.

Validation: typecheck, lint and production build pass. Hetzner full unit suite: 1,269 passed / 7 existing skips with one worker; final focused asset/floor/audio-registry checks: 13 passed. E31 verification: 34 unit/sim checks and 34 browser/smoke checks passed. L1 real-input finale, both L2 axe-start paths and high/low APC audio tests passed; all 17 L4 ride configurations passed with one worker under [quiet-run](ride-conditions.jsonl).

The parallel ride run initially exceeded its existing 0.6 px RMS gate in two configurations (0.84 / 0.68 px); the full quiet rerun passed every configuration. A loaded remote full-unit run hit the unchanged 300 s production-asset validator timeout; its isolated retry passed in 211 s, and the subsequent full serial suite passed. Test thresholds and budgets were retained.
