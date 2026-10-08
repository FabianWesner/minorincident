# L3 commerce shop damage — lane delivery

Eight requested IDs delivered; no rows skipped. Authored LOD0/1/2, shared palette, no new dependencies or textures. All listed tiers meet their triangle/material/draw caps. Base-owned W2/W3 variants retain intact door, roof, interior and collider semantics. Independent orchestrator visual acceptance remains pending.

## Commits

- `24dbced5` — variant packing, independent decay budgets and regression tests.
- `6a1e4c82` — sources, wrappers, manifest, fixed physics records and raw/production GLBs.
- Evidence commit follows these two commits on this lane.

## Measured production delivery

Counts come from decoded production mesh primitives, including independently controlled owners. Bytes are actual packed GLB sizes. The preview debug total includes its separate ground primitive (+1 draw/triangle).

| Asset | LOD | Triangles | Draws | Materials | Bytes |
|---|---:|---:|---:|---:|---:|
| bld.mainstreet-brick.w2 | 0 | 7410 | 8 | 5 | 89392 |
| bld.mainstreet-brick.w2 | 1 | 5306 | 8 | 5 | 62984 |
| bld.mainstreet-brick.w2 | 2 | 3570 | 8 | 5 | 47216 |
| bld.mainstreet-brick.w3 | 0 | 7934 | 8 | 5 | 92940 |
| bld.mainstreet-brick.w3 | 1 | 5462 | 8 | 5 | 64376 |
| bld.mainstreet-brick.w3 | 2 | 3686 | 8 | 5 | 48188 |
| bld.joes-diner.w2 | 0 | 8628 | 7 | 4 | 119716 |
| bld.joes-diner.w2 | 1 | 7520 | 7 | 4 | 102684 |
| bld.joes-diner.w2 | 2 | 3401 | 7 | 4 | 50712 |
| bld.joes-diner.w3 | 0 | 8992 | 7 | 4 | 127292 |
| bld.joes-diner.w3 | 1 | 7580 | 7 | 4 | 103736 |
| bld.joes-diner.w3 | 2 | 3453 | 7 | 4 | 51444 |
| bld.maple-hardware.w2 | 0 | 6699 | 7 | 5 | 84396 |
| bld.maple-hardware.w2 | 1 | 5227 | 7 | 5 | 64108 |
| bld.maple-hardware.w2 | 2 | 3935 | 7 | 5 | 50956 |
| bld.maple-hardware.w3 | 0 | 7063 | 7 | 5 | 89348 |
| bld.maple-hardware.w3 | 1 | 5287 | 7 | 5 | 64608 |
| bld.maple-hardware.w3 | 2 | 3987 | 7 | 5 | 51688 |
| decay.burned-facade.brick | 0 | 960 | 4 | 4 | 17952 |
| decay.burned-facade.brick | 1 | 308 | 4 | 4 | 8104 |
| decay.burned-facade.brick | 2 | 148 | 3 | 3 | 5676 |
| decay.burned-facade.diner | 0 | 1063 | 4 | 4 | 19244 |
| decay.burned-facade.diner | 1 | 379 | 4 | 4 | 8936 |
| decay.burned-facade.diner | 2 | 172 | 3 | 3 | 6016 |

Building caps: 30,000 / 12,000 / 4,000. Section caps: 1,500 / 600 / 200. Draw cap: eight in every tier. Intact base budgets and GLBs were not widened or rebuilt.

## Footprints, transforms and determinism

- 102 root/roof/interior/door/collider matrix comparisons: maximum difference 0.
- Top-down projected mesh footprint IoU: mainstreet 0.99834 / 0.99834 / 0.99115; diner 0.99428 / 0.99430 / 0.99430; hardware 0.99968 at all tiers. Both siblings share these results. E23 threshold ≥0.9 passed for all 18 comparisons.
- Translation uses original collider/door anchors; no rescaling to a damaged AABB. Native walls, roof form and frontage survive. Pavement seams fuse into explicit solid footprint recipes.
- Repeated headless Blender builds: 24/24 source geometry hashes identical. See `determinism.json`, `metrics.json`, `footprints.json`.

## Evidence and own visual inspection

All references were visually inspected before modeling. Inspected all matching LOD sheets and game-camera overview, plus all-side turntables. Fixed camera: FOV25°, azimuth45°, polar0.30π; models are 107–131 pixels high. Every retained image is ≤1600 pixels wide.

