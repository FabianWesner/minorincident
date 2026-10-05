# Final review — npc.police-officer

Four build/review rounds completed. Final hero (1600×900, Cycles CPU, 96 samples), front/right-side/back/three-quarter turnaround, and pose test reviewed against reference-upscaled.png and the original crop. Navy uniform, cap, vest, radio, gold insignia, gloves, duty pouches, thigh straps/holster and lugged boots are present. Head is roughly one quarter of the 1.418 m height, with large hands and feet. Applied smoothing, matte palette materials, no image textures; shield relief fitted to the applied clothing/cap shells with 4 mm clearance.

Pose test rotates armL, foreArmL, legR and shinR. Connected parts and thigh holster follow their joints. Export has all 19 required character nodes and parent relationships, finite positions, no skins or textures, and 51,703 triangles (68 meshes). No warnings or console errors on either WebGPU or WebGL2; standard and fitted front/back browser captures retained.

Small visual simplification: fine badge heraldry uses raised shield-and-seal geometry. No other known delivery gaps. Source review found no unnecessary abstraction to remove; reused shape helpers are local and subdivision/decimation are applied before export.

Rebuild all deliverables:
`python3 experiment/tools/blender_run.py ../assets/npc.police-officer assets/npc.police-officer/build.py -- --render assets/npc.police-officer/renders/hero.png --width 1600 --height 900 --samples 96 --deliverables --glb assets/npc.police-officer/model.glb --round 4`
Then `python3 assets/npc.police-officer/assemble_turnaround.py` and the specified capture_glb command, followed by `python3 assets/npc.police-officer/verify.py`.
