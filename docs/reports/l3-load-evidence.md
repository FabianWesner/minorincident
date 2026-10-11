# L3 loading evidence — 2026-10-11

## Scope and measurement limits

PROD `3c30b499` and QA `5a9d2682` were measured at their real HTTPS URLs. Chrome is headless, 1600×900, DPR 1, high tier, Apple M4 Metal. Explicit WebGL2 uses ANGLE/Metal; default selection uses native WebGPU (`apple`, `metal-3`, not a fallback adapter). HTTP throttles: 50 Mbit/s down, 10 Mbit/s up, 20 ms latency; fast 4G is 10 Mbit/s down/up, 150 ms latency. Each matrix pair originally used a fresh incognito context with a shared browser process; final candidate and `*-fresh-metal` confirmations use a newly launched browser/profile per cold/warm pair. Warm reload retains its profile/cache. OS GPU driver caches remain shared. The JSON records adapter, backend, Mac load averages, frames, timings, errors and CPU samples.

The Mac simultaneously runs QA jobs. These are individual observations, not statistically controlled medians. Profiling/tracing adds overhead; do not infer a precise percentage improvement across samples. Browser runs use `tools/e2e-lock.sh`, one measurement page at a time. No headed window, deployment or merge occurred. An initial candidate boot timed out while its proxy was restarted; it produced no completed timing row and was rerun after a stable build.

The candidate uses built local application bundles over HTTPS/HTTP2 and proxies unchanged public assets from **deployed QA**; two regenerated police-station bakes are local. The proxy applies candidate Cloudflare cache headers and Brotli bundle transport. Consequently candidate numbers are a simulation with real remote asset transfers, not a measured fixed deployment. Local bundle delivery has less origin latency. A deployed before/after cannot be claimed under the no-deploy instruction.

The script seeds a valid unlocked campaign then clicks the actual Level select and Level N buttons. For transition it loads/begins L2, uses the native mission state controller to reach the bridge, dwells 10 s and completes the bridge, allowing the native campaign L3 transition. Transition cold means a fresh profile **before L2**, so naturally shared/prefetched content may already be cached when L3 starts. The dwell starts after the finish objective activates; it measures late prefetch but does not isolate the new five-second early prefetch's benefit during a full L2 playthrough. It includes the transition outro. Briefing Begin is clicked as soon as available; its automation delay is separately recorded. First playable is the first rAF after Begin and card disappearance (one-frame timestamp precision), followed by 10 s of idle rAF frame gaps. It is not an input-response/GPU-present fence measurement and is not a 10 s movement benchmark. Card latency can be a fraction negative from rAF frame-start timestamps; display clamps it to zero, raw JSON preserves it.

Earlier load-times numbers forced WebGL, ran without network throttling, reused already booted content, and reported a ready/Begin-path interval. The PO's default renderer and level-select/network wait are materially different. Default PROD reproduces the complaint.

## L3 complete matrix

Seconds from level-select click or bridge completion. Sim, crowd and warmup are nested/overlapping phases; do not add them. Frame numbers cover the first ten playable seconds. `fresh` confirmation rows supersede the shared-process 50 Mbit select samples for interpretation.