| Requested ID | All sides + reference | LOD0/1/2 + reference | Game size + reference |
|---|---|---|---|
| bld.mainstreet-brick.w2 | [bld.mainstreet-brick.w2/comparison.png](bld.mainstreet-brick.w2/comparison.png) | [LOD contact](bld.mainstreet-brick.w2/lod-contact.png) | [Game camera](bld.mainstreet-brick.w2/game-camera.png) |
| bld.mainstreet-brick.w3 | [bld.mainstreet-brick.w3/comparison.png](bld.mainstreet-brick.w3/comparison.png) | [LOD contact](bld.mainstreet-brick.w3/lod-contact.png) | [Game camera](bld.mainstreet-brick.w3/game-camera.png) |
| bld.joes-diner.w2 | [bld.joes-diner.w2/comparison.png](bld.joes-diner.w2/comparison.png) | [LOD contact](bld.joes-diner.w2/lod-contact.png) | [Game camera](bld.joes-diner.w2/game-camera.png) |
| bld.joes-diner.w3 | [bld.joes-diner.w3/comparison.png](bld.joes-diner.w3/comparison.png) | [LOD contact](bld.joes-diner.w3/lod-contact.png) | [Game camera](bld.joes-diner.w3/game-camera.png) |
| bld.maple-hardware.w2 | [bld.maple-hardware.w2/comparison.png](bld.maple-hardware.w2/comparison.png) | [LOD contact](bld.maple-hardware.w2/lod-contact.png) | [Game camera](bld.maple-hardware.w2/game-camera.png) |
| bld.maple-hardware.w3 | [bld.maple-hardware.w3/comparison.png](bld.maple-hardware.w3/comparison.png) | [LOD contact](bld.maple-hardware.w3/lod-contact.png) | [Game camera](bld.maple-hardware.w3/game-camera.png) |
| decay.burned-facade.brick | [decay.burned-facade.brick/comparison.png](decay.burned-facade.brick/comparison.png) | [LOD contact](decay.burned-facade.brick/lod-contact.png) | [Game camera](decay.burned-facade.brick/game-camera.png) |
| decay.burned-facade.diner | [decay.burned-facade.diner/comparison.png](decay.burned-facade.diner/comparison.png) | [LOD contact](decay.burned-facade.diner/lod-contact.png) | [Game camera](decay.burned-facade.diner/game-camera.png) |

Building directories also contain `cutaway.png` and `footprint-contact.png`. All eight contain capture JSON, confirming real production loading with no placeholder or browser errors. Temporary individual render frames were deleted.

Concrete visual compromises/faults:

- W2: boards, broken pane and cartons read as standing emergency aftermath. Bracing under awnings is partly sheltered; mainstreet upper X boards improve the small camera read.
- W3: dark jagged glazing, local soot and affected trim remain visible; conservative walls and full roofs preserve the standing structure. Fine glazing/soot variation is simpler at LOD2.
- Section props: fronts/awnings are recognizable but shallower and less irregular than the references; LOD2 simplifies lettering, masonry courses and glazing. The standard turntable coverage guard rejects their intentionally narrow side profiles (~6–7% versus its 10% minimum). Both commands exit 1 after saving their all-side sheets. Their LOD contacts and game-camera captures pass. This is an explicit QA-tool deviation; no guard was weakened.
- All siblings use powered-off nonemissive signs/window materials. Existing light empties survive without emitting metadata. The assets do not emit light; dynamic power switching is a runtime responsibility.

## Interface handoff

Use `loadAsset('<base>', 'high' | 'lod1' | 'lod2', 'w2' | 'w3')`. Variants belong to base `decayVariants`; dotted folders provide per-ID build wrappers, not a conflicting canonical runtime entry. Production naming is `<base>.w2[.lod1/.lod2].glb` and equivalently W3.

Keep `root`, `roof`, `interior`, original `door_*`, `col:*`, existing semantic empties and +X `front`. Fixed structure metadata is nonpushable/nonkickable. New facade props expose `root`, `body`, `front`, `col:body`. Placement, navigation, door interactions, fire/smoke, missions and power switching belong to level/runtime lanes; no level implementation was performed.

## Exact build / pack / selected validation commands

