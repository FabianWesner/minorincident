# Level 1 garden / alley / house parts

Source: `initial-drafts/l1v2-neighborhood-kit-2.png`. Original group crops and cleaned imagegen references live in the four requested collection directories. Individual labelled items have their own original and clean reference crops, build script and LOD chain. Aggregate placeholder IDs are not registered or substituted by this job.

26 individual IDs, preserving the sheet's spelling (including `house.*`, `prop.flower-bed.large`, `prop.flower-bed.small`, `prop.flower-box`). No equivalent decorative flamingo or garden gnome existed; `inf.flamingo` is an infected bird, and `prop.folding-chair` / `prop.trash-bin` have different designs.

Each `build.py` is self-contained and embeds the batch modeling helpers; palette/AO are read through the existing project sslib. `build_support.py` is the ignored authoring template, not a required delivery dependency. No source/reference/spec/manifest outside this batch is modified. `write_builds.py` records all recipes, `crop_items.py` records crop coordinates, `run_batch.py` invokes the mandated Blender wrapper with at most three processes. All modeling/export/AO is CPU; review renders are Eevee. Backface culling is enabled; normals and degenerate poles are repaired before export.

## Reproduction

```sh
python3 experiment/tools/blender_run.py ../assets/prop.bbq assets/prop.bbq/build.py -- --glb assets/prop.bbq/model.glb --render assets/prop.bbq/renders/game.png
npx tsx assets/prop.garden-set/pack_lods.mjs prop.bbq
npx tsx assets/prop.garden-set/audit.mjs prop.bbq
```

Swap the ID for any of the 26 items. Run packaging after Blender: GLBs are meshopt compressed and quantized (12-bit positions, 8-bit normals/colors) using the existing project IO/compression modules. The active baked AO stream is exported alone as COLOR_0. Corner AO is averaged at each geometric vertex, remapped to 0.55–1.0 to keep broad toy surfaces readable, and retained at 64 grayscale levels; unused UVs and duplicate color streams are removed. LOD1 targets 12%, LOD2 3%; permissive meshoptimizer reduction handles normal seams, with sloppy reduction only when standard simplification cannot reach the target. Named joints, front markers, light anchors and colliders survive all levels.

## Integration limits

- Manifest and public runtime model paths are intentionally untouched. The integrator needs to register these individual IDs; collection placeholder nodes/dimensions are not contracts for this split delivery.
- Garage doors expose `door` pivots/vertical slide metadata; frame and door colliders are separate. The slabs use slab colliders; the hoop has a separate pole collider.
- `prop.sprinkler` exports the opaque base and hose; water arcs belong to runtime VFX and are not baked as static geometry.
- Pool water is an opaque stylized palette surface; no transparent refraction or animated water is authored.
- WebGPU remains a manual check, per repository guidance. Automated browser smoke uses headless Chromium, WebGL2, Metal, and the shared e2e lock.
