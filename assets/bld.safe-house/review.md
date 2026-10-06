# Safe house production review

Five visual refinement rounds completed. Final hero: renders/hero.png, 1600 × 900, Cycles CPU, 96 samples. Final game-angle Blender render: renders/game.png, 960 × 540, 24 samples. Three.js study/front-back and game views: renders/three-WebGPU-* and renders/three-WebGL2-*. All LOD game views and repeated frames: renders/lod*-*.png.

The final kit preserves the one-storey bungalow silhouette, broad shingled roof, lower projecting porch gable, red chimney, pale lap siding, cream trim, glowing front window, boarded windows and entry, geometric house plaque, raised SURVIVORS INSIDE sign, porch stairs/rail, sandbag stacks, interrupted pickets and garden border. Foliage is clustered rather than individually wired or leaf-modelled. Markings are texture-free geometry; sign lettering is 8.5 mm proud and the house icon 30 mm proud. No flicker observed; three fixed-camera LOD0 frames are pixel-identical on both backends.

Round history: (1) found buried shingles and 78,248 triangles; (2) exposed tiles and reduced bevel segments to 39,680; (3) improved lettering, sacks and bounded foliage at 43,136; (4) added the projecting porch gable; (5) corrected vent/plaque spacing and replaced fragmented automatically decimated LOD2 with an authored distant mesh.

LOD0: 45,720 triangles / 18 draw calls / 4,596,464 bytes. LOD1: 4,866 triangles (10.64%). LOD2: 1,592 triangles (3.48%) / 11 calls. Category nodes, hinged door parent, hideable roof subtree, floor interior, collider and window-light extras are present. AO is baked at 32 samples to vertex colors. No textures, invalid positions or degenerate triangles in any export. Runtime errors/warnings: none on WebGPU or WebGL2 for all LODs. See audit.json and runtime-check.json.

Known integration gap: reference-based kit bounds are 7.915 × 7.090 × 5.690 m in Blender axes, different from the older manifest placeholder. Manifest changes are outside this job's asset-only scope. Roof and interior are intentionally functional groups; no furnished interior is depicted in the reference.

Source simplification: retained small reusable box/beam/blob helpers, batched repeated parts by palette material and functional parent, removed the singleton LOD loop and unused material/bookkeeping. Authored LOD2 shares these helpers and material definitions.

Verdict: asset build, visual review and renderer checks pass; manifest bounds need updating at integration.
