# L8 all-new — lane/l8-all-new

- Census: eight old IDs (lion, gorilla, elephant, flamingo × healthy/infected) replaced; people, guards, staff, Alphas, zebra and corgi already v2; crows do not spawn; no batch-3 remainder ([census](census.json)).
- Cached TRELLIS sources, automated `skin-crowd-build.sh`, no manual asset steps; €0 spent; 82 deliverables identical across two rebuilds ([builds](builds.json), [reproducibility](reproducibility.json)).
- LOD0/1/2 caps: 8,000/3,000/1,000 triangles and 600,000/250,000/150,000 bytes; observed maxima 7,494/2,891/992 triangles and 402,560/198,348/123,908 bytes, both tiers.
- Eight old/new sheets [01](01-amb.lion.jpg)–[08](08-inf.flamingo.jpg): native 120/400 px, front/back, low/high, WebGL2/WebGPU; eyes, skin tone, props, hats and UV edges reviewed ([review](review.json)).
- [30-figure crowd](09-crowd-old-new.jpg), [feet/tails/turns](10-motion-ground-tails.jpg), [corpses](11-corpses-old-new.jpg), [scripted scenes + actual L8](12-story-zoo.jpg), [pipeline sources](13-pipeline-viewer.jpg): all 13 reviewed; no foot sinking; elephant explicit form swap has 6.6 cm sole-bound change, walking p95 slide 0 cm.
- [Validation](validation.json): 1,262 asset rows / zero errors; typecheck, lint, npm test 104/104, smoke 6 QA + 1 public pass; no new tests (144/150). Final L8 freeze all four configs: zero warm shader builds, no frame >200 ms (worst 49.9 ms); GPU limits pass.
- scene:gate exits 0: 43 pass + five unchanged known issues; zoo story fixtures six strict passes, district fixture retains identical baseline 20 static clipping pairs; no new failures ([validation](validation.json)).
- Real-input L8 playthrough completed in 97 wall seconds, low/zoom 2, no god mode, no skips, deaths, assists or issues; escape→APC departure ([validation](validation.json)).
- [Perf](performance.json), current main: low/high draws unchanged 153/176; decoded payload +899,456/+7,490,368 bytes; low p95 16.7→16.8 ms refresh-capped diagnostic; uncapped +1 ms acceptance **perf pending** PO quiet window. Worst five cold loads 5,020 ms vs PROD 5,557 ms (90.3%, below 110%).
- Showcase `l8-crowd-old-new.jpg` written to requested scratchpad (1,369×1,600); best captures 09 (crowd), 05 (elephant), 01 (lion), 12 (scenes); [receipt](showcase.json). No deploy; gameplay values unchanged.
