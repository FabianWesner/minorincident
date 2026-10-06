# Yard gate modeling notes

Source crop: initial-drafts/l1v2-neighborhood-kit.png, pixel bounds [60, 620, 415, 820]. The crop contains both concept variants. Built-in imagegen edits produced reference-upscaled.png in one attempt; prompt.md records the prompt.

Wood is model.glb; chain-link is model.chain-link.glb. Each has its own .lod1.glb and .lod2.glb. Load one variant at a time. Cream capped posts, eight rounded cedar boards, two face rails, diagonal brace, black hinges and latch match the wood reference. The metal variant uses solid rounded frame tubes and cylindrical diamond strands, collars, post caps, brackets and latch hardware.

Blender +X faces forward, +Z is up; glTF +X front and +Y up. gate is an empty rigid assembly with its origin on the hinge axis: Blender Y = 0.688 m (wood), 0.715 m (chain-link), Z = 0. Rotate gate about glTF Y to open. Gate meshes and col:gate move with it; post meshes and col:postL/R stay fixed. Hinge/latch sockets are root children. The latch and post hardware avoid coplanar face overlays.

Wood: 0.318 m deep × 1.900 m wide × 1.625 m tall. Chain-link: 0.186 m deep × 1.792 m wide × 1.611 m tall. Exact optimized bounds, nodes, triangles and hashes are in validation.json. Palette tokens are read directly through sslib.palette; no textures or custom colors.

Authored LOD1 drops grain/fasteners and reduces bevels/diamonds. LOD2 uses a scalloped solid wood panel or sparse diamond lattice with complete posts/frame. Distance tiers are explicitly built rather than indiscriminately decimated. Deterministic CPU AO is baked separately for each tier, with other tiers hidden.

Reproduce (from repository root):

```sh
python3 experiment/tools/blender_run.py ../assets/prop.yard-gate assets/prop.yard-gate/build.py -- --glb assets/prop.yard-gate/model.glb --render assets/prop.yard-gate/renders/game.png --view game
python3 experiment/tools/blender_run.py ../assets/prop.yard-gate assets/prop.yard-gate/build.py -- --variant chain-link --glb assets/prop.yard-gate/model.chain-link.glb --render assets/prop.yard-gate/renders/game-chain-link.png --view game
npx tsx assets/prop.yard-gate/pack.ts
```

pack.ts uses the existing project optimizer to quantize and meshopt-compress only this directory's models. It validates named nodes, hinge preservation, solid materials, finite/nondegenerate geometry and delivery size. Registration and runtime copies belong to the integrator; no manifest changes were made.