| Build/sample | Network | Entry | Cache | To card | Card | Playable | Sim | Crowd | Warmup | frame p95 / max ms | >50 ms |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| prod (webgpu) | 50mbit | select | cold | 0.014 | 31.032 | 31.396 | 6.722 | 3.955 | 19.716 | 16.8 / 166.7 | 3 |
| prod (webgpu) | 50mbit | select | warm | 0.007 | 14.850 | 15.140 | 6.072 | 2.464 | 5.174 | 16.8 / 133.3 | 1 |
| qa (webgpu) | 50mbit | select | cold | 0.014 | 19.449 | 19.530 | 0.385 | 6.788 | 11.574 | 16.8 / 16.8 | 0 |
| qa (webgpu) | 50mbit | select | warm | 0.015 | 9.600 | 9.615 | 0.358 | 6.729 | 1.998 | 16.8 / 16.8 | 0 |
| qa-default-trace (webgpu) | 50mbit | select | cold | 0.015 | 24.616 | 24.964 | 0.442 | 6.798 | 16.702 | 16.8 / 650.0 | 5 |
| qa-default-trace (webgpu) | 50mbit | select | warm | 0.012 | 12.783 | 12.862 | 0.394 | 10.058 | 1.509 | 16.7 / 16.8 | 0 |
| prod-metal-full (webgl2) | 50mbit | select | cold | 0.013 | 18.633 | 18.779 | 7.072 | 3.606 | 7.021 | 16.8 / 333.3 | 4 |
| prod-metal-full (webgl2) | 50mbit | select | warm | 0.002 | 17.883 | 17.984 | 7.060 | 2.887 | 6.531 | 16.7 / 333.2 | 1 |
| prod-metal-full (webgl2) | 50mbit | transition | cold | 0.252 | 13.983 | 14.301 | 6.855 | 0.224 | 5.662 | 16.8 / 216.6 | 1 |
| prod-metal-full (webgl2) | 50mbit | transition | warm | 0.152 | 15.533 | 16.318 | 6.989 | 0.343 | 6.801 | 33.3 / 349.9 | 2 |
| prod-metal-full (webgl2) | 4g | select | cold | 0.010 | 21.182 | 21.376 | 6.872 | 5.072 | 6.039 | 16.8 / 250.0 | 2 |
| prod-metal-full (webgl2) | 4g | select | warm | 0.013 | 15.616 | 15.712 | 6.415 | 2.308 | 5.677 | 16.7 / 216.6 | 1 |
| prod-metal-full (webgl2) | 4g | transition | cold | 0.148 | 14.166 | 14.514 | 6.862 | 0.205 | 5.533 | 16.8 / 250.1 | 1 |
| prod-metal-full (webgl2) | 4g | transition | warm | 0.101 | 14.333 | 14.550 | 6.822 | 0.265 | 6.026 | 16.8 / 300.0 | 2 |
| qa-metal (webgl2) | 50mbit | select | cold | 0.000 | 9.783 | 9.782 | 0.722 | 7.118 | 1.218 | 16.8 / 33.3 | 0 |
| qa-metal (webgl2) | 50mbit | select | warm | 0.014 | 8.950 | 9.163 | 0.444 | 6.688 | 1.379 | 16.7 / 16.8 | 0 |
| qa-metal (webgl2) | 50mbit | transition | cold | 0.056 | 3.650 | 4.023 | 0.583 | 1.103 | 1.550 | 16.8 / 16.8 | 0 |
| qa-metal (webgl2) | 50mbit | transition | warm | 0.020 | 2.950 | 3.136 | 0.319 | 0.996 | 0.753 | 16.7 / 16.8 | 0 |
| qa-metal (webgl2) | 4g | select | cold | 0.011 | 39.398 | 39.409 | 0.585 | 36.127 | 1.051 | 16.8 / 66.6 | 1 |
| qa-metal (webgl2) | 4g | select | warm | 0.007 | 39.682 | 39.722 | 0.464 | 35.086 | 1.391 | 16.8 / 33.3 | 0 |
| qa-metal (webgl2) | 4g | transition | cold | 0.084 | 18.699 | 19.117 | 0.469 | 15.947 | 1.184 | 16.8 / 16.8 | 0 |
| qa-metal (webgl2) | 4g | transition | warm | 0.037 | 13.916 | 14.287 | 0.436 | 10.389 | 1.068 | 16.7 / 16.8 | 0 |
| prod-fresh-metal (webgl2) | 50mbit | select | cold | 0.010 | 18.416 | 18.492 | 6.228 | 2.834 | 8.298 | 16.8 / 533.2 | 2 |
| prod-fresh-metal (webgl2) | 50mbit | select | warm | 0.003 | 15.966 | 16.019 | 6.402 | 2.419 | 5.940 | 16.8 / 216.6 | 1 |
| qa-fresh-metal (webgl2) | 50mbit | select | cold | 0.014 | 11.116 | 11.147 | 0.464 | 6.683 | 3.295 | 16.8 / 16.8 | 0 |
| qa-fresh-metal (webgl2) | 50mbit | select | warm | 0.002 | 9.150 | 9.451 | 0.621 | 6.054 | 1.781 | 16.8 / 33.3 | 0 |
| fix-final-metal (webgl2) | 50mbit | select | cold | 0.008 | 6.300 | 6.408 | 0.531 | 3.729 | 1.543 | 16.8 / 33.4 | 0 |
| fix-final-metal (webgl2) | 50mbit | select | warm | 0.014 | 3.100 | 3.563 | 0.428 | 0.816 | 1.026 | 16.7 / 16.8 | 0 |
| fix-final-metal (webgl2) | 50mbit | transition | cold | 0.023 | 2.783 | 3.206 | 0.371 | 0.047 | 1.398 | 16.8 / 16.8 | 0 |
| fix-final-metal (webgl2) | 50mbit | transition | warm | 0.065 | 2.300 | 2.665 | 0.393 | 0.058 | 0.861 | 16.7 / 33.4 | 0 |
| fix-final-metal (webgl2) | 4g | select | cold | 0.012 | 20.799 | 20.811 | 0.441 | 18.289 | 1.247 | 16.7 / 16.8 | 0 |
| fix-final-metal (webgl2) | 4g | select | warm | 0.013 | 2.950 | 3.029 | 0.427 | 0.880 | 1.100 | 16.7 / 16.8 | 0 |
| fix-final-metal (webgl2) | 4g | transition | cold | 0.063 | 3.333 | 3.647 | 0.468 | 0.085 | 1.059 | 16.8 / 183.4 | 1 |
| fix-final-metal (webgl2) | 4g | transition | warm | 0.070 | 3.050 | 3.253 | 0.399 | 0.084 | 1.065 | 16.7 / 33.3 | 0 |
| fix-final-default (webgpu) | 50mbit | select | cold | 0.014 | 15.599 | 15.713 | 0.327 | 3.442 | 11.415 | 16.8 / 66.7 | 1 |
| fix-final-default (webgpu) | 50mbit | select | warm | 0.013 | 2.350 | 2.630 | 0.379 | 0.706 | 0.928 | 16.8 / 16.8 | 0 |

