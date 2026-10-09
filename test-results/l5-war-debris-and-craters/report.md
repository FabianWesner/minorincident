# L5 war debris and craters

Asset-only lane: four canonical props, twelve authored GLBs. Base lane started at current main `131f4835`; no merge was needed. No runtime, district placement, NPC, mission, lighting-switch or sound behavior changes. Generated physics metadata includes the new fixed records.

## Delivered metrics

| Asset | Tier | Triangles | Materials | Asset draws | Production bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| decay.rubble-pile | LOD0 | 1044 | 4 | 4 | 30644 |
| decay.rubble-pile | LOD1 | 444 | 4 | 4 | 17000 |
| decay.rubble-pile | LOD2 | 164 | 4 | 4 | 9712 |
| decay.crater | LOD0 | 936 | 4 | 4 | 33032 |
| decay.crater | LOD1 | 396 | 4 | 4 | 18964 |
| decay.crater | LOD2 | 150 | 4 | 4 | 11048 |
| decay.fuel-truck-crater | LOD0 | 1172 | 4 | 4 | 37188 |
| decay.fuel-truck-crater | LOD1 | 504 | 4 | 4 | 20604 |
| decay.fuel-truck-crater | LOD2 | 190 | 4 | 4 | 11596 |
| decay.blown-sandbags | LOD0 | 1296 | 4 | 4 | 27064 |
| decay.blown-sandbags | LOD1 | 548 | 4 | 4 | 13716 |
| decay.blown-sandbags | LOD2 | 192 | 3 | 3 | 7536 |

All manifest caps remain 1,500 / 600 / 200 triangles, eight materials and eight asset draws. Batching uses sslib.export.merge_by_material; no decimation, regeneration, textures or dependencies. The renderer adds its presentation pass to inspection counters; the table counts GLB material primitives. Measured dimensions and geometry hashes are in `metrics.json` and each `assets/<id>/report.json`. Source GLBs were byte-identical on rebuild; standalone `--distance-tier 2 --glb <explicit-path>` exports also matched each authored source tier byte for byte.

## Commands

Run sequentially for each of `decay.rubble-pile`, `decay.crater`, `decay.fuel-truck-crater`, `decay.blown-sandbags`:

```sh
npm run assets:build -- decay.rubble-pile
npm run assets:pack -- decay.rubble-pile
npm run assets:validate -- --ids decay.rubble-pile
npm run assets:build -- decay.crater
npm run assets:pack -- decay.crater
npm run assets:validate -- --ids decay.crater
npm run assets:build -- decay.fuel-truck-crater
npm run assets:pack -- decay.fuel-truck-crater
npm run assets:validate -- --ids decay.fuel-truck-crater
npm run assets:build -- decay.blown-sandbags
npm run assets:pack -- decay.blown-sandbags
npm run assets:validate -- --ids decay.blown-sandbags
```

All twelve selected LOD validation records pass. Packing preserved authored tiers; no `--regenerate` was used.

```sh
E2E_PORT=3391 sh tools/e2e-lock.sh npm run assets:turntable -- decay.rubble-pile,decay.crater,decay.fuel-truck-crater,decay.blown-sandbags --lod-contact --output test-results/l5-war-debris-and-craters
E2E_PORT=3391 sh tools/e2e-lock.sh npm run assets:turntable -- decay.rubble-pile,decay.crater,decay.fuel-truck-crater,decay.blown-sandbags --output test-results/l5-war-debris-and-craters
sh tools/e2e-lock.sh npx tsx .cache/l5-evidence/capture.ts
```

Browser captures use headless Chromium / Metal WebGL2, one page/worker, shared lock. The final fuel-tier captures were repeated after correcting its folded skin winding. One interim standard turntable was interrupted by Vite reload during manifest edits (execution context destroyed); the completed retry is the retained evidence. No dev server ran on port 3300. Lane-owned port 3391 is stopped on completion. No WebGPU automation/claim.

## Evidence

