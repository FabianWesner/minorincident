# l4-fairhaven-civic-buildings delivery

Four intact Fairhaven building assets delivered and registered as integrated. Source, authored LOD0/1/2 and production files are included. Independent orchestrator visual acceptance is pending.

## Measured exports

Counts/bytes below are actual GLBs, not estimated budgets. Caps are 30,000 / 12,000 / 4,000 triangles and ≤8 total draws (including the independently hinged door), at most 8 materials, and 1500 KiB production per tier.

| Asset | LOD | Production triangles | Draws | Materials | Production bytes | Source bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bld.apartment-block-a | 0 | 23,368 | 8 | 6 | 329,832 | 1,657,920 |
| bld.apartment-block-a | 1 | 4,968 | 8 | 6 | 76,648 | 357,060 |
| bld.apartment-block-a | 2 | 2,752 | 8 | 6 | 45,152 | 180,836 |
| bld.apartment-block-b | 0 | 9,848 | 7 | 5 | 151,936 | 720,248 |
| bld.apartment-block-b | 1 | 6,888 | 7 | 5 | 102,792 | 491,304 |
| bld.apartment-block-b | 2 | 3,944 | 7 | 5 | 61,404 | 257,908 |
| bld.town-hall | 0 | 6,664 | 8 | 7 | 109,760 | 498,348 |
| bld.town-hall | 1 | 3,288 | 8 | 7 | 53,148 | 238,664 |
| bld.town-hall | 2 | 1,632 | 8 | 7 | 30,172 | 112,672 |
| bld.church | 0 | 8,148 | 7 | 5 | 124,728 | 575,824 |
| bld.church | 1 | 3,252 | 7 | 5 | 51,448 | 218,484 |
| bld.church | 2 | 1,740 | 7 | 5 | 30,612 | 121,320 |

## Bounds and future W5 lanes

- `bld.apartment-block-a`: X/Y/Z [10.3002, 12.85, 12.6002] m; min [-4.8000788334164195, 0, -6.300096320331772]; max [5.500078642681556, 12.850000381469727, 6.300096320331772]. See `assets/bld.apartment-block-a/notes.md` and `measurements.json` for foundation extents and exact hinge/nav/roof/vestry anchors.
- `bld.apartment-block-b`: X/Y/Z [9.9602, 15.95, 12.6] m; min [-4.800088552238703, 0, -6.299976578498631]; max [5.160088208915949, 15.949959982600957, 6.299976578498631]. See `assets/bld.apartment-block-b/notes.md` and `measurements.json` for foundation extents and exact hinge/nav/roof/vestry anchors.
- `bld.town-hall`: X/Y/Z [12.08, 12.4001, 16] m; min [-5.150059511093478, -0.00010681081332783449, -8]; max [6.929948871964541, 12.399971531960155, 8]. See `assets/bld.town-hall/notes.md` and `measurements.json` for foundation extents and exact hinge/nav/roof/vestry anchors.
- `bld.church`: X/Y/Z [18, 13.7999, 10.6499] m; min [-9, 2.1362001952948684e-05, -5.299961231951565]; max [9, 13.79989938428616, 5.34996094584927]. See `assets/bld.church/notes.md` and `measurements.json` for foundation extents and exact hinge/nav/roof/vestry anchors.

No export scaling was applied. The base transform and local origin are fixed. The future W5 lane must derive from these source recipes, preserve transforms, ground footprints and anchors, and pass E23 footprint IoU ≥0.9; no damaged-AABB fitting. W5 is not part of this intact batch. B's LOD2 is close to the 4k cap: remove intact detail before adding damage geometry. Do not increase its manifest budget.

## Validation and commands

Final results: global asset validation **823/823 records passed, 0 failed**; selected new tiers **12/12 passed**; typecheck and lint exit **0**; unit **98/98 files, 343/343 tests passed**. Deterministic rebuilding produced identical geometry and SHA-256 for **12/12 source GLBs**. Explicit same-path `--glb` / `--distance-tier 2` also passed and retained the source hash. Light extraction: **304 anchors in 76 assets, 0 errors, 0 unreferenced emissive meshes**. Browser captures: **0 page/console errors**, no placeholders.

Each canonical ID was run sequentially with:

```sh
npm run assets:build -- <id>
npm run assets:pack -- <id>
npm run assets:validate -- --ids <id>
```

The IDs are `bld.apartment-block-a`, `bld.apartment-block-b`, `bld.town-hall`, `bld.church`. No global repack or --regenerate was used.

Final checks and generated registration tables:

```sh
npx tsx tools/assets/physics-metadata.ts
npm run assets:lights
npm run assets:validate
npm run typecheck
npm run lint
npm run test:unit -- --maxWorkers=4
python3 tools/blender/run.py assets/bld.town-hall/build.py --glb assets/bld.town-hall/model.lod2.glb --distance-tier 2
```

No gameplay/renderer behavior or level epic was implemented, so test:smoke / verify E22 / verify E23 were not invoked. The two initial unit freshness failures (physics and light tables) were resolved by regenerating the tables through their existing generators, without changing tests.

Headless preview was started only for this lane, on port 3327:

```sh
npx vite --host 127.0.0.1 --port 3327 --strictPort --configLoader runner
E2E_PORT=3327 sh tools/e2e-lock.sh npm run assets:turntable -- <id> --lod-contact --output test-results/l4-fairhaven-civic-buildings
E2E_PORT=3327 sh tools/e2e-lock.sh npm run assets:turntable -- <id> --output test-results/l4-fairhaven-civic-buildings
E2E_PORT=3327 sh tools/e2e-lock.sh npx tsx test-results/l4-fairhaven-civic-buildings/capture.mts
```

The turntable CLI also accepts the comma-separated four-ID batch used for the first three assets' final capture; B was recaptured individually after its roof-owner correction. Chromium always used headless:true and --use-angle=metal, one page/worker; the shared browser lock was used. Blender 5.2.2 ran headlessly through the shared runner at three threads. Only this lane's preview server was stopped after capture.

## Evidence

For each directory below, retained sheets are **comparison.png** (reference + LOD0 turntable/all sides/game view), **lod-contact.png** (matching LOD0/1/2 framing over all sides), **game-reference-peer.png** (reference, three LODs at ~135/190px, integrated peer), **cutaway.png** (three tiers with roof hidden). All sheets are ≤1600px wide. Capture JSON records include real loading and triangle counts. Individual temporary turntable screenshots were removed after sheet assembly; no videos were produced.

- `test-results/l4-fairhaven-civic-buildings/bld.apartment-block-a/`
- `test-results/l4-fairhaven-civic-buildings/bld.apartment-block-b/`
- `test-results/l4-fairhaven-civic-buildings/bld.town-hall/`
- `test-results/l4-fairhaven-civic-buildings/bld.church/`

## Visual comparison and concrete limitations

**bld.apartment-block-a**: The four-storey count, brick/pale trim, projecting central balcony pair and shop band remain legible in all LODs. Compared with the reference the footprint is wider/deeper in the isometric view; the side has three window columns. Compared with bld.mainstreet-brick, it has less rooftop dressing, but LOD0 masonry, facade depth and occupied window highlights now provide a comparable exterior finish.

LOD1/2 omit the masonry relief; LOD2 loses mullions and most railing posts. The pale balcony slabs still separate A from B at ~135 px. The peer has richer shop lighting and props; those are outside this apartment facade brief.

**bld.apartment-block-b**: Five storeys, cream walls, teal parapet/shop trim and outer recessed balcony columns read distinctly from A at both tested sizes. Piers and slab ceilings sit ahead of the window plane. The reference has deeper shaded loggias and warmer furnished shop interiors. bld.mainstreet-brick is more decorated, while this block uses the reference's cleaner large stucco regions.

LOD2 drops window crossbars and thin balcony return rails, using closed frame rings and two front posts. Recessed balcony bays remain open rather than becoming perforated panels. Roof hiding removes HVAC and its grille. Shop interiors are not furnished.

**bld.town-hall**: The symmetric three-column front, pale wide steps and pediment, brick walls, hipped roof and clock tower survive all LODs. Compared with the reference the hall is wider and its corner masonry is less detailed. Compared with bld.civic-center the clock/hip silhouette distinguishes the municipal hall; it lacks the shelter banners and rooftop equipment that identify that peer.

Clock disk and hands survive LOD2; small hour ticks cannot be read at ~135 px and are omitted at the far tier. Slate course relief disappears in LOD2. Roof cutaway retains the tower as a body landmark; this is an exterior shell with a ground floor, not a modeled multi-storey interior.

**bld.church**: The projecting continuous bell tower, cross, red pitched roof, pale masonry and arch silhouettes read in all LODs. The tower was moved to the front so it no longer reads as a detached rooftop box. The vestry door is visible in the rear/side sheets. Compared with the reference the nave is longer; compared with bld.house-b it shares the pale-wall/red-roof finish while the tower and arches distinguish the landmark.

The bell itself is small at ~135 px; the bell chamber/tower/cross remain legible. Clay roof rolls and facade masonry are reduced or omitted at distance. The reference has a richer warm stone color variation and shorter facade proportions. These are concrete polish differences for independent orchestrator judgment.

Broad silhouette features remain at both tested sizes. The distant ~135px captures are more fogged and muted than the ~190px views because they use the existing production distance shader. No claim is made that small clock ticks, masonry joints or bell details are individually readable there. References and integrated peers were inspected beside the model; their richer dressed interiors and rooftop props are visible differences, documented in per-asset review.md. Final comparative-grade acceptance belongs to the orchestrator.

## Scope, deviations and blockers

- Four new canonical buildings only; no aliases or decay duplicates.
- Existing sslib rescue Scene, palette, sockets, collider, material merging and AO/export patterns reused. No generic decimation, new dependency, texture atlas, or reference/spec edits.
- Source AO is clamped to [.65,1] after baking to prevent shell-corner occlusion blackening entire walls. Profile normals are oriented outward before merging.
- Required emissive mesh names are protected through optimization. Root fixed physics and generated runtime physics/light data are registered. Door leaves stay independent; external level lanes own collision state, power graph, cutaway control and survivor cue logic.
- Exterior shells have a ground floor and interface anchors; no furnished or navigable multi-storey interior is claimed.
- No technical blocker remains. Independent visual acceptance and future W5 derivation remain external work.

## Commits

Source/registration/GLBs commit: `40f8fd40`. QA evidence is a separate logical commit; its ID is supplied in the worker completion message. Main was unchanged at the lane's starting base `2df82910` when checked; no merge into main, push, or deployment occurred.