## L1/L2/L3/L4 under identical deployed WebGL conditions

| Build | Level | Network | Cache | To card s | Card s | Playable s | Sim s | Crowd s | Warmup s | page CDP MB / requests | GL links at card end* | frame p95 / max ms |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| prod-metal-full | L1 | 50mbit | cold | 0.002 | 16.849 | 17.018 | 0.000 | 0.000 | 6.456 | 5.24 / 23 | 146 | 16.8 / 133.3 |
| prod-metal-full | L1 | 50mbit | warm | 0.011 | 16.249 | 16.410 | 0.000 | 0.000 | 7.165 | 0.00 / 19 | 146 | 16.8 / 150.0 |
| prod-metal-full | L2 | 50mbit | cold | 0.011 | 15.466 | 15.593 | 2.027 | 4.017 | 7.915 | 11.85 / 237 | 146 | 16.8 / 533.3 |
| prod-metal-full | L2 | 50mbit | warm | 0.012 | 13.133 | 13.378 | 2.115 | 3.065 | 6.434 | 0.00 / 113 | 146 | 16.8 / 550.0 |
| prod-metal-full | L3 | 50mbit | cold | 0.013 | 18.633 | 18.779 | 7.072 | 3.606 | 7.021 | 11.81 / 258 | 142 | 16.8 / 333.3 |
| prod-metal-full | L3 | 50mbit | warm | 0.002 | 17.883 | 17.984 | 7.060 | 2.887 | 6.531 | 0.00 / 121 | 142 | 16.7 / 333.2 |
| prod-metal-full | L4 | 50mbit | cold | 0.007 | 10.733 | 10.823 | 0.121 | 3.246 | 3.314 | 9.06 / 152 | 99 | 16.8 / 199.9 |
| prod-metal-full | L4 | 50mbit | warm | 0.012 | 9.550 | 9.862 | 0.122 | 2.908 | 2.748 | 0.00 / 85 | 99 | 16.7 / 216.7 |
| prod-metal-full | L1 | 4g | cold | 0.011 | 20.733 | 20.910 | 0.140 | 5.277 | 6.329 | 11.60 / 111 | 146 | 16.7 / 116.7 |
| prod-metal-full | L1 | 4g | warm | 0.011 | 16.899 | 17.060 | 0.000 | 0.000 | 7.473 | 0.00 / 19 | 146 | 16.8 / 150.0 |
| prod-metal-full | L2 | 4g | cold | 0.002 | 18.399 | 18.535 | 1.797 | 4.898 | 5.967 | 14.02 / 252 | 146 | 16.8 / 549.9 |
| prod-metal-full | L2 | 4g | warm | 0.012 | 12.066 | 12.178 | 1.901 | 2.658 | 6.102 | 0.00 / 113 | 146 | 16.8 / 633.3 |
| prod-metal-full | L3 | 4g | cold | 0.010 | 21.182 | 21.376 | 6.872 | 5.072 | 6.039 | 11.11 / 244 | 142 | 16.8 / 250.0 |
| prod-metal-full | L3 | 4g | warm | 0.013 | 15.616 | 15.712 | 6.415 | 2.308 | 5.677 | 0.00 / 121 | 142 | 16.7 / 216.6 |
| prod-metal-full | L4 | 4g | cold | 0.007 | 13.599 | 13.723 | 0.108 | 4.376 | 3.162 | 9.67 / 176 | 98 | 16.8 / 166.6 |
| prod-metal-full | L4 | 4g | warm | 0.012 | 9.916 | 10.128 | 0.094 | 2.607 | 2.974 | 0.00 / 85 | 99 | 16.8 / 183.3 |
| qa-metal | L1 | 50mbit | cold | 0.014 | 10.066 | 10.130 | 0.099 | 5.549 | 3.749 | 7.56 / 87 | 103 | 16.8 / 33.3 |
| qa-metal | L1 | 50mbit | warm | 0.000 | 5.800 | 6.166 | 0.000 | 0.000 | 1.704 | 1.10 / 21 | 103 | 16.7 / 33.3 |
| qa-metal | L2 | 50mbit | cold | 0.013 | 10.200 | 10.513 | 0.223 | 6.751 | 2.602 | 18.44 / 272 | 101 | 16.8 / 33.4 |
| qa-metal | L2 | 50mbit | warm | 0.010 | 7.700 | 7.893 | 0.289 | 5.408 | 1.319 | 15.21 / 280 | 101 | 16.8 / 33.4 |
| qa-metal | L3 | 50mbit | cold | 0.000 | 9.783 | 9.782 | 0.722 | 7.118 | 1.218 | 16.43 / 280 | 98 | 16.8 / 33.3 |
| qa-metal | L3 | 50mbit | warm | 0.014 | 8.950 | 9.163 | 0.444 | 6.688 | 1.379 | 14.47 / 281 | 98 | 16.7 / 16.8 |
| qa-metal | L4 | 50mbit | cold | 0.014 | 8.033 | 8.347 | 0.080 | 6.057 | 1.555 | 13.08 / 206 | 99 | 16.8 / 133.3 |
| qa-metal | L4 | 50mbit | warm | 0.014 | 6.433 | 6.548 | 0.088 | 4.791 | 1.196 | 10.12 / 206 | 99 | 16.8 / 166.6 |
| qa-metal | L1 | 4g | cold | 0.007 | 29.399 | 29.406 | 0.000 | 0.000 | 0.927 | 1.07 / 20 | 103 | 16.7 / 16.8 |
| qa-metal | L1 | 4g | warm | 0.011 | 3.716 | 3.861 | 0.000 | 0.000 | 1.667 | 0.00 / 17 | 103 | 16.8 / 866.7 |
| qa-metal | L2 | 4g | cold | 0.013 | 39.348 | 39.394 | 0.266 | 35.788 | 1.948 | 22.35 / 240 | 101 | 16.7 / 33.3 |
| qa-metal | L2 | 4g | warm | 0.009 | 31.132 | 31.441 | 0.261 | 27.520 | 1.379 | 19.72 / 234 | 101 | 16.8 / 1099.9 |
| qa-metal | L3 | 4g | cold | 0.011 | 39.398 | 39.409 | 0.585 | 36.127 | 1.051 | 18.28 / 263 | 98 | 16.8 / 66.6 |
| qa-metal | L3 | 4g | warm | 0.007 | 39.682 | 39.722 | 0.464 | 35.086 | 1.391 | 20.08 / 263 | 98 | 16.8 / 33.3 |
| qa-metal | L4 | 4g | cold | 0.005 | 33.015 | 33.171 | 0.119 | 31.073 | 0.846 | 15.80 / 185 | 99 | 16.8 / 100.1 |
| qa-metal | L4 | 4g | warm | 0.015 | 32.565 | 32.630 | 0.074 | 30.183 | 0.921 | 15.25 / 194 | 99 | 16.7 / 116.6 |

