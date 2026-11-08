# E25 fresh spike evidence — incomplete

2026-11-08, WebGL2 via the shared headless browser pool on ANGLE/Metal. This is a partial measurement, not the missing accepted E25 spike.

## Tone comparison

Identical light-lab scene, fixed camera, fixed node time, high tier. Only the renderer's toneMapping enumeration was changed in the measurement page; the shipping default was restored afterwards.

| Candidate | Mean linear image luminance | Draws | Triangles |
| --- | ---: | ---: | ---: |
| Shipping NoToneMapping | 0.0655211 | 34 | 51,659 |
| ACES | 0.0639366 | 34 | 51,659 |
| AgX | 0.0615065 | 34 | 51,659 |

Screenshots: `test-results/epics/E25/details-high/tone-{shipping,aces,agx}.png`; archived next to this file. These counters measure work submitted, not GPU pass timings. There is no PO decision accepting a changed tone curve. Preserve the existing curve while the accepted L1/L2/L4/L5 views remain the governing visual constraint.

## Lighting options

The current implementation uses the universal light field and selected hero lights. A fresh WebGPU ClusteredLighting versus DynamicLighting performance comparison remains unmeasured: repository policy reserves WebGPU validation for manual checks. The native timing attempt also failed quiet-host admission after 120 seconds. No comparative GPU timings are claimed.

Decision for this audit: retain the existing rendering configuration. AC01 stays unmeasured until the actual lighting alternatives are measured and their decision reviewed. This document does not waive the AgX/ACES or clustered-light evaluation in the specification.
