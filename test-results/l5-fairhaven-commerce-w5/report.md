# L5 Fairhaven commerce W5 delivery

Source/production commits: `3ad2f352`, `9cc0f10b`, `5dc4ecae`. The lane started level with main; no main merge, push, deploy, specs/reference edits or new dependencies.

Built four requested rows: three base-owned W5 twins and one canonical fixed facade dressing. Every W5 tier imports the existing integrated base GLB; authored tiers are never decimated. Whole material assemblies are merged, with cellar-door/shutter owners protected.

## Measured production tiers

| Asset | Tier | Triangles | Draws | Materials | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| bld.storefront-row.w5 | LOD0 | 22403 | 7 | 7 | 333312 |
| bld.storefront-row.w5 | LOD1 | 9876 | 7 | 7 | 142516 |
| bld.storefront-row.w5 | LOD2 | 3620 | 7 | 7 | 62780 |
| bld.kessler-hardware.w5 | LOD0 | 19187 | 5 | 4 | 327924 |
| bld.kessler-hardware.w5 | LOD1 | 7236 | 5 | 4 | 124152 |
| bld.kessler-hardware.w5 | LOD2 | 2283 | 5 | 4 | 41632 |
| bld.metro-entrance.w5 | LOD0 | 5959 | 6 | 5 | 95836 |
| bld.metro-entrance.w5 | LOD1 | 3198 | 6 | 5 | 53892 |
| bld.metro-entrance.w5 | LOD2 | 1414 | 6 | 5 | 29324 |
| decay.collapsed-facade | LOD0 | 1444 | 4 | 4 | 31288 |
| decay.collapsed-facade | LOD1 | 516 | 4 | 4 | 12948 |
| decay.collapsed-facade | LOD2 | 196 | 3 | 3 | 6728 |

Building caps: 30,000 / 12,000 / 4,000; facade caps: 1,500 / 600 / 200. All asset draws <=8. Counts exclude the renderer's one screen-presentation triangle/draw.

## Contracts / visual review

All base root/body/front/socket and animated-owner world matrices match their original tier exactly (maximum error 0). Footprint-mask IoU at 512px: storefront 0.99949–0.99963, Kessler 1.00000, metro 0.99824–0.99942. The original plinth, pivots, doors, nav anchors and overall transform stay fixed. Rubble is confined to the existing envelope, away from the shop/cellar doors and stair shaft. No AABB fitting or scale change. Four independent geometry-hash rebuilds pass.

The game-reference-peer sheets show broad missing roof/corner geometry, charred fracture faces, black/broken glazing, soot, torn awnings and rubble against the intact peers at 90 / 135 / 190 px. The metro retains usable stairs and the state-compatible shutter; `col:shutter` moves with `shutter`, and `braceSlotSocket` is provided. Building light anchors are retained at intensity 0 with empty emissive references. Runtime placement, fire/smoke, shelter cues, behavior and switching stay with level lanes.

Concrete limitations: surviving rear walls/roof halves have less damage than the game-facing fronts. The metro base is a gabled open canopy with no side glass; its W5 stays related to that shipped base rather than the flat glazed reference. Facade dressing is more geometric and less densely chipped than its reference; LOD2 omits loose rubble and joists while retaining the tall broken wall edge, exposed slab and fallen piece. Main LOD0 facade piers/slab have shallow authored bevels. See the per-asset C/E reviews for the comparison and refinements. Independent orchestrator visual acceptance remains pending.

## Commands / results

For each building base (`bld.storefront-row`, `bld.kessler-hardware`, `bld.metro-entrance`), sequentially:

```sh
npm run assets:build -- <base> --decay w5
npm run assets:pack -- <base>
npm run assets:validate -- --ids <base>
```

For `decay.collapsed-facade`:

```sh
npm run assets:build -- decay.collapsed-facade
npm run assets:pack -- decay.collapsed-facade
npm run assets:validate -- --ids decay.collapsed-facade
```

All four build/pack/selected-validation sequences pass (21 base/variant/tier validation records, 0 failures). Explicit tier counts are in `measurements.json`; caps apply to the variants as well as bases. Repeated deterministic rebuilds pass 4/4 in `determinism.json`.

```sh
npm run assets:validate
npm run typecheck
npm run lint
npm run test:unit -- --maxWorkers=4
```