*GL link counts in early samples are cumulative through the ten-second capture rather than an exact isolated L3 variant count. Final fresh captures retain `glStart`/`glEnd` for deltas. Link calls/pipeline calls are proxies for shader variants, not distinct source hashes. Page CDP misses worker-origin requests; use trace network totals for the cold L3 full transfer count. Tables retain every comparable raw observation, including slow or noisy results.

## Attribution and changes

- PROD L3 spends roughly 6–7 s building simulation/nav and 5–20 s warming the renderer. Main's existing load-times changes already cut sim to roughly 0.3–0.7 s. Candidate instrumentation splits world+nav, mission+cast, physics preparation; cold 50 Mbit final shows 490 / 8 / 29 ms respectively. Police squad setup is not the remaining bottleneck.
- Base layouts: L1/L2 D-GROVE has 1,314 placements / 57 distinct asset IDs and 340×220 nav cells (74,800); L3 D-CORRIDOR has 1,165 / 24 and 688×184 (126,592); L4 D-FAIR has 444 / 20 and 340×260 (88,400). These are base counts before mission dressing, not total rendered objects. L3 has 6 post officers plus 4 squad officers, 8 checkpoint soldiers and 13 authored corpses. Its grid is larger, but its current sim phase is small.
- QA's native WebGPU traced cold sample spends 16.70 s in warmup (chunks 12.36 s, draw 4.09 s). Calls observed through capture: 190 shader modules, 106 synchronous plus 20 asynchronous render pipelines, and 1,329 texture writes consuming 3.92 s synchronously. These API wall times do not separate driver compilation from GPU execution. Candidate foreground chunks change 16→1024 while retaining every warmed object, compilation/fences and draw passes. Background batches keep their previous limits.
- Fresh QA and candidate Metal/WebGL L3 both have 134 shader compile calls and 71 program links during the load (end minus start counters). Synchronous getProgramParameter time is 629 ms QA /364 ms candidate; this is a driver-status/wait proxy, not total shader compilation. Raw shader measures have the existing `L1` label even on L3, so the report associates them by timestamp and scenario.
- Runtime static bakes expand repeated source geometry: on-ramp 1.346 MB vs source 84 KB, pharmacy 1.303 MB vs 153 KB, bridge 1.113 MB vs 117 KB. Forty-five bake entries total 28.813 MB versus 4.691 MB of source GLBs. The candidate keeps original-quality meshopt sources for entries >2×source size, and adds the same guard to the generator. Existing bake files stay available to older sessions. Two stale police-station LOD bakes were regenerated from current source because equivalence unit checks exposed mismatches.
- Eight crowd workers previously eagerly booted a 2.5 MB script with Three and animation clips. The compressed-bake path now boots an 8.4 KB entry; source fallback imports its dependencies on demand. Fallback remains available. The complete L3 cast is seven models rather than twelve initial models, retaining all three LODs and all emerging pedestrians; missing future models are still discovered dynamically. Tests cover corpse and pedestrian membership. No authored entity was removed.
- Prefetch starts after five playing seconds in L2 and fetches shipped crowd bakes instead of also downloading unused source GLBs. All visual assets/LODs remain. Versioned civilian/static bake URLs gain immutable one-year Cloudflare Pages caching; deployed QA currently returns max-age=0/must-revalidate on these directories, explaining the weak warm-cache benefit and 4G warm wait.
- Long tasks, phase measurements and sampled main-thread functions are in raw JSON/summary.csv. GLTF meshopt decode and static object preparation overlap district loading and are visible in CPU profiles; there is no defensible exclusive decode subtotal across workers/render threads. The added worker timeline separates fetch from inflate. ResourceFinish encoded bytes are used for full trace counts, because ResourceReceivedData can report body bytes again for memory-cache consumers. Worker sums overlap and are not added to elapsed loading time.

