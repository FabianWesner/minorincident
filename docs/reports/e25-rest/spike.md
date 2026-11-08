# E25 AC01 — lighting spike and decision

2026-11-08. **Measured; retain the shipping universal light field and selected hero-shadow path. Do not activate the 256-light clustered candidate. Retain NoToneMapping and the authored post grades.** Code review confirms the campaign renderer still uses that configuration; neither analytic-light alternative is installed by this lane. This is an engineering decision from this spike, not a PO approval of a new global look.

## Mechanism comparison

The existing `src/debug/lightingSpike.ts` fixture is exposed through a dev-only QA HTML entry. The runner uses the shared headless GPU/Metal browser, one context at a time, 1280×720, DPR 1. Each case warms 30 renders and records 120 samples. Every case reports `WebGPUBackend` and timestamp-query support; all six have zero console/page errors. Fixed camera, geometry, 1024² hero shadow, lamp positions, colors, ranges and analytic intensities are shared. DynamicLighting has a point-light array sized to the case; ClusteredLighting uses a 32 px tile, 24 depth slices and 64 lights/cluster, capacity 256.

| Lights | Option | Draws / triangles | CPU submit p50 / p95 ms | Render GPU p50 / p95 ms | Compute GPU p50 / p95 ms |
| --- | --- | --- | --- | --- | --- |
| 16 | DynamicLighting | 87 / 173,677 | 0.700 / 1.600 | 2.867 / 4.920 | — |
| 16 | ClusteredLighting | 87 / 173,677 | 1.400 / 1.900 | 2.217 / 2.402 | 0.070 / 0.081 |
| 256 | DynamicLighting | 87 / 173,677 | 1.750 / 2.700 | 23.701 / 36.439 | — |
| 256 | ClusteredLighting | 87 / 173,677 | 1.000 / 2.700 | 17.041 / 22.144 | 0.212 / 0.348 |

[Retained counters and distributions](evidence/lighting-options.json). Full samples and captures are local under `test-results/epics/E25/rest/spike-final/`; hashes are retained in the archive manifest. The host was shared with other browser jobs and had load above the quiet-run admission limit. These are exploratory native GPU measurements, **not an E18 reference-machine frame-budget certification**. CPU submission, queue-completion/readback time and GPU timestamps are distinct measurements.

The optional field case is a cost control using the production `LightField` class as an emissive input to a standard material. It is not radiometrically matched to the analytic cases (its dense 256-lamp image overexposes), so its lower timings are not used as an equal-look performance claim.

## Screenshot review and decision

[Dynamic 16](../../../test-results/epics/E25/rest/spike-final/dynamic-16.png), [clustered 16](../../../test-results/epics/E25/rest/spike-final/clustered-16.png), [dynamic 256](../../../test-results/epics/E25/rest/spike-final/dynamic-256.png), [clustered 256](../../../test-results/epics/E25/rest/spike-final/clustered-256.png).

Reviewed the complete pairs. Both analytic paths preserve the trailer, car, occluders, lamp colors and lit faces; the clustered culling does not visibly lose pools in this fixture. Numeric image comparisons are in the evidence summary. Clustered lighting is faster than DynamicLighting in the dense case, but its measured render cost already consumes approximately the entire high-tier 16.7 ms frame allowance before compute, simulation, post effects and the larger campaign world. The small case does not establish a need to replace the current single selected shadow source with a new unshadowed-light layer. This spike therefore does not establish the budget margin required by lighting concept §3 to activate clustered lighting. Retaining the existing field/selected-shadow implementation is the decision; the generic debug candidates remain available for a future admitted level-budget experiment.

## Tone comparison

Current corrected QA production build, WebGPU high, the fixed light-lab pose at zoom 1.5, fixed clock/node time. Only the renderer tone-mapping enumeration changes; the existing post chain stays in place. [Shipping / ACES / AgX contact sheet](../../../test-results/epics/E25/rest/tone-contact.png), [capture metadata](evidence/tone-options.json).

| Curve | Mean linear image luminance |
| --- | ---: |
| Shipping NoToneMapping | 0.03079651 |
| ACES | 0.02372390 |
| AgX | 0.03066079 |

Visual review: ACES darkens the blue unlit ground and makes the bright pool a more isolated patch. AgX retains more surrounding ground but shifts the backdrop toward blue-green and compresses the bright beam/pool. The shipping curve retains the established blue surroundings and warm practical contrast. The accepted L1/L2/L4/L5 look is a governing constraint, so retain the shipping curve; no global tone or preset change is warranted by these comparisons.

## Reproduction

`BROWSER_POOL_BACKEND=gpu E25_SPIKE_PORT=4336 node --import tsx tools/qa/e25-lighting-spike.ts` captures both counts and all three mechanisms. `E25_SPIKE_OUT` changes the output directory. `SCENE_SERVER=preview SCENE_PORT=4338 E25_PHASE=built-after E25_BACKEND=webgpu E25_TONES=1 node --import tsx tools/qa/e25-rest-audit.ts` captures the production tone controls after `npm run build:qa`. Neither HTML entry nor spike module is imported by the public game entry.
