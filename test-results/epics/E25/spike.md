# E25 lighting decision (three.js 0.186.0)

## Decision

Retain the production HDR light-field pass with one promoted, real shadowed SpotLight and the existing palette output. Both backends use that graph. Add a cached, prefiltered environment for glossy/metal surfaces. Keep the authored palette output without global tone mapping: the tone comparison below shows that AgX desaturates the yellow trailer and bright pools, while ACES changes their shoulder and warmth. Neither improves the authored palette enough to justify changing every level's look during closure.

The renderer implements this decision. No clustered renderer or replacement lighting system was introduced. `basicLighting` remains the analytic-light path, bounded to the one promoted spotlight (or the sun/moon shadow map). Practical pools are instanced into the existing HDR field, with static visibility masks and a shared fixed-tick power texture.

## Options inspected in the pinned installation

| Option | Mechanism | Fit / remaining proof |
| --- | --- | --- |
| Existing field + basic lighting | One ground-space field render, analytic hero shadow, palette sampling on ground/walls/actors/smoke | Production WebGL2 captures and unchanged high/phone budgets are the measured baseline. This is the chosen implementation. |
| `DynamicLighting` | `three/examples/jsm/lighting/DynamicLighting.js`: uniform arrays, default 16 point and 16 spot lights, avoids recompilation as counts change | Useful if many analytic lights become necessary. Our field already handles hundreds of authored lights without analytic shader arrays. A comparative WebGPU GPU benchmark remains manual/deferred. |
| `ClusteredLighting` | `three/examples/jsm/lighting/ClusteredLighting.js`: Forward+ 3D clusters, defaults 1024 point lights / 32-pixel tiles / 24 depth slices / 64 lights per cluster | Intended for substantial depth complexity and many point lights. This game mostly needs stylized ground pools and a very small shadow budget. A comparative WebGPU GPU benchmark remains manual/deferred. |

These are inspections of the exact installed source, not claimed comparative frame measurements. Repository guidance requires WebGPU to be checked manually. No substitute WebGL run can establish the missing WebGPU comparison; that part of AC01 and AC04 is explicitly deferred to manual review.

## Reproducible tone comparison

`T-E25-01` renders the same production trailer/fence/actor Scene Lab scene with no tone mapping, AgX and ACES, at the same camera and tick. Images: `closure/tone-none.png`, `tone-agx.png`, `tone-aces.png`; counters: `closure/tone-comparison.json`. All three were inspected. No tone mapping preserves saturated yellow housing and the strongest white pool; AgX compresses/desaturates it, and ACES retains more yellow while warming the pool. Fence occlusion is visible in all three.

| Tone mapping | Draw calls | Triangles | Light field CPU ms | Shadow maps |
| --- | --- | --- | --- | --- |
| None | 33 | 128,255 | 0.100 | 1 |
| AgX | 33 | 128,255 | 0.100 | 1 |
| ACES | 33 | 128,255 | 0.100 | 1 |

The counters are paused scene counters, not GPU timing comparisons. The final perf evidence and before/after table in `report.md` supply production frame measurements. GPU timings for the alternative WebGPU lighting systems are not fabricated.

## Deferred extras

SSR/GTAO/planar water are explicitly staged after release closure by `specs/04-epics-overview.md` §6. Cheap wet reflection splats are implemented and measured on both tiers; the SSR car silhouette overlap part of AC10 remains deferred to that extras lane.