## Trace network / worker evidence

- `qa-default-trace-L3-50mbit-select-cold.trace.json.gz`: 46.79 MB completed during L3 card, civilian bakes 26.60 MB; 193 URLs with transferred bytes.
- `fix-final-metal-L3-50mbit-select-cold.trace.json.gz`: 23.87 MB completed during L3 card, civilian bakes 15.81 MB; 143 URLs with transferred bytes. civilian:download: 21 tasks, overlapping sum 24639 ms, maximum 2516 ms; civilian:inflate: 21 tasks, overlapping sum 166 ms, maximum 12 ms
- `fix-final-default-L3-50mbit-select-cold.trace.json.gz`: 23.50 MB completed during L3 card, civilian bakes 15.81 MB; 135 URLs with transferred bytes. civilian:download: 21 tasks, overlapping sum 24435 ms, maximum 2270 ms; civilian:inflate: 21 tasks, overlapping sum 109 ms, maximum 8 ms
- `fix-final-metal-L3-4g-select-cold.trace.json.gz`: 24.46 MB completed during L3 card, civilian bakes 15.81 MB; 146 URLs with transferred bytes. civilian:download: 21 tasks, overlapping sum 135830 ms, maximum 11918 ms; civilian:inflate: 21 tasks, overlapping sum 153 ms, maximum 16 ms

