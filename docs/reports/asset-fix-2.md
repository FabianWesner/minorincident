# Asset-fix-2: native distance LOD delivery

## Changes and commits

- `ad00856b`: merged main into the lane before implementation.
- `235a6246`: native vehicle source reductions, shared distance exporter repairs, absolute house/vehicle validation ceilings, boundary regression tests, contact-sheet CLI and tooling documentation.
- `9d2ab01a`, `16ae334c`: include the barricaded safe-house, simplify its distance lettering and reset Blender materials between tier builds.
- `f7d0a03b`: retain broad train paint bands as six closed far-distance panels (LOD2 1,908 triangles).
- `18f1a150`: explicit inspection bypasses stale pending registration dimensions; contact JSON records rendered triangle counts.
- `487e595a`: repacked raw and runtime LOD tiers; refreshed the stale Main Street LOD0 collision hash (collision boxes identical).

Distance meshes use source primitives with bevels removed, lower cylinder/grid resolution and selected small detail omitted. Body panels, roof planes, door groups, lights, sockets, material palette and vehicle silhouettes remain. No triangle-collapse decimator is used for the native tiers. Wreck shares sedan-green geometry. The courier-bike already satisfies the caps and its GLBs were unchanged.

The repack also brought the pending diner, gas station, school and Main Street tiers through the same interior contract checks. Their floor geometry remains closed. House D/E classifications were corrected to Hero, matching their existing hero geometry and the asset specification.

Build/repack tooling used: headless Blender 5.2.2 via `tools/blender/sslib/distance.py`, source `--distance-tier N --glb assets/<id>/model.lodN.glb` and `--lod-only`; `npm run assets:pack -- veh`; `npm run assets:pack -- bld`; `npm run assets:pack -- bld.safe-house`; `npm run assets:pack -- veh.train-freight`; `npm run assets:collision`.

## Validation

