# Catalog defect review — 2026-10-11

Scene Lab captures use the game camera, deterministic catalog seeds and headless WebGL2. The clinic scene uses the current placement ID (the old catalog anchor addressed an empty lot). Before captures preceded edits. Each delivered contact sheet and all five LOD sheets were visually inspected; the observations below describe the selected captures.

## Decisions and inspected differences

| Item | Decision | Before → after at game camera | Evidence |
| --- | --- | --- | --- |
| Park lodge | Bug: runtime placeholder | Red block with a bare pitched roof → warm timber lodge, closed gable roof, veranda columns/braces, chimney and framed windows on front/rear/sides. | [Contact sheet](captures/bld-park-park-lodge.jpg) |
| Reptile house | Bug: runtime placeholder | Blank teal block → teal framed glazing, cream casings, pitched roof and raised ribbed greenhouse monitor; entrance awning and small reptile emblem. | [Contact sheet](captures/bld-zoo-reptile-house.jpg) |
| Zoo gate | Bug: runtime placeholder | Blank yellow block → two ticket pavilions, brick piers, deep lintel, pitched roofs, framed windows and central barred gate. | [Contact sheet](captures/bld-zoo-zoo-gate.jpg) |
| Police rear | Bug: unarticulated rear | Plain brick wall → two rows of framed rear windows, armory glazing, pilasters and horizontal courses. Existing frontage preserved. | [Contact sheet](captures/bld-corridor-police-station.jpg) |
| Gym lawn slab | Bug: unsupported legacy collapse-canopy mesh | Orange slab by the doors → lawn unobstructed. | [Contact sheet](captures/bld-school-gym.jpg) |
| Pharmacy lawn slab | Same legacy mesh bug | Orange slab → clear lawn beside the entrance. | [Contact sheet](captures/bld-shop-pharmacy.jpg) |
| House C lawn slab | Same legacy mesh bug | Orange slab → clear lawn. | [Contact sheet](captures/bld-res-house-c.jpg) |
| Reptile lawn slab | Same legacy mesh bug | Orange slab → clear lawn (same sheet as building rework). | [Contact sheet](captures/bld-zoo-reptile-house.jpg) |
| Grove black parallelograms | Intended driveway paving | Asphalt-colored rectangular driveways retain their bounds and relation to the houses/road. | [Contact sheet](captures/bld-grove-house-a.jpg) |
| Corridor red/green slabs | Intended party/boundary walls | Low colored walls separate shop plots; retained. | [Contact sheet](captures/bld-corridor-joes-diner.jpg) |
| Diner navy roof shape | Intended rooftop sign reverse | Navy rectangle is the unlettered back of the mounted diner sign; front reads Joe’s DINER. Retained. | [Contact sheet](captures/bld-corridor-joes-diner.jpg) |
| Clinic entrance glass | Bug: emissive door panes | Blown-out cyan leaves → dark teal tinted, non-emissive glass. Other clinic lights/window materials remain independently lit. | [Contact sheet](captures/bld-grove-clinic-annex.jpg) |
| Explosion detached parts | Bug: anonymous dark plates | Flat black debris → rounded metal panels with raised reinforcing ribs and contrasting warm metal/silver surfaces. The hood ribs follow its broad face; physics/lifetime/pool capacity stay consistent. | [Contact sheet](captures/fx-car-explosion.jpg) |

## All LODs beside the established house kit

Each [LOD sheet](lod/) has LOD0/LOD1/LOD2 columns. Rows show target front, house B front, target rear, house B rear, with the game 25° lens/36° elevation at azimuths 45° and 225°. The neighboring house kit supplies the palette, roof volume, casing/mullion and trim reference. Native Blender recipes reuse that kit’s Scene, palette, AO, sockets and collider/export helpers.

- [Lodge](lod/bld.park-lodge.png): veranda, chimney, roof volume and framed windows survive every tier; fine siding/roof seams disappear at distance.
- [Reptile house](lod/bld.reptile-house.png): greenhouse monitor, ribs, roof silhouette, window casings and entry awning stay readable; emblem detail reduces at LOD2.
- [Zoo gate](lod/bld.zoo-gate.png): both pavilions, pitched roofs, brick piers and central gate gap remain stable; small counters/badge disappear at LOD2.
- [Police](lod/bld.police-station.png): rear glazing/courses remain in all three tiers; frontage and roof silhouette remain consistent.
- [Clinic](lod/bld.clinic-annex.png): dark teal entrance leaves remain legible at all three distances without the earlier cyan bloom.

An initial post-edit review exposed reversed roof faces and overly dark raw AO on the new buildings. Both were corrected before these selected sheets; rejected captures were discarded.

A [full-resolution explosion frame at tick 285](captures/fx-car-explosion-detail.jpg) confirms the near panel’s raised silver ribs and rounded corners. The larger tumbling panel shows its brown metal reverse and rolled edge.

## Delivered budgets

[Machine-readable validation](budgets.json) covers all 18 normal/clinic-burned tier entries with zero errors. Existing manifest triangle, material, draw-call and file caps were retained. The new side-tier assets retain the established 3,000-triangle authored distance allowance. Original building collision footprints and navigation placement data are preserved; the legacy canopy removal keeps its inert named marker for decay metadata compatibility.

| Asset | Triangles LOD0 / 1 / 2 | KiB LOD0 / 1 / 2 |
| --- | ---: | ---: |
| Park lodge | 5728 / 920 / 812 | 100.5 / 18.0 / 16.5 |
| Reptile house | 4260 / 1228 / 964 | 77.0 / 22.9 / 19.0 |
| Zoo gate | 2964 / 844 / 720 | 53.6 / 17.7 / 16.0 |
| Police | 9454 / 2766 / 2298 | 152.0 / 42.2 / 36.8 |
| Clinic | 93153 / 12872 / 3627 | 1414.6 / 205.9 / 73.1 |

## Reproduction

```sh
npm run scene -- docs/scenes/asset-defects/catalog/*.json --out test-results/asset-defects/after --shots 0 --size 960x540
sh tools/e2e-lock.sh npx tsx tools/scenelab/asset-defects-lods.ts
npm run assets:validate -- --ids bld.park-lodge,bld.reptile-house,bld.zoo-gate,bld.police-station,bld.clinic-annex
```

Build the new sources with `python3 tools/blender/run.py assets/<asset>/build.py --glb assets/<asset>/model.glb`, then `npm run assets:pack -- <asset>`. To apply the legacy canopy fix to old published district layouts, run `npx tsx tools/assets/remove-legacy-canopies.ts`; current Blender layout recipes already omit its visible geometry.

## Validation results

- `npm run typecheck`, `npm run lint`, `npm run build`: pass.
- Selected asset validation: 18/18 entries pass; [budgets](budgets.json).
- Full remote Vitest with two workers: 137 files / 497 tests pass; [summary](unit-summary.txt).
- Scene Lab catalog: 11/11 scenes pass, zero console errors/clipping failures; [checks](catalog-checks.json).
- Crowd-visible WebGL: pass, 1,200 frames / 11,948 samples / 4,769 infected samples, zero misses; [metrics](crowd-visible.json).
- `npm run verify -- E17`: typecheck/lint/build and remote E17/smoke unit selection pass; browser checks 41 pass / 1 fail, including all smoke variants. The full 308-asset turntable inventory fails solely on unchanged `decay.broken-glass` (view 1: 7.4%, minimum 10%). All five task buildings pass coverage. [Gate results](e17-checks.json), [scoped inventory results](e17-turntable-summary.json), [failure summary](e17-summary.txt).

No specs, reference assets, or unrelated model recipes were edited. No deployment or main merge was performed.