### qa-default-trace-L3-50mbit-select-cold.trace.json.gz

| Asset / chunk | Bytes transferred during card |
|---|---:|
| `started before trace` | 5679589 |
| `kit.highway-onramp.lod2.base.92c79ed158007621.bin.gz` | 1347757 |
| `npc.lab-guard.lod0.65c717b3676c2547.bin.gz` | 1246911 |
| `npc.civilian-man-b.lod0.5d1878469e1c9c4f.bin.gz` | 1164066 |
| `npc.national-guard.lod0.c86eacb604db3444.bin.gz` | 1132264 |
| `npc.civilian-woman-a.lod0.b83f77aaf0bfb950.bin.gz` | 1123268 |
| `npc.civilian-elderly.lod0.743ea7c2d72711d4.bin.gz` | 1119591 |
| `npc.depot-clerk.lod0.8c643956dbbc0af0.bin.gz` | 1115897 |
| `bld.river-bridge.lod2.base.5641fc4efe4e7965.bin.gz` | 1113983 |
| `npc.civilian-man-a.lod0.19e89196c5930f45.bin.gz` | 1098311 |

### fix-final-metal-L3-50mbit-select-cold.trace.json.gz

| Asset / chunk | Bytes transferred during card |
|---|---:|
| `started before trace` | 1840128 |
| `npc.civilian-man-b.lod0.5d1878469e1c9c4f.bin.gz` | 1163952 |
| `npc.national-guard.lod0.c86eacb604db3444.bin.gz` | 1132191 |
| `npc.civilian-woman-a.lod0.b83f77aaf0bfb950.bin.gz` | 1123054 |
| `npc.civilian-elderly.lod0.743ea7c2d72711d4.bin.gz` | 1119687 |
| `npc.civilian-man-a.lod0.19e89196c5930f45.bin.gz` | 1098136 |
| `npc.civilian-woman-b.lod0.4a7c452418e1e7b3.bin.gz` | 1049375 |
| `npc.police-officer.lod0.0741c2c4a6456fcb.bin.gz` | 958108 |
| `npc.national-guard.lod1.af137ebfbfd6f32f.bin.gz` | 725553 |
| `char.courier-male.skin.glb?v=a0c87e1c8c` | 711508 |

### fix-final-default-L3-50mbit-select-cold.trace.json.gz

| Asset / chunk | Bytes transferred during card |
|---|---:|
| `started before trace` | 1868929 |
| `npc.civilian-man-b.lod0.5d1878469e1c9c4f.bin.gz` | 1164162 |
| `npc.national-guard.lod0.c86eacb604db3444.bin.gz` | 1132361 |
| `npc.civilian-woman-a.lod0.b83f77aaf0bfb950.bin.gz` | 1123056 |
| `npc.civilian-elderly.lod0.743ea7c2d72711d4.bin.gz` | 1119689 |
| `npc.civilian-man-a.lod0.19e89196c5930f45.bin.gz` | 1098400 |
| `npc.civilian-woman-b.lod0.4a7c452418e1e7b3.bin.gz` | 1049438 |
| `npc.police-officer.lod0.0741c2c4a6456fcb.bin.gz` | 958301 |
| `npc.national-guard.lod1.af137ebfbfd6f32f.bin.gz` | 725572 |
| `char.courier-male.skin.glb?v=a0c87e1c8c` | 711481 |

### fix-final-metal-L3-4g-select-cold.trace.json.gz

