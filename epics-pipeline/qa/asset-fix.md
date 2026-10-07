# Asset repairs — lane/asset-fix

Base main: `71489230`. Rebuilt from bpy sources with the existing blender_run.py wrapper, CPU Cycles, and packed each asset with `npm run assets:pack -- <id>`. No merge or deployment.

All 20 contact sheets were opened and visually inspected: 1200×600, LOD0/1/2 columns, azimuth 45°/225° rows, game lighting/palette and 36° camera elevation. Values below describe shipped public GLBs; KiB means bytes / 1024.

| Asset | Problem and change | Triangles LOD0 / 1 / 2 | KiB LOD0 / 1 / 2 | Contact sheet |
| --- | --- | --- | --- | --- |
| bld.fire-station | Black structural faces: reset outward normals, preserve readable AO and correct far-roof material. | 53422 / 7991 / 1881 | 741.4 / 116.7 / 40.8 | [sheet](../../assets/bld.fire-station/renders/lod-check.png) |
| bld.garage-detached | Glowing gables: enforce opaque wall material; retain gables under lifted roof. | 76056 / 8064 / 2528 | 832.1 / 110.6 / 46.2 | [sheet](../../assets/bld.garage-detached/renders/lod-check.png) |
| prop.lab-signs | Clipped print: fit complete icon/text geometry within boards with 45 mm margins at every LOD. | 8934 / 8892 / 8892 | 82.6 / 91.9 / 91.9 | [sheet](../../assets/prop.lab-signs/renders/lod-check.png) |
| veh.suv-green | Shredded tiers: conservative reduction with glass protected. | 69788 / 38498 / 17662 | 953.6 / 823.4 / 441.8 | [sheet](../../assets/veh.suv-green/renders/lod-check.png) |
| bld.joes-diner | Shredded tiers: conservative reduction with JOE’S DINER glyphs protected. | 89115 / 52784 / 26688 | 887.9 / 805.6 / 437.9 | [sheet](../../assets/bld.joes-diner/renders/lod-check.png) |
| bld.bus-stop | Torn canopy: conservative reduction preserves curved silhouette. | 10546 / 5659 / 2400 | 126.4 / 87.8 / 44.6 | [sheet](../../assets/bld.bus-stop/renders/lod-check.png) |
| bld.house-c | Spiky roof: conservative reduction and hard normals. | 89776 / 49980 / 23106 | 1006.9 / 915.2 / 448.1 | [sheet](../../assets/bld.house-c/renders/lod-check.png) |
| bld.house-a | Torn roof: conservative reduction and hard normals. | 84580 / 46472 / 21096 | 924.2 / 879.6 / 431.3 | [sheet](../../assets/bld.house-a/renders/lod-check.png) |
| bld.mainstreet-brick | Minor torn far tier: conservative closed-detail reduction and hard normals. | 95698 / 53367 / 25163 | 1622.5 / 814.8 / 414.5 | [sheet](../../assets/bld.mainstreet-brick/renders/lod-check.png) |
| veh.fire-engine | Minor torn far tier: conservative closed-detail reduction and hard normals. | 66202 / 38221 / 18842 | 1245.9 / 735.2 / 390.4 | [sheet](../../assets/veh.fire-engine/renders/lod-check.png) |
| bld.helipad | Minor torn far tier: conservative closed-detail reduction and hard normals. Protect landing ring/H. | 19343 / 11006 / 5458 | 155.5 / 137.0 / 72.7 | [sheet](../../assets/bld.helipad/renders/lod-check.png) |
| veh.military-truck | Minor torn far tier: conservative closed-detail reduction and hard normals. Protect canvas. | 71568 / 41848 / 21494 | 595.5 / 1113.5 / 607.4 | [sheet](../../assets/veh.military-truck/renders/lod-check.png) |
| bld.school-elementary | Minor torn far tier: conservative closed-detail reduction and hard normals. | 88628 / 48839 / 22315 | 1521.5 / 920.1 / 428.4 | [sheet](../../assets/bld.school-elementary/renders/lod-check.png) |
| bld.house-b | Minor torn far tier: conservative closed-detail reduction and hard normals. | 77684 / 42971 / 19847 | 1405.6 / 732.7 / 368.7 | [sheet](../../assets/bld.house-b/renders/lod-check.png) |
| bld.gas-station | Minor torn far tier: conservative closed-detail reduction and hard normals. | 94400 / 53817 / 26768 | 1230.4 / 766.2 / 409.8 | [sheet](../../assets/bld.gas-station/renders/lod-check.png) |
| veh.box-truck | Panel shading artifacts: reconstruct hard-edge normals on existing tiers, retaining geometry. | 68839 / 37841 / 30274 | 656.1 / 613.7 / 489.7 | [sheet](../../assets/veh.box-truck/renders/lod-check.png) |
| veh.ambulance | Panel shading artifacts: reconstruct hard-edge normals on existing tiers, retaining geometry. | 74804 / 35850 / 27477 | 472.4 / 390.9 / 293.5 | [sheet](../../assets/veh.ambulance/renders/lod-check.png) |
| veh.semi-trailer | Panel shading artifacts: reconstruct hard-edge normals on existing tiers, retaining geometry. | 67000 / 42907 / 34900 | 606.1 / 609.0 / 489.5 | [sheet](../../assets/veh.semi-trailer/renders/lod-check.png) |
| veh.sedan-white | Panel shading artifacts: reconstruct hard-edge normals on existing tiers, retaining geometry. | 53990 / 20626 / 13625 | 611.8 / 438.7 / 317.2 | [sheet](../../assets/veh.sedan-white/renders/lod-check.png) |
| veh.courier-van | Panel shading artifacts: reconstruct hard-edge normals on existing tiers, retaining geometry. | 71970 / 30693 / 22335 | 787.6 / 714.1 / 528.0 | [sheet](../../assets/veh.courier-van/renders/lod-check.png) |

