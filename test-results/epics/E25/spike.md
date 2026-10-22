# E25 lighting decision — fresh WebGPU spike, 2026-10-22

## Decision

Retain the production HDR light field and its one promoted shadowed spotlight on both backends. Keep the cached environment and authored palette output. The current code follows this decision; no additional unshadowed analytic hero-light layer is enabled.

## Native comparison

`tests/visual/e25-spike.spec.ts` passed in a quiet native headless reservation: real WebGPU backend, timestamp-query supported, 30 warmup renders and120 samples for each of six configurations. Same1600×900 camera, shipped trailer/fence/car geometry, twelve boxes, rough standard materials, lamp positions/count, one shadowed hero spot and fixed ambient/moon. The field variant reuses production LightField; alternatives use the pinned Three DynamicLighting and ClusteredLighting implementations. [Six inspected frames](../../../docs/reports/ac-close-l7-l10/lighting-spike.jpg), [all samples](../../../docs/reports/ac-close-l7-l10/evidence/spike-comparisons.json.gz), [counters/hashes](../../../docs/reports/ac-close-l7-l10/evidence/spike-summary.json).

| Lights | Method | CPU submit p95 ms | Submit-through-queue-completion p95 ms | Reported render GPU p95 ms | Compute GPU p95 ms | Draws /triangles |
| --- | --- | --- | --- | --- | --- | --- |
| 16 | field | 0.7 | 2.3 | 1.4426 | n/a | 88 /173709 |
| 16 | dynamic | 0.6 | 4.8 | 5.755 | n/a | 87 /173677 |
| 16 | clustered | 0.7 | 5.5 | 5.7264 | 0.1129 | 87 /173677 |
| 256 | field | 0.8 | 2.7 | 2.4974 | n/a | 88 /174189 |
| 256 | dynamic | 3.1 | 781.3 | 1555.4914 | n/a | 87 /173677 |
| 256 | clustered | 1.8 | 16.6 | 27.067 | 0.3817 | 87 /173677 |

Opened every full-resolution output. At16 lights the field has broad bright colored pools and flat spill on box sides; analytic options preserve dark ground with localized side illumination. Dynamic/clustered images are visually close at each count. At256 overlapping lights the field saturates almost the entire center white, while analytic options retain saturated side highlights and purple ground. This is a stress comparison, **not photometric parity**: field footprint intensity1.8 and analytic20 use different units/response; no equal-output or image-quality victory is inferred. Standard rough materials also isolate mechanisms rather than reproducing the campaign palette graph.

Dynamic256 is unsuitable at781.3ms queue p95. Clustered256 takes16.6ms queue p95 for this isolated173,677-triangle scene, leaving essentially no16.7ms desktop frame budget for campaign simulation/post/UI/larger crowds. That headroom conclusion is an inference, not a measured integrated campaign. Reported Three GPU-pass timestamp aggregates exceed wall queue durations in the expensive variants; both raw timing domains are retained and are not interchanged or summed into a fabricated campaign frame. The production four-case native budget repeat separately passes (high night p95=8.3ms;4×CPU low night p50=21.8ms).

The field's saturated256-light stress image is not accepted campaign art. Authored intensities/distribution and real scene caps remain required. There is no budget evidence supporting replacement of the current production path; retain the common field and real shadowed spot. A future clustered integration should first match output and measure the complete campaign.

## Tone mapping and remaining epics

The fresh WebGL none/AgX/ACES comparison passes and retains `closure/tone-comparison.json`: no global tone mapping continues to preserve the authored palette. This decision supplies no SSR, hero-shadow, G-review, or total-memory acceptance. SSR's explicit fixme and the other six functional verifier failures remain visible in the closure report.