- `decay.rubble-pile/comparison.png` — reference and five standard views.
- `decay.rubble-pile/lod-contact.png` — authored LOD0/1/2, all sides.
- `decay.rubble-pile/game-reference-peer.jpg` — reference, production LOD0/1/2 and integrated peer at 135 and 190 px, fixed FOV25/azimuth45/polar54 camera.
- `decay.crater/comparison.png` — reference and five standard views.
- `decay.crater/lod-contact.png` — authored LOD0/1/2, all sides.
- `decay.crater/game-reference-peer.jpg` — reference, production LOD0/1/2 and integrated peer at 135 and 190 px, fixed FOV25/azimuth45/polar54 camera.
- `decay.fuel-truck-crater/comparison.png` — reference and five standard views.
- `decay.fuel-truck-crater/lod-contact.png` — authored LOD0/1/2, all sides.
- `decay.fuel-truck-crater/game-reference-peer.jpg` — reference, production LOD0/1/2 and integrated peer at 135 and 190 px, fixed FOV25/azimuth45/polar54 camera.
- `decay.blown-sandbags/comparison.png` — reference and five standard views.
- `decay.blown-sandbags/lod-contact.png` — authored LOD0/1/2, all sides.
- `decay.blown-sandbags/game-reference-peer.jpg` — reference, production LOD0/1/2 and integrated peer at 135 and 190 px, fixed FOV25/azimuth45/polar54 camera.

All sheets are at most 1600 px wide. JPG copies of all three sheets per asset are in `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/`. Raw screenshots, probe files and temporary exports are removed after composition.

## Review and interfaces

Own visual review is provisional; orchestrator acceptance is independent. Per-asset `review.md` records concrete simplifications. Rubble is angular and uneven but LOD2 is sparse and its slab is cleaner than the reference. The small crater retains a dark center and torn plates but remains more radial than the painted reference. Fuel crater is broader/darker with two tank skins derived from the integrated tanker; fragments are relatively small at 135 px. Sandbags preserve a breach, pale spill and continuous supports; far sacks omit hanging cloth and look more rectangular.

The small crater had no pre-existing integrated crater peer, so its peer is `decay.burned-facade.brick` for damage/material treatment. Rubble peer is `decay.makeshift-barricade`; fuel peer is its integrated `veh.fuel-truck` base; sandbag peer is `prop.sandbag-pallet`.

**Runtime blocker:** current physics metadata extraction/static collision supports boxes, not terrain apertures or concave surfaces. Each crater exports `col:blastSurface` as an EMPTY with exact visible bowl triangle data in local Y-up coordinates, plus `terrainCutout.ss_terrain_cutout`, grade/rim and blast-center sockets. Their generated physics `boxes=[]` is intentional. The level/runtime lane must remove the terrain/ground collider inside the boundary and consume the fixed Rapier triangle surface, or give the crater a readable blocked route/detour. Never put a flat invisible slab over the hole. Detailed node names, coordinates and anchors are in each asset notes file.

No building decay variants were requested; no base footprints were changed. Fuel crater is independent dressing, not a competing fuel-truck canonical variant. No lights or emissive fixtures are present.

## Repository checks

Final delivery after the proxy correction passed on the remote runner:

| Exact command | Result |
| --- | --- |
| `npm run assets:validate` | 874/874 records pass, 0 failures |
| `npm run typecheck` | pass |
| `npm run lint` | pass, no new warnings |
| `npm run test:unit -- --maxWorkers=4` | 366/366 tests in 104/104 files pass, 0 failures |

Executed with `sh tools/remote/run.sh . --pull test-results/l5-war-debris-and-craters/checks-complete -- bash -lc ...`; exact npm commands above ran sequentially and all returned exit zero. Logs are retained in `checks-complete/`; structured counts are in `verification.json`. Two earlier full runs also passed.
 Asset-only work did not require `test:smoke` or `verify -- E23`; no level epic implementation or gameplay code was changed.

## Commits

- `94e66ca0` — build sources, strict manifest registration, production/source GLBs and generated fixed physics metadata.
- `10d3b939` — QA sheets and honest visual reviews.
- `0c902251` — align slab/end collider proxies to surviving solids.

Final proxy correction: slab collision follows the actual ground-adjusted slab matrix, and breached-line end proxies cover the outer surviving bags. After this metadata-only change, all six affected GLBs have identical mesh positions/normals/colors/indices/materials/world transforms to the inspected delivery (verified programmatically); retained visual sheets remain valid. Updated source tiers also reproduce byte for byte.

Runner deviation: the last delivery verification queued on runner 2 for about twelve minutes. The automatic attempt to add a runner hit the provider IP limit. When runner 1 had a free slot, the final commands were resubmitted there; only this lane's duplicate waiting job was terminated, before any tests started. No other jobs or servers were stopped.