Commands were run sequentially per asset, including a repeated deterministic build. No `--regenerate` or global repack. Blender executable: `/Applications/Blender.app/Contents/MacOS/Blender`, 5.2.2 LTS, background mode.

```sh
npm run assets:build -- bld.mainstreet-brick --decay w2
npm run assets:pack -- bld.mainstreet-brick
npm run assets:validate -- --ids bld.mainstreet-brick
npm run assets:build -- bld.mainstreet-brick --decay w3
npm run assets:pack -- bld.mainstreet-brick
npm run assets:validate -- --ids bld.mainstreet-brick
npm run assets:build -- bld.joes-diner --decay w2
npm run assets:pack -- bld.joes-diner
npm run assets:validate -- --ids bld.joes-diner
npm run assets:build -- bld.joes-diner --decay w3
npm run assets:pack -- bld.joes-diner
npm run assets:validate -- --ids bld.joes-diner
npm run assets:build -- bld.maple-hardware --decay w2
npm run assets:pack -- bld.maple-hardware
npm run assets:validate -- --ids bld.maple-hardware
npm run assets:build -- bld.maple-hardware --decay w3
npm run assets:pack -- bld.maple-hardware
npm run assets:validate -- --ids bld.maple-hardware
npm run assets:build -- decay.burned-facade.brick
npm run assets:pack -- decay.burned-facade.brick
npm run assets:validate -- --ids decay.burned-facade.brick
npm run assets:build -- decay.burned-facade.diner
npm run assets:pack -- decay.burned-facade.diner
npm run assets:validate -- --ids decay.burned-facade.diner
```

## Exact capture commands

Own Vite preview used port3348 and was stopped after captures; no server was started on3300. All captures were headless with Metal WebGL2 and shared browser lock.

```sh
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.mainstreet-brick --decay w2 --lod-contact --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.mainstreet-brick --decay w2 --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.mainstreet-brick --decay w3 --lod-contact --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.mainstreet-brick --decay w3 --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.joes-diner --decay w2 --lod-contact --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.joes-diner --decay w2 --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.joes-diner --decay w3 --lod-contact --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.joes-diner --decay w3 --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.maple-hardware --decay w2 --lod-contact --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.maple-hardware --decay w2 --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.maple-hardware --decay w3 --lod-contact --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- bld.maple-hardware --decay w3 --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- decay.burned-facade.brick --lod-contact --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- decay.burned-facade.brick --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- decay.burned-facade.diner --lod-contact --output test-results/l3-commerce-shop-damage
E2E_PORT=3348 sh tools/e2e-lock.sh npm run assets:turntable -- decay.burned-facade.diner --output test-results/l3-commerce-shop-damage
```

Additional headless preview captures used the same lock and camera controls for 240×180 game images and building cutaways. Footprints project decoded production triangles at512px against the shipped base.

## Final validation

- `npm run assets:validate`: **745 passed, zero failed** (records in `validation.json`).
- Selected commands above: **33 passed, zero failed** (records in `validation-selected.json`).
- `npm run typecheck`: **passed**.
- `npm run lint`: **passed**.
- `npm run test:unit -- --maxWorkers=4`: **97 files / 331 tests passed**.
- `npm run build`: **passed**.
- `npx tsx tools/assets/physics-metadata.ts`: refreshed new fixed-prop physics fingerprints.
- `E2E_PORT=3348 npm run test:smoke`: **6 simulation tests passed / 803 skipped; 25 browser tests passed**, zero failed. The command enforces the shared sim lock with two workers and the browser lock with two workers.

Earlier validation caught stale generated physics fingerprints; regenerated metadata and the final unit run passes. An initial smoke attempt failed setup because the capture server occupied3348; it was stopped before the final smoke run. No level epic verify was applicable. See retained validation logs and JSON.

No edits to specs, references, folio-2025, initial-drafts or experiment. No push, main merge or deployment.

Reproduce additional evidence with the retained scripts (after starting the preview on3348):

```sh
sh tools/e2e-lock.sh npx tsx test-results/l3-commerce-shop-damage/scripts/capture-game.ts
python3 test-results/l3-commerce-shop-damage/scripts/sheets.py
npx tsx test-results/l3-commerce-shop-damage/scripts/evidence.ts
python3 test-results/l3-commerce-shop-damage/scripts/footprints.py
```
