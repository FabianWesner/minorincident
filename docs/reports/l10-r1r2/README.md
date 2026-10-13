# L10-D1 — crash outskirts and residential fringe

Scope: the L10-D1 row of E32. Implements the R1/R2 portions of AC02/03/27/28/30/31; other region, encounter, weapon transaction and finale owners retain their rows. No specs or reference assets changed.

D-CURE replaces the temporary L10 composition on D-CROSSING. The courier still starts at (547, 0), matching L9's safe crawl-end; the existing axe-only handover, safe corgi and `cure-crash` checkpoint are retained. The crash wreck behind the courier is scenery, with no replacement driveable vehicle. Authored routes are 250 m in R1 and 600 m in R2. R1/R2 share (747, 25), with overlapping region envelopes and flat ground. The police checkpoint is (767, 25), its pickup anchor (769, 25), and its medkit approach (763, 28). R2's through street is visibly blocked; the northern residential street provides a connected detour. R2 hands over to the industrial lane at (1237, 25).

`layouts/D-CURE/routes.json` is the authoring contract; D2–D4 can append regions and road waypoints. The existing Blender layout pipeline builds the low duplex/security-post/garden-wall kit plus retained wreck, hedge, barricade, tree and street-lamp stock. `npx tsx tools/layouts/build.ts D-CURE --force` also calls the retained terrain splitter, now accepting the district ID. The runtime uses the exported `terrainChunks` table through L9's TerrainView/ChunkResidency lifecycle, with 100 m origins and 25/9 detailed-cell limits. The 32-cell data table is metadata; the horizon is coarse, and detailed GLBs/collider/nav residency follow the player. Scene Lab district crops preserve this ownership table too. `curePursuitRoute` supplies shared reachable waypoints to the existing MegaPursuit owner; the sim fixture exercises its default residency query and one persistent boss across the R1/R2 boundary.

The police weapon in the scene is a visual fixture. Production pickup/checkpoint transactions and regional encounters belong to L10-S1/E1. The existing opening mission remains the S7 stub; this lane does not claim the seven-region graph, 45–50 minute calibration or full-assault E18 evidence.

Scene Lab catalog entries: `l10-crash-axe`, `l10-residential-security`, `l10-region-seam`, `l10-residential-detour`. Each is captured at high/low quality and zoom 1.5/1.0/0.5 on WebGL2 and WebGPU. A runner bug was corrected: the CLI's `webgl2` name maps to the renderer's `webgl` name when checking the requested backend. An actual WebGPU→WebGL fallback still fails the gate; no visual, performance or timing limits were relaxed.

## Validation and visual review

Evidence lives in `test-results/epics/E32/D1/`: route logs, WebGL2/WebGPU catalog indexes/metrics/sheets, native performance results and quiet-run conditions. The route fixture uses normal player movement, checks floor/nav/residency every tick, captures/restores the registered residential checkpoint and then restores the crash checkpoint. The handover regression now loads the actual D-CURE layout for L10. A separate GLB check requires shared cell extents and terrain heights within 2 cm.

Native Metal WebGL2, warmed R1/seam/police/detour/R2-exit probes (unpopulated district; encounter stress belongs to E1/Q6):

| Metric | High | Low | E18 high / low limit |
| --- | ---: | ---: | ---: |
| frame p95 | 4.8 ms | 4.0 ms | 16.7 / 33.3 ms |
| sim p95 | 0.7 ms | 0.5 ms | 4 / 6 ms |
| draws | 159 | 152 | 600 / 300 |
| triangles | 94,565 | 39,041 | 1,500,000 / 500,000 |
| detailed cells | 20 | 9 | 25 / 9 |
| collected JS heap | 125.9 MB | 91.5 MB | 400 / 250 MB |

Final focused unit/sim/handover run: **8/8 pass**. R1 travel = **55.68 s**, R2 travel = **133.48 s**, identical on both tiers; these are unpopulated greybox movement times, excluding the encounters/story that E1/S1 will add. Both backends' Scene Lab matrices pass **24/24**, **48/48 total**, with zero console errors and the requested backend confirmed. The seam fixture runs across both the region waypoint at x=747 and the 100 m cell seam at x=800. Typecheck, lint and the production build pass.

Opened comparison montages (every touched scene, both tiers, all three matrix zooms): [WebGL2 high](webgl2-high.jpg), [WebGL2 low](webgl2-low.jpg), [WebGPU high](webgpu-high.jpg), [WebGPU low](webgpu-low.jpg). The axe/corgi remain readable against the crash ground; the wreck is visible in the wider framing. The blue/white security booth, warm lamp pool and gold pistol fixture ring distinguish the police approach. Brick/teal duplex frontage distinguishes the residential detour. Normal zoom shows these landmarks; zoom 0.5 crops the environment to its edges while emphasizing the courier and pickup. Low preserves solid roofs/walls/windows, with fewer fittings. WebGL2/WebGPU agree in layout, silhouettes and lighting. The moving seam sequence has continuous asphalt/soil and no visible cracks, popping or unsupported feet.

D1 visual pair/readability review: **8/10** at normal/wide zoom, **7/10** at close zoom (less environmental context). No P0/P1 issue identified in the touched layout. Detailed checklist and limitations: [review](review.md). Machine results: [validation](validation.json).

The broad sweeps are **not green**. The latest full unit run has **1,328 pass / 2 fail / 7 skip**: the existing production asset validator exceeded its 300 s limit on a shared runner, but passed alone in 225 s; the audio license test found an rsync temporary file in the private runner copy, absent from the worktree, and passed after removing that exact temporary file. No test/filter/timeout/budget was loosened.

The earlier full sim + tests/levels snapshot has **1,153 pass / 20 fail / 2 skip**. Two D1 fixture issues were corrected: the pursuit probe needed enough ticks for the authored 250 m route, and the generic composition/nav suite needed D-CURE in its layout table. The focused final D1 run is green; the generic nav rerun is recorded separately below. The other 18 failures are in unchanged L1/L2/L3/L5/L6/continuity and Alpha/zoo performance tests; no baseline comparison was performed and this lane does not claim to resolve them.

`npm run verify -- E32` stopped at the existing `T-E32-11-perf-200` test (9.44 ms vs 4 ms). An isolated retry also fails (9.81 ms vs 4 ms; 100 actors pass). This fixture loads `perf-horde-200`, without a district/composition, so it does not exercise the D1 streaming/layout change. Its limit remains intact. The required touched-area browser matrices and native greybox budgets were run independently and pass. Full assault, five complete-region residency cycles and real-device FPS remain with E1/Q6; the empty district measurements above do not claim those gates.

Generic composition/nav regression: **2/2 pass**, nav sweep **32.7 s** within the unchanged **240 s** ceiling. The fixture now includes D-CURE and reuses pure bake results only for byte-identical inputs/seed; every composition, six tiers, three seeds, reachability assertion and replay-hash comparison remains covered.