| Asset / chunk | Bytes transferred during card |
|---|---:|
| `started before trace` | 2228125 |
| `npc.civilian-man-b.lod0.5d1878469e1c9c4f.bin.gz` | 1163925 |
| `npc.national-guard.lod0.c86eacb604db3444.bin.gz` | 1132270 |
| `npc.civilian-woman-a.lod0.b83f77aaf0bfb950.bin.gz` | 1123217 |
| `npc.civilian-elderly.lod0.743ea7c2d72711d4.bin.gz` | 1119572 |
| `npc.civilian-man-a.lod0.19e89196c5930f45.bin.gz` | 1098207 |
| `npc.civilian-woman-b.lod0.4a7c452418e1e7b3.bin.gz` | 1049545 |
| `npc.police-officer.lod0.0741c2c4a6456fcb.bin.gz` | 958172 |
| `npc.national-guard.lod1.af137ebfbfd6f32f.bin.gz` | 725379 |
| `char.courier-male.skin.glb?v=a0c87e1c8c` | 711430 |

### Largest completed transfers per cold trace

| Sample | Asset / chunk | Encoded bytes |
|---|---|---:|
| qa-default-trace | `started before trace` | 5679589 |
| qa-default-trace | `kit.highway-onramp.lod2.base.92c79ed158007621.bin.gz` | 1347757 |
| qa-default-trace | `npc.lab-guard.lod0.65c717b3676c2547.bin.gz` | 1246911 |
| qa-default-trace | `npc.civilian-man-b.lod0.5d1878469e1c9c4f.bin.gz` | 1164066 |
| qa-default-trace | `npc.national-guard.lod0.c86eacb604db3444.bin.gz` | 1132264 |
| qa-default-trace | `npc.civilian-woman-a.lod0.b83f77aaf0bfb950.bin.gz` | 1123268 |
| qa-default-trace | `npc.civilian-elderly.lod0.743ea7c2d72711d4.bin.gz` | 1119591 |
| qa-default-trace | `npc.depot-clerk.lod0.8c643956dbbc0af0.bin.gz` | 1115897 |
| fix-final-metal | `started before trace` | 1840128 |
| fix-final-metal | `npc.civilian-man-b.lod0.5d1878469e1c9c4f.bin.gz` | 1163952 |
| fix-final-metal | `npc.national-guard.lod0.c86eacb604db3444.bin.gz` | 1132191 |
| fix-final-metal | `npc.civilian-woman-a.lod0.b83f77aaf0bfb950.bin.gz` | 1123054 |
| fix-final-metal | `npc.civilian-elderly.lod0.743ea7c2d72711d4.bin.gz` | 1119687 |
| fix-final-metal | `npc.civilian-man-a.lod0.19e89196c5930f45.bin.gz` | 1098136 |
| fix-final-metal | `npc.civilian-woman-b.lod0.4a7c452418e1e7b3.bin.gz` | 1049375 |
| fix-final-metal | `npc.police-officer.lod0.0741c2c4a6456fcb.bin.gz` | 958108 |
| fix-final-default | `started before trace` | 1868929 |
| fix-final-default | `npc.civilian-man-b.lod0.5d1878469e1c9c4f.bin.gz` | 1164162 |
| fix-final-default | `npc.national-guard.lod0.c86eacb604db3444.bin.gz` | 1132361 |
| fix-final-default | `npc.civilian-woman-a.lod0.b83f77aaf0bfb950.bin.gz` | 1123056 |
| fix-final-default | `npc.civilian-elderly.lod0.743ea7c2d72711d4.bin.gz` | 1119689 |
| fix-final-default | `npc.civilian-man-a.lod0.19e89196c5930f45.bin.gz` | 1098400 |
| fix-final-default | `npc.civilian-woman-b.lod0.4a7c452418e1e7b3.bin.gz` | 1049438 |
| fix-final-default | `npc.police-officer.lod0.0741c2c4a6456fcb.bin.gz` | 958301 |

Per URL/chunk: [network.csv.gz](l3-load-data/network.csv.gz) records every page CDP request, bytes, duration and cache status; [trace-network.csv](l3-load-data/trace-network.csv) includes worker transfers, encoded/decoded bodies and card-window membership. [summary.csv](l3-load-data/summary.csv) includes long-task counts/totals/maxima, frame statistics, per-phase seconds and Mac load averages. Gzipped original JSON preserves all rAF gaps, phases, CPU samples, resources, headers and errors. Gzipped Chrome traces can be inflated and loaded in DevTools Performance/Perfetto.

## Remaining target and release check

