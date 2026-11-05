# Military cargo truck review

Reference: `reference-upscaled.png`. Comparison captures are in `renders/`.

- Round 1: recognizable six-wheel cargo silhouette, split windscreen and stars;
  rejected pale cloth, weak tire shoulders and excessive bevel tessellation.
- Round 2: darker cloth, prominent tread shoulders and rim/lug detail; 73,966
  triangles, 35 draws. Reference and game views reviewed. Requested squarer
  canvas shoulders and continuous front fender lips. Game framing widened.
- Round 3: squarer canvas shoulders and angular fender lips passed reference
  and game review. Export audit requested degenerate-face removal and LOD culling.
- Round 4: final hero render at 1600×900/96 samples and game at 960×540/24
  samples reviewed. Outward fender normals fixed before AO. Truck, stars, bed ribs,
  six wheels and tarp read clearly; no visible coplanar markings in game captures.

Verdict: visual PASS. Main mesh is 71,568 triangles and 35 draw calls. All material
names are known palette tokens, and no image textures are used. AO is present on
all exported primitives. Runtime final captures and joint audit recorded below.

Conventions: +X forward, Z up in Blender/Y up in glTF, wheel contact at zero,
metre units, fictional markings, palette materials only, no image textures.
Markings are raised at least 6 mm. Door pivots at front hinges, wheel pivots
at axle centres, rear gate pivot at its lower hinge; lamp assemblies separate.

Integration note: existing manifest dimensions are placeholder sedan dimensions;
reference-driven truck proportions are used here. Manifest/inventory updates and
runtime registry wiring are outside this asset-folder-only job.

Repository checks: typecheck and lint pass. Unit suite: 65 pass / 1 unrelated
`thr.flashbang` sourceGlb manifest registration failure (see unit.log). Asset-only
validation checks actual exported triangles, degeneracy, palette coverage, named
nodes, precise world bounds, AO and emissive-node anchor resolution.

- Round 5: final renders refreshed after door/tailgate hinge correction and
  robust cleanup of faces that collapse during float32 export. Final GLBs have
  71,568 / 9,393 / 2,198 triangles (LOD0 / LOD1 / LOD2); 35 / 34 / 34 draws.
  All meshes have zero degenerate triangles, baked AO and known palette materials.
  Wheels/doors/tailgate origins checked within 1 mm of their physical joints.
  Both WebGPU and WebGL2 load all three LODs with no console errors.

No changes to source references, specs, manifest, preview or shared tools.