Final local asset validation: 862 records, 0 failures. Typecheck: exit 0; lint: exit 0. The first remote unit run passed 362/363 tests (102/103 files); its only failure was the missing generated fixed-physics registry entry for the new facade. Running `npx tsx tools/assets/physics-metadata.ts` added exactly that entry, committed in `5dc4ecae`. Final remote rerun: validation 862 records / 0 errors; typecheck exit 0; lint exit 0; unit 363/363 tests and 103/103 files pass (162.16s), total remote command exit 0. Exact final logs are in `checks/validate.log`, `typecheck.log`, `lint.log`, `unit.log`; the original 362/363 result is preserved in `checks/unit-before-physics-refresh.log`. All six remote slots were occupied; additional capacity was rejected with Primary IP limit exceeded. The earlier queued preliminary snapshot was cancelled without running tests. The final request uses `MI_SCALE_WAIT=1 sh tools/remote/run.sh . --pull test-results/l5-fairhaven-commerce-w5/checks -- sh -c ...` to run the four commands above and pull exact logs. No runtime/gameplay or level implementation changed, so smoke/E23 verify were not run.

Captures:

```sh
E2E_PORT=3346 sh tools/e2e-lock.sh npm run assets:turntable -- <base> --decay w5 --lod-contact --output test-results/l5-fairhaven-commerce-w5
E2E_PORT=3346 sh tools/e2e-lock.sh npm run assets:turntable -- <base> --decay w5 --output test-results/l5-fairhaven-commerce-w5
E2E_PORT=3346 sh tools/e2e-lock.sh npm run assets:turntable -- decay.collapsed-facade --lod-contact --output test-results/l5-fairhaven-commerce-w5
E2E_PORT=3346 sh tools/e2e-lock.sh npm run assets:turntable -- decay.collapsed-facade --output test-results/l5-fairhaven-commerce-w5
```

All four LOD contact commands and three building turntables pass. The narrow facade turntable exports every image and comparison but exits 1 on coverage: sides 7.714% / 7.568%, game 9.805% vs the 10% minimum. Its silhouette is checked separately at 90–190 px with appropriate framing. This diagnostic is retained, not suppressed or widened. `capture-commands.json` records exact commands, exit codes and diagnostics. The final peer capture has 0 placeholders and 0 browser errors for all four assets/tier groups. Headless Chromium/Metal WebGL2, one worker under the shared e2e lock. One lane-owned preview server used port 3346 and was stopped after captures; no server on 3300 was started.

## Evidence paths

- `test-results/l5-fairhaven-commerce-w5/bld.storefront-row.w5/reference-lod-contact.jpg` (reference + LOD0/1/2, all sides)
- `test-results/l5-fairhaven-commerce-w5/bld.storefront-row.w5/lod-contact.png` (matching tier framing)
- `test-results/l5-fairhaven-commerce-w5/bld.storefront-row.w5/comparison.png` (reference + turntable)
- `test-results/l5-fairhaven-commerce-w5/bld.storefront-row.w5/game-reference-peer.jpg` (reference + LOD0/1/2 + integrated peer at 90/135/190 px)
- `test-results/l5-fairhaven-commerce-w5/bld.storefront-row.w5/review.md`
- `test-results/l5-fairhaven-commerce-w5/bld.kessler-hardware.w5/reference-lod-contact.jpg` (reference + LOD0/1/2, all sides)
- `test-results/l5-fairhaven-commerce-w5/bld.kessler-hardware.w5/lod-contact.png` (matching tier framing)
- `test-results/l5-fairhaven-commerce-w5/bld.kessler-hardware.w5/comparison.png` (reference + turntable)
- `test-results/l5-fairhaven-commerce-w5/bld.kessler-hardware.w5/game-reference-peer.jpg` (reference + LOD0/1/2 + integrated peer at 90/135/190 px)
- `test-results/l5-fairhaven-commerce-w5/bld.kessler-hardware.w5/review.md`
- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/reference-lod-contact.jpg` (reference + LOD0/1/2, all sides)
- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/lod-contact.png` (matching tier framing)
- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/comparison.png` (reference + turntable)
- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/game-reference-peer.jpg` (reference + LOD0/1/2 + integrated peer at 90/135/190 px)
- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/review.md`
- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/reference-lod-contact.jpg` (reference + LOD0/1/2, all sides)
- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/lod-contact.png` (matching tier framing)
- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/comparison.png` (reference + turntable)
- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/game-reference-peer.jpg` (reference + LOD0/1/2 + integrated peer at 90/135/190 px)
- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/review.md`

All images are <=1600px wide. Peer JPGs were copied, labeled by asset ID, to `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l5-assets/`. Only required sheets/metadata/reviews/check logs are retained; no videos.
