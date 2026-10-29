# L9 cold load

Code: `a2afc8308` on `lane/l9-load`; paired baseline: starting main `2c391e65f`.

## Quiet cold-load acceptance

Five samples per variant/configuration, paired in alternating main/fix order, with a fresh empty context per menu click. Each measurement ends when the loading card closes; public production artifacts, 1600×900 at DPR 1, native Apple M4 Metal, no profiler. All 50 samples have the requested quality/backend and no browser errors. The single exclusive browser-pool reservation passed the [quiet preflight](quiet-conditions.jsonl). Browser storage/caches are isolated; OS/driver caches are shared. The baseline includes the earlier L10 changes and measures 5.49 s here; the 7,803 ms historical batch was recorded separately.

| Cold menu load | Main median (s) | Fix median (s) | Change (ms) | Fix range (s) |
| --- | ---: | ---: | ---: | ---: |
| L1-webgpu-low | 2.0924 | 2.0756 | -16.8 | 2.0581–2.0934 |
| L9-webgpu-low | 5.4929 | 5.2916 | -201.3 | 5.2587–5.5437 |
| L10-webgpu-low | 5.5090 | 4.9593 | -549.7 | 4.8267–5.0929 |
| L9-webgpu-high | 5.3579 | 5.1252 | -232.7 | 5.0919–5.1431 |
| L9-webgl2-low | 5.8415 | 5.7100 | -131.5 | 5.6767–5.9103 |

**PASS:** L9 WebGPU low median **5,291.6 ms ≤ 6,000 ms**; L9 high and WebGL2 low are faster than main. [Summary](quiet-load.json), [all 50 raw records](quiet-load-rows.json.gz), [command output](quiet-load.txt). The public WebGL fallback is exercised by hiding `navigator.gpu` before application startup; renderer/context probes confirm native WebGL2 on Metal ([fallback probe](public-fallback-probe.json)).

An [earlier partial matrix](quiet-intermediate.json) ([40 records](quiet-intermediate.json.gz), [conditions](quiet-intermediate-conditions.jsonl), [identity](intermediate-source-identity.json)) found a 50 ms L1 regression from globally preparing extra NPC rigs. The final code scopes that preparation to L9. That earlier matrix rejected its WebGL sample because the public build ignored the renderer URL query; no rejected sample enters final results.

## Diagnosis and implementation

The [initial diagnostic](diagnostic-load-phases.json) measured 5,997.6 ms in one shared, profiled L9 WebGPU low load: 13.509 MB requested, world/navigation 518 ms, mission/cast 238 ms, district/character 1,779 ms and civilian/infected preparation 1,856/1,738 ms (overlapping). Shader compilation consumed 2,677 ms of the 3,202 ms warm-up. The APC requests totalled 66.4 KB (largest request 115 ms); crossing layout/horizon requests totalled 340.0 KB (largest 97 ms). The [CPU aggregate](diagnostic-cpu-summary.json) attributes 2,243 ms of that shader window to Three's JavaScript, 257 ms to GC and 7 ms to idle. Increasing L9 compile lanes from six to 24 left compilation at 2,672 ms; that experiment was reverted.

Perimeter cells now borrow the existing named placement-attribute shader. Post count, cells, vertex/index arrays, transforms and shadow flags stay intact; their 32 node builds become one. The [graph census](graph-census.json.gz) records the intermediate L9 total dropping from 398 to 367. Unlit windows now carry the same batching metadata as lit windows, so later LOD batches reuse the warmed placement graph. Resident NPC rigs are instantiated before warming. L9's later ambient dogs retain all three authored coats; their rigs are now loaded and warmed with the hidden companion. [Failed input diagnostics](diagnostic-input-trials.json) identified the six window builds and later pet shadows; the [completed bot diagnostic](pet-prewarm-diagnostic.json) reaches both L9 objectives with zero late builds. This bot diagnostic does not certify real-input frame timing.

No quality tier, figure population, LOD, light/shadow resolution, asset file or simulation rule changes. Full warm-up, both vehicle reveal graphs and GPU fences remain. The existing render contract checks shared graphs, exact Float32 post placements, retained geometry and independent instance buffers. [Matched image metrics](visual/comparison.json): fences are pixel-identical on both sampled configurations; windows change 27/518,400 pixels on WebGPU high (0.0052%) and zero on WebGL2 low. The visual baseline used main with the discarded compile-lane-only experiment; its drawing code/assets match main.

| View | Main rendering | Fix |
| --- | --- | --- |
| WebGPU high fence | [before](visual/webgpu-high-fence-main.png) | [after](visual/webgpu-high-fence-fix.png) |
| WebGPU high windows | [before](visual/webgpu-high-windows-main.png) | [after](visual/webgpu-high-windows-fix.png) |
| WebGL2 low fence | [before](visual/webgl2-low-fence-main.png) | [after](visual/webgl2-low-fence-fix.png) |
| WebGL2 low windows | [before](visual/webgl2-low-windows-main.png) | [after](visual/webgl2-low-windows-fix.png) |

Checks: [`npm run verify -- E31`](verify.txt) passes typecheck, lint and **104/104** unit tests; [`npm run test:smoke`](smoke.txt) passes all six QA browser cases plus the public case, including the existing freeze guard; [`npm run scene:gate`](scene-gate.md) passes **48/48**, zero known/unrun rows ([complete row receipt](scene-gate.json), [command output](scene-gate.txt)). No test case or budget was added. [Source/build identity](source-identity.json) records exact code and bundle hashes; public assets are unchanged.

## Real-input acceptance

**PASS:** the [quiet real-input run](real-input.json) completed both L9 objectives in 159 s wall time (154.05 s mission result), then handed over to L10 with the fire axe retained. Continue entry used the validated L9-default campaign preset, WebGPU low, 1280×720 DPR 1, zoom 1.5; all driving, movement and interactions used actual Playwright device input. Zero deaths, skips, assists, browser issues, late L9 node builds or L9 gameplay frame gaps above 200 ms. The CPU profiler was off; node-builder and frame guards were on. [Quiet admission](input-quiet-conditions.jsonl), [command receipt](real-input.txt), [raw builds/frames/clicks/log/completion](real-input-records.json.gz). The raw frame probe retains all four long intervals, including loading intervals with zero gameplay time. It only records gaps above 200 ms and cannot establish the maximum below that threshold. L10 loading intervals are retained but excluded from the L9 gameplay gate.

Evaluated profiler files, obsolete build snapshots and capture runs were removed after extracting the cited evidence. One baseline build was retained during acceptance. After archiving the receipts, all job-owned working builds and capture runs were removed; retained cited evidence is under 3 MB (limit 50 MB).