| Exact command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit -- --maxWorkers=4` | FAIL: 241 passed / 1 failed; 74 files passed / 1 failed |
| `npm run assets:validate -- --ids "$(cat /tmp/asset-fix-2-goal-ids.txt)"` | PASS: 87 checks, 0 failures (23 vehicles and six houses, all tiers) |
| `npm run assets:validate` | FAIL: 351 passed / 289 failed entries (640 total) |
| `sh tools/e2e-lock.sh sh -c 'E2E_PORT=3349 npm run assets:turntable -- "$(cat /tmp/asset-fix-2-contact-ids.txt)" --lod-contact --output test-results/asset-fix-2'` | PASS: 34 sheets, 510 views |

The goal ID file contains every `vehicle` category entry plus `bld.house-a` through `bld.house-e` and `bld.safe-house`, as listed below. The validator applies caps independently of manifest authored ceilings; regression cases accept each boundary and reject boundary + 1, even with a permissive manifest ceiling. It also covers `house.*` modules. Their unchanged geometry remains in the global run. Reusable ID lists are saved as `test-results/asset-fix-2/goal-ids.txt` and `contact-ids.txt`.

Final freight train sheet was refreshed with `sh tools/e2e-lock.sh sh -c 'E2E_PORT=3349 npm run assets:turntable -- veh.train-freight --lod-contact --output test-results/asset-fix-2'`. Render metadata for all 510 views matches shipped GLB triangle counts plus one background triangle. Each PNG has an adjacent `lod-contact.json`.

No gameplay code changed. Targeted QA used the headless asset turntable; gameplay smoke and epic verification were not run for this asset-only lane. No specs or protected directories were edited. No dependencies added. No push, main merge from this lane, or deployment performed.

## Packed triangle budgets

Counts are from shipped, optimized GLBs. Vehicle LOD1 ≤ 6,000 / LOD2 ≤ 2,000; house LOD1 ≤ 12,000 / LOD2 ≤ 4,000. Additional changed buildings are included for completeness.

| Asset | LOD0 tris | LOD1 tris | LOD2 tris |
| --- | ---: | ---: | ---: |
| bld.gas-station | 94400 | 11431 | 2896 |
| bld.helipad | 19343 | 4871 | 3815 |
| bld.house-a | 84580 | 5386 | 2830 |
| bld.house-b | 77684 | 5380 | 3916 |
| bld.house-c | 89776 | 11312 | 3848 |
| bld.house-d | 82726 | 11138 | 3308 |
| bld.house-e | 74808 | 10071 | 2552 |
| bld.joes-diner | 89115 | 10233 | 3821 |
| bld.mainstreet-brick | 95698 | 11282 | 3970 |
| bld.safe-house | 45720 | 8185 | 3973 |
| bld.school-elementary | 88628 | 7854 | 3790 |
| veh.ambulance | 74804 | 3908 | 1932 |
| veh.box-truck | 68839 | 4016 | 1140 |
| veh.courier-bike | 10478 | 1460 | 444 |
| veh.courier-van | 71970 | 5778 | 1908 |
| veh.fire-engine | 66202 | 4454 | 1988 |
| veh.fuel-truck | 77568 | 5700 | 1696 |
| veh.helicopter | 62132 | 3824 | 1916 |
| veh.jeep-red | 76286 | 3732 | 1790 |
| veh.military-truck | 71568 | 4095 | 1662 |
| veh.pickup-red | 71950 | 3987 | 1920 |
| veh.pickup-white | 73845 | 2959 | 1663 |
| veh.police-sedan | 72804 | 3766 | 1876 |
| veh.police-suv | 75280 | 4462 | 1830 |
| veh.school-bus | 76108 | 4120 | 1732 |
| veh.sedan-blue | 36636 | 3312 | 2000 |
| veh.sedan-green | 67911 | 3336 | 1978 |
| veh.sedan-red | 57344 | 3376 | 1412 |
| veh.sedan-white | 53990 | 3846 | 1700 |
| veh.semi-trailer | 67000 | 5916 | 1780 |
| veh.suv-dark | 69436 | 4088 | 1612 |
| veh.suv-green | 69788 | 4736 | 1508 |
| veh.train-freight | 71802 | 5928 | 1908 |
| veh.wreck | 67911 | 3336 | 1978 |

## Contact sheets for independent QA

Each sheet has LOD0/1/2 columns and 45°, 135°, 225°, 315°, 0° rows. Captured headless using Metal WebGL2 at port 3349 through the shared browser lock. All changed delivered assets are included, plus unchanged courier-bike. Files are intentionally in git-ignored `test-results/asset-fix-2/` and remain in this lane workspace.

Worker visual checks at front, rear and side angles found no visible torn seams, flipped faces or silhouette holes. Fine text, shingles, trim and wheel detail intentionally simplify. These images are ready for the orchestrator's independent visual QA; WebGPU visual QA was not performed.

- `test-results/asset-fix-2/bld.gas-station/lod-contact.png`
- `test-results/asset-fix-2/bld.helipad/lod-contact.png`
- `test-results/asset-fix-2/bld.house-a/lod-contact.png`
- `test-results/asset-fix-2/bld.house-b/lod-contact.png`
- `test-results/asset-fix-2/bld.house-c/lod-contact.png`
- `test-results/asset-fix-2/bld.house-d/lod-contact.png`
- `test-results/asset-fix-2/bld.house-e/lod-contact.png`
- `test-results/asset-fix-2/bld.joes-diner/lod-contact.png`
- `test-results/asset-fix-2/bld.mainstreet-brick/lod-contact.png`
- `test-results/asset-fix-2/bld.safe-house/lod-contact.png`
- `test-results/asset-fix-2/bld.school-elementary/lod-contact.png`
- `test-results/asset-fix-2/veh.ambulance/lod-contact.png`
- `test-results/asset-fix-2/veh.box-truck/lod-contact.png`
- `test-results/asset-fix-2/veh.courier-bike/lod-contact.png`
- `test-results/asset-fix-2/veh.courier-van/lod-contact.png`
- `test-results/asset-fix-2/veh.fire-engine/lod-contact.png`
- `test-results/asset-fix-2/veh.fuel-truck/lod-contact.png`
- `test-results/asset-fix-2/veh.helicopter/lod-contact.png`
- `test-results/asset-fix-2/veh.jeep-red/lod-contact.png`
- `test-results/asset-fix-2/veh.military-truck/lod-contact.png`
- `test-results/asset-fix-2/veh.pickup-red/lod-contact.png`
- `test-results/asset-fix-2/veh.pickup-white/lod-contact.png`
- `test-results/asset-fix-2/veh.police-sedan/lod-contact.png`
- `test-results/asset-fix-2/veh.police-suv/lod-contact.png`
- `test-results/asset-fix-2/veh.school-bus/lod-contact.png`
- `test-results/asset-fix-2/veh.sedan-blue/lod-contact.png`
- `test-results/asset-fix-2/veh.sedan-green/lod-contact.png`
- `test-results/asset-fix-2/veh.sedan-red/lod-contact.png`
- `test-results/asset-fix-2/veh.sedan-white/lod-contact.png`
- `test-results/asset-fix-2/veh.semi-trailer/lod-contact.png`
- `test-results/asset-fix-2/veh.suv-dark/lod-contact.png`
- `test-results/asset-fix-2/veh.suv-green/lod-contact.png`
- `test-results/asset-fix-2/veh.train-freight/lod-contact.png`
- `test-results/asset-fix-2/veh.wreck/lod-contact.png`

## Remaining failures and limitations

The full green gate is **not met**. The unchanged courier-bike riding unit test expects saddle world Z = 0; the shipped model returns -0.38999998569488525. No courier-bike model or riding code was altered by this lane.

Police SUV and freight train retain generic pending manifest dimensions; normal runtime registration remains unchanged. Explicit inspection mode loads the requested tiers without that stale dimension fallback. Final sheets supersede the first captures.

Global asset validation still fails on existing out-of-scope assets (palette, node/orientation, old LOD ratio/byte contracts and reviews). Main Street's unchanged LOD0 is 1,515,924 bytes against the 1,500,000-byte hero ceiling; its rebuilt distance tiers pass. The baseline global run had 346 failed entries out of 640. Final detailed errors are saved in `test-results/asset-fix-2/validate-global.json`; goal results are saved in `test-results/asset-fix-2/budgets.json`.

No budget exceptions or spec changes. Remaining work is the unrelated validation/unit failures and independent visual review of the contact sheets.
