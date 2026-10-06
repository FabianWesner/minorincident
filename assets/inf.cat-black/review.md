# Final review — inf.cat-black

Five initial visual rounds and one crowd-budget QA round completed, comparing front, side, back and three-quarter views with the supplied turnaround. Final hero and turnaround were compared again to the reference. Preserved the small stalking feline silhouette, raised arch, hooked upright tail, triangular ragged ears, black/purple coat, exposed skin islands, red infected eyes, fanged open mouth, whiskers and oversized clawed paws. Fur uses smooth sculpted clumps rather than textures. No clothing or equipment appears in this reference.

Round 1 established the cat and face. Round 2 flattened and lengthened fur and widened framing. Round 3 added dorsal/tail coverage and corrected eye occlusion. Round 4 connected the angry brows and enlarged exposed skin patches. Round 5 seated dorsal locks on the actual coat and finished the rear patches. Final functional review moved shoulder caps to the actual cut surface so they remain visible after detachment.

The rig retains all required infected names and all quadruped names. Quadruped upper meshes follow the leg aliases; aliases sit inside the infected arm/leg hierarchy. The jaw and hooked tail have separate pivots. Animation joints export with zero rest rotations and unit scale. Both infected and quadruped stump names are real, hidden zero-scale meshes on the retained parents. Pose-test left panel rotates armL, foreArmL and legR; right panel removes armL and shows stump_armL. The red cut surface is clearly visible below the left shoulder.

Validation: LOD0 7,471 triangles (under the revised 8,000 limit), LOD1 2,842 triangles, LOD2 1,343 triangles; 60 exported meshes per LOD, 7 palette/emissive materials, no image textures, no missing nodes, finite vertices, ground contact within 2e-8 m. All subdivision and budget reduction modifiers are applied. WebGPU and WebGL2 captures load all three final GLBs without warnings, console errors or page errors. Captures include front three-quarter, rear three-quarter and gameplay views.

Delivery: hero.png 1600×900 at 96 samples; turnaround.png 2560×540 (front/side/back/three-quarter); pose-test.png 1920×540 (intact posed/detached). Review views and pose panels use 960×540 at 24 samples. Scripts build and render solely through the shared Blender launcher. Reference images and files outside this asset folder were not edited.

Rebuild all deliveries:
`python3 experiment/tools/blender_run.py ../assets/inf.cat-black assets/inf.cat-black/build.py -- --render assets/inf.cat-black/renders/hero.png --view final-set --samples 96 --width 1600 --height 900 --glb assets/inf.cat-black/model.glb`

Export validation: `node assets/inf.cat-black/validate_glb.mjs`.
Browser capture: `node experiment/tools/capture_glb.mjs /assets/inf.cat-black/model.glb assets/inf.cat-black/renders/three`.

No remaining delivery gaps. The revised LOD0 is about 80% lighter than the previous 38,239-triangle export. Fur layers use fewer, wider chunky clumps; head, limbs, toes, tail and caps use fewer segments. The arch, curled tail, red eyes, open snarl, palette, rigid node names and hidden caps remain intact. LOD1 and LOD2 are now regenerated, with all the same required nodes and caps. Triangle counts above are measured from the exported GLBs. Render/comparison helpers were consolidated, unused randomness removed, and static detail merged only within each rigid joint and material.

Regenerate lower LODs:
`python3 experiment/tools/blender_run.py ../assets/inf.cat-black assets/inf.cat-black/build.py -- --lod 1 --glb assets/inf.cat-black/model.lod1.glb`

`python3 experiment/tools/blender_run.py ../assets/inf.cat-black assets/inf.cat-black/build.py -- --lod 2 --glb assets/inf.cat-black/model.lod2.glb`

Validate each using `node assets/inf.cat-black/validate_glb.mjs 0` (or `1`, `2`). Lower LOD gameplay captures and backend logs are retained alongside the LOD0 captures.