The garage's additional [roof-lift sheet](../../assets/bld.garage-detached/renders/lod-roof-off.png) was inspected: opaque gables remain visible at every LOD. Courier-bike was skipped as requested because lane/bike-model is rebuilding it.

## Delivery pipeline

The packer previously replaced larger authored tiers with aggressive 12%/3% simplification, discarding the reviewed source geometry and hard normals. Explicit per-asset authoredLodRatios now retain source exports through compression/quantization and reject missing tiers or automatic regeneration. Unmarked assets keep their original contract.

Shared bpy helpers dissolve planar tessellation, moderately reduce closed detail, preserve material/seam/sharp boundaries, reject reductions that increase boundary-edge counts, and reconstruct hard normals. Glyphs and selected glass/canvas/landing silhouettes use planar-only reduction. Reduced repairs target approximately 55%/25%; protected components can raise ratios (military truck reaches 30.03%, within 0.5 percentage-point tolerance). Fire station/garage retain native clean simplified variants. Sign typography retains almost all geometry. Five normals-only vehicles retain existing triangle ratios as requested.

Sources support baked LOD0 reuse with --lod-only; normals-only sources support decoded existing tiers with --normals-only. Full source builds also apply the corrections. Mixed RGB/RGBA AO layouts bypass vertex-stream sharing before index rebasing, fixing diner packing without corrupting attributes. Collision baking now skips unchanged source hashes. The headless contact-sheet workflow is documented in tools/assets/README.md.

## Validation

- Typecheck, lint and build passed.
- Full unit suite on Node 22.22.2: 73 files, 229 tests passed, using machine-wide sim-lock and --maxWorkers=2.
- Focused authored-LOD/collision tests: 2 files, 5 tests passed.
- E17 verification: 38 tagged unit tests and 36 headless browser tests passed; browsers used e2e-lock and at most two workers. [Check records](asset-fix-e17-checks.json).
- [Delivery validation](asset-fix-validation.json): all 40 repaired LOD1/2 tiers pass. 58/60 total tiers pass. Two unchanged baseline LOD0 files exceed their existing 1500 KiB cap: mainstreet-brick (1,661,452 bytes) and school-elementary (1,557,984 bytes). Both match base bytes; no budgets/specs were relaxed.
- All final sheets checked from both directions: roofs, panels, gables, canopy, sign margins, diner lettering, glass, canvas and landing markings. No tears or black structural faces observed.

An earlier Node 21 full run hit an existing Dirent.parentPath incompatibility in the audio test and stuck worker shutdown. The completed Node 22 run supersedes it; only this job's stuck processes were terminated.
