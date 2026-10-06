# bld.house-d build notes

Source: `initial-drafts/l1v2-neighborhood-kit.png`, original crop [465,157,786,495]. Crop is unchanged; `reference-upscaled.png` was cleaned once with built-in imagegen. Exact prompt, inputs, tool and date are in `prompt.md`.

## Rebuild

```sh
python3 experiment/tools/blender_run.py ../assets/bld.house-d assets/bld.house-d/build.py -- --glb assets/bld.house-d/model.glb --render assets/bld.house-d/renders/hero.png --view ref --width 1600 --height 900 --samples 96
python3 experiment/tools/blender_run.py ../assets/bld.house-d assets/bld.house-d/build.py -- --render assets/bld.house-d/renders/game.png --view game --width 960 --height 540 --samples 24
```

The script creates metre-scale, Z-up geometry facing +X; the exporter maps to glTF Y-up. Root is at zero, the complete footprint is centered, ground contact is zero. It uses shared `sslib.palette`, `sslib.export` and 32-sample deterministic CPU Cycles vertex AO. Review renders use Eevee with backface culling enabled. Export automatically creates and meshopt-compresses/quantizes `model.glb`, `model.lod1.glb`, `model.lod2.glb` using the existing project optimizer. Named emissive meshes and semantic pivots stay protected during optimization so light links resolve.

## Variant controls

`--wall-token`, `--trim-token` and `--roof-token` accept existing palette tokens; defaults are mustardLight, picketWhite and navy. `--mirror` reflects the complete assembly with corrected winding and hinge metadata. `--garage` adds a single-car bay with an addressable overhead door; the base export has no garage. `--no-dressing` removes the ornamental garden/flower dressing. `--door-angle -75` gives the reviewed inward-opening pose without changing the exported rest pose. Export variants to separate filenames.

Material slots are declared in root `colorSlots` extras. Required `root`, `door_front`, `roof`, `interior` and +X `front` marker survive all LODs; roof includes its attic/dormer window and can be hidden independently. Walls and lap siding have actual openings. Windows have glazing, mullions, casings, curtain folds and projecting sills. No coplanar overlays or textures. Static geometry joins by material within visibility/articulation groups. Window/lantern anchors use `ss_light` object extras and reference the exported emissive nodes; colliders and entrance socket are empties.

LOD1 uses 14% geometric decimation. LOD2 is authored from un-bevelled continuous wall/foundation boxes, intact roof decks, gables, casings, entrance/porch parts, chimney and plant cores captured before detail merging. It does not decimate the hero mesh: roof surfaces and building silhouettes remain intact. LOD1 collapse is constrained to the original material bounds. Cycles AO is remapped to a restrained 0.68–1.0 shade range, with vertex alpha fixed to one, so enclosed faces never turn the bright palette black.

## Deliberate simplifications

Shutters, dormer, upper window boxes, portico, brick steps and right-side chimney match the sheet; the hidden rear is inferred.
Interior furnishings and flower/pine shapes are simplified palette-only forms. Close reference glazing appears more orange than the neutral studio render; the same warm windowGlow token and real lantern light anchors are retained. Optional garage changes the footprint and needs its own integrator dimensions/collision contract.

## Integration handoff

No manifest entry was modified and nothing was committed. Existing placeholders have the required building nodes but side tier; registration must set hero tier and the three delivered paths. WebGPU remains a manual check under repository rules; headless automated renderer QA uses WebGL2/Metal. Whole-epic E17 integration verification belongs after registration; these standalone files were checked directly with the shared GLB validator, determinism rebuilds and renderer inspection.

Repository checks: `npm run typecheck` PASS; `npm run lint` PASS; `npm run test:unit -- --maxWorkers=4` PASS (65 test files passed, two skipped; 200 tests passed, two todo). No source, specs or manifest modifications were needed.