The final forced Metal/WebGL 50 Mbit cold select reaches playable at **6.408 s**, card 6.300 s: the ≤5 s target is **not met**. Its 23.87 MB transferred during the card includes 15.81 MB of seven full-quality crowd models ×three LODs; at 50 Mbit those bytes alone represent about 3.82 s of serial bandwidth. Crowd preparation is 3.729 s, warmup 1.543 s, sim 0.531 s, HUD 0.132 s. Downloads and view prep overlap, then renderer warmup follows. Default native WebGPU is substantially worse: candidate cold playable **15.713 s** /warm **2.630 s**; cold warmup 11.415 s, including 6.217 s chunk work and 5.153 s fenced draw. Across capture, 949 GPUQueue.writeTexture calls consume 5.663 s synchronously, including a 6.212 s main-thread long task during warmup. This identifies a remaining browser/driver upload path stall; the trace cannot identify an exclusive Metal driver/compiler cause. CPU samples spend 5.65 s in writeTexture. Its cold post-card maximum is 66.7 ms (one gap >50 ms). Warm select and both forced-WebGL L2 transitions are shorter. Further work needs investigation of the native texture upload/fence path, a smaller lossless crowd encoding/shared rig payload or preparation before selection, plus a real deployed candidate rerun. Generic meshopt/byte-shuffle experiments did not reduce the existing compressed payload; none were shipped. We do not lower LODs, remove content, or extend the card to claim success.

Visual inspection: retained station-yard capture shows multiple officers, blue/red-lit police SUVs, station facade/door and the handgun objective; army-checkpoint shows guards with rifles, watchtowers, barrier gate, wire fence, sandbags, lamps and truck. Start street shows courier/corgi, road markings, cones, lighting and readable HUD. These checks establish present content; they are not pixel-identical baseline comparisons. The 4G cold transition has one 183.4 ms rAF gap with no coincident reported main-thread long task; Mac load average is 22.1. Its cause is not resolved by these samples, and that gap is retained.

Validation: local typecheck/lint/build pass; remote full unit run 770 tests /151 files passes; subsequent remote focused cast/pipeline run 15 tests /2 files passes (adds the cast regression after the full run). Six remote sim smoke checks pass. Linux browser smoke: 21/26 pass, with software-adapter crashes/timeouts; native Metal browser smoke: 25/26 pass, only save/continue rack mismatch (expected bat/kick/fists, received fire-axe/bat). Untouched main `5a9d2682` in detached `/tmp/l3-load-baseline`, native Metal, reproduces exactly the same rack mismatch (one test, one worker, port 3349). A separate remote preview attempt could not start on occupied port 3301; another focused attempt hit runner disk capacity and was retried successfully on runner 1. Thus the requested all-smoke-pass gate is not claimed. No changes to specs, reference assets or dependencies; no deployment or merge.

## Reproduce

Run deployed measurements under the shared browser lock (one sequential browser per script):

```sh
RENDERER=webgl E2E_SLOTS=4 sh tools/e2e-lock.sh npx tsx tools/performance/l3-deployed.mjs https://minor-incident.com prod-repeat L1,L2,L3,L4 50mbit,4g select,transition
RENDERER=webgl E2E_SLOTS=4 sh tools/e2e-lock.sh npx tsx tools/performance/l3-deployed.mjs https://qa.minor-incident.pages.dev qa-repeat L1,L2,L3,L4 50mbit,4g select,transition
TRACE=1 E2E_SLOTS=4 sh tools/e2e-lock.sh npx tsx tools/performance/l3-deployed.mjs https://qa.minor-incident.pages.dev qa-default-repeat L3 50mbit select
```

For the candidate simulation, build, generate a temporary self-signed localhost certificate at `/tmp/l3-load-cert.pem` and `/tmp/l3-load-key.pem`, then start `npx tsx tools/performance/l3-candidate-proxy.mjs` (port 3368). Set `LOAD_SPKI` to that certificate's SHA256 public-key pin and run the same measurement against `https://127.0.0.1:3368`; do not use ignoreHTTPSErrors or Playwright request routing, which change caching. `TRACE=1` enables Chrome traces; `CAPTURE=1` captures start/station/checkpoint; `RESUME=1` skips completed cold/warm pairs in an uncompressed output JSON. Restart the proxy after a build so it does not retain outdated bundle bodies. Certificates/keys are temporary and are not committed.

Representative trace captures were retained; raw warm/profile timing and CPU records remain even where the larger trace was omitted. Duplicate intermediate `fix-metal` data was retained once as `fix-v1-metal.json.gz`. Validation excerpts are in [validation.txt](l3-load-data/validation.txt).
