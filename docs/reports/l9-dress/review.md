# L9-D2 game-camera review

Rebuilt and reran the final sources, then opened and inspected all four labelled capture grids: [WebGL high](webgl2-high.jpg), [WebGL low](webgl2-low.jpg), [WebGPU high](webgpu-high.jpg), [WebGPU low](webgpu-low.jpg). Each contains all six areas at zoom 1.5, 1.0 and 0.5. The cameras use the game's isometric view and target the authored landmark; these are area reviews rather than a continuous vehicle-follow recording.

| Area | Observed in the captures |
| --- | --- |
| Fork | Pale direction arrows stand out on the darker road and dry soil. At zoom 1.5 the road/soil boundary remains distinct; the close view retains crisp paint edges. |
| Road | The existing gas station gives the highway an abandoned service-stop landmark. Its red/blue fascia, cool roof and canopy remain legible at both tiers; the close camera crops the roof as expected. |
| Countryside | Warm farmhouse windows contrast with the cool roof, purple walls and dark grass. Low quality simplifies window bars and trim while retaining the house silhouette, porch and window glow. |
| Dry shortcut | A blue battered wreck sits on exposed brown ground, with small rock clusters nearby. The wide view reads as dry, scattered infrastructure; the close view preserves the wreck's broken hood and window outline. |
| Merged approach | The APC is readable beside the final painted chevrons; its headlights illuminate the night approach. The paint leads east along the common lane. The shoulder remains open rather than being fenced into a corridor. |
| Crash lip | The road visibly ends at the broken bridge edges. Fallen slabs, a wreck below the lip and the dark gully read as a missing section, with no flat terrain spanning the hole. The courier remains visible on the intact approach. |

Both renderers preserve the same positions, ground boundaries and silhouettes. Low quality retains the navigation paint, warm window glow and rock/wreck shapes. No new visible intersections or terrain flicker were observed; all 72 scenes report zero static clipping and zero console errors. Scene Lab's requested-backend gate verifies actual WebGL and actual WebGPU; the CLI name `webgl2` is normalized to renderer telemetry `webgl`, and a WebGPU fallback still fails.

The complete matrix passes 72/72 at the unchanged strict 300-draw/500k-triangle gates: observed maxima are 36 draws and 117,590 triangles. Compact per-scene results are in [WebGL metrics](matrix-webgl2.json) and [WebGPU metrics](matrix-webgpu.json). The campaign reuses `L9-crossing` moonlight and a dry wind timeline at strength 0.2; isolated scenes use the existing stronger `wind` override, with no rain or wetness. The two 200 m sight lines and every road/detour hull are checked by the district tests rather than inferred from these close camera crops.

The populated region probe passes all 60 combinations (five areas × three zooms × two tiers × two actual backends). Each uses 200 infected on high or 100 on low, three seconds of warmup and three seconds of native cadence sampling. Low uses a 390×844 viewport and 4× CPU throttling; high uses 1600×900. All frame/sim/draw/triangle/collected-heap and 25/9 terrain-residency limits remain unchanged. See [raw region measurements](perf-summary.json).

| Backend / tier | Worst frame p95 | Worst sim tick p95 | Peak draws | Peak triangles | Collected heap |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebGL high | 5.6 ms | 1.1 ms | 65 | 239,946 | 158.0 MB |
| WebGL low | 8.8 ms | 2.6 ms | 56 | 53,016 | 114.3 MB |
| WebGPU high | 3.8 ms | 1.1 ms | 65 | 239,946 | 153.9 MB |
| WebGPU low | 10.3 ms | 2.5 ms | 56 | 53,016 | 111.0 MB |

These short region measurements do not establish whole-route streaming/crash hitch or repeated-traversal memory bounds; the separate existing streaming probe supplies those results. Heap above is collected CDP `usedSize`, matching the existing probe; transient `performance.memory` estimates are retained in the route data rather than represented as a collected-heap pass.

## Route probes and validation provenance

The initial full-route runs are retained in `routes-healthy.json` and `routes-floor.json`, including four high-quality timing misses. Profiling showed repeated height lookups through unrelated resident terrain cells and a synchronous LOD0 `staticBatch` burst at the highway service stop. The fixes reject cells outside their existing bounds before sampling height (including the seam apron) and reuse the existing asynchronous batch converter for foreground LOD0 loads. The height/seam regression test passes; no timing or geometry budget was increased.

The post-fix healthy high run in `high-healthy-sliced.json` passes all three routes: frame p95 11.8/13.1/12.9 ms, maximum hitches 34.4/34.7/34.7 ms, at 200 infected. All complete the forced crash. Its repeated traversal heap grows only 0.25%, with geometry and texture counts unchanged. The earlier low and throttled phone runs pass all three routes in both healthy and zero-HP conditions; those full-route measurements precede the two performance fixes. The final populated region matrix above covers both fixes at every backend/tier/zoom combination.

Full remote unit validation passes 1,329 tests with seven skipped. Focused crossing simulation passes 21 tests, including all three routes, roadside detours, healthy/zero-HP crashes and bypass attempts near both north/south map boundaries. The final navigation/weather walk recheck passes five tests; the two residency timing cases pass separately on an idle runner.

The broad remote sim run recorded 903 passes and 16 failures; the level run recorded 242 passes, 11 failures and two skips. Detailed original failures remain in `validation-summary.json`. The unchanged baseline reproduces the L2 final objective marker failure and the all-district navigation timeout. The weather timeout from the initial dressing was addressed by removing redundant house navigation exclusions; the final weather walk passes in about 94 seconds. Broad mixed-horde timing misses occurred under runner contention; the crossing residency timing cases pass on isolated recheck. The remaining L1–L6 level failures were not changed by this lane. These broad suites are not reported as green.

The post-fix zero-HP high run in `high-floor-sliced.json` also passes all three routes: frame p95 12.4/12.4/13.2 ms and maximum hitches 35.9/36.4/36.4 ms. Each completes the same crash, with 200 infected and at most 25 resident cells. Its repeated-traversal heap and geometry/texture counts pass the unchanged 10% growth bound.

Final `npm run verify -- E31` exits zero: typecheck, lint, build, 82 remote unit/sim selections and 55 headless browser tests pass. See `verify-checks.json` and `verify-vitest.json`. No protected source/reference files or unrelated static-collision changes are included.
