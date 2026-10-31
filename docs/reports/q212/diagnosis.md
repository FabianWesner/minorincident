# Q-212 diagnosis

## Baseline and repeated graph cost

L7 high is the only over-budget baseline row: 6,094.1 ms on the first profile, then
3,427.8 / 3,375.9 / 3,376.4 / 3,391.6 ms. The first shader compilation is 3,605.2 ms
and its first driver warm-up is 565.2 ms; later profiles spend about 1,730–1,781 ms
and 63–79 ms respectively. Every profile has a new browser/profile/cache; OS/driver
caches remain shared. This first-sample tail is retained in the budget comparison.

On that slow sample, layout registration is 4.3 ms, simulation preparation 249 ms,
and the view 5,707.6 ms. The longest individual recorded resource is a layout GLB
at 111.5 ms. Resource requests and scene phases overlap; their durations cannot be
added to reconstruct the critical path. The receipt includes GLB/KTX2 resource,
bake, scene, shader and driver phases rather than inferring cost from file size.

A separate profiled fresh-browser load, after the baseline L7 observations, takes
3,483.1 ms. It cannot recreate the already-warmed OS/driver cache. In its roughly
1,774 ms shader window, the CPU profile attributes 1,484 ms to Three's graph
construction and 149 ms to GC, versus 20 ms idle. Async pipeline calls overlap and
must not be summed as wall time. Diagnostic loads are excluded from acceptance.

## Change and effect

`CrowdView` now uses L4's existing feature-keyed shared graph path for the seven
ordinary infected models on every level. Per-draw pose, atlas and instance buffer
binding remain in place. The feature key retains the branch differences for
accessories, skin, sidedness, human/animal surfaces and Alpha shading. Alpha-specific
exceptions retain their original conditions. No assets, LOD geometry, quality
settings, content, corpse lifetime or warm-up coverage change.

The L7 census changes 14 ordinary material graphs to one across the same 14 batches.
Total node builds fall by 25 on each configuration:

| Backend | Tier | Before | After |
|---|---|---:|---:|
| WebGPU | high | 288 | 263 |
| WebGPU | low | 253 | 228 |
| WebGL2 | high | 287 | 262 |
| WebGL2 | low | 252 | 227 |

The matched after diagnostic takes 3,148.2 ms. Three graph CPU time is 1,210 ms
(−18.5%) and GC 119 ms, with 18 ms idle in its 1,441 ms shader window. It ran after
the final L8 high batch; the baseline diagnostic ran after baseline L7 high/low.
Both are fresh browsers with shared OS/driver caches, so this is diagnostic evidence,
not a randomized driver-cache experiment.

Acceptance L7 high median improves 3,391.6 → 3,010.9 ms (−11.2%); low improves
3,209.4 → 2,840.5 ms (−11.5%). The high worst case improves 6,094.1 → 3,076.6 ms,
but the entire worst-case reduction cannot be attributed to the code change:
the baseline's first shader/driver tail was not recreated. No outlier was dropped.

## Scope and remaining margin

The distinct historical L3/L4 overages do not reproduce on the measured main build:
baseline L3 high/low is 3.075/3.010 s and L4 is 5.959/4.328 s, worst of five.
Final L3 is 3.093/2.927 s and L4 is 5.975/4.310 s. L4 high has only 24.6 ms of
headroom; these receipts establish a pass on this quiet native machine, not a
large safety margin. Local production preview does not reproduce live-site network
latency or prove that an older deployed artifact had identical costs.

All 20 final rows pass. There is no unmeasured level or remaining over-budget row.

Evidence: [before diagnostic](evidence/diagnostic-main-L7-high/),
[after diagnostic](evidence/diagnostic-after-L7-high/),
[graph and geometry comparison](evidence/graph-comparison.json).

## Corpse surface comparison

Dense live frames match exactly in all four backend/tier configurations. Dense corpse
frames change 25,428 / 5,273 / 2,344 / 4,719 RGB pixels (WebGPU high/low, WebGL2
high/low), including antialiasing. Every corpse root, retained identity, layout and
batch geometry still matches the baseline. A second fixture spaces the seven
ordinary appearances apart: all eight live/frozen image pairs are pixel-identical.
These results are consistent with different material sorting at overlapping surfaces
in the dense pile; they rule out an appearance/atlas change in the separated cases.
Both fixtures retain their bodies for another 30 simulated seconds with no node builds.
[Dense differences](evidence/graph-image-comparison.json),
[separated comparison](evidence/spaced-image-comparison.json).
