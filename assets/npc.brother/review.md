# Final review — npc.brother

Five design rounds, with a corrective re-export within the fifth round to remove four nape locks clipping into the cheeks. Final hero, front, side, back, pose test and game captures reviewed against both supplied references.

Identity preserved: child proportions, red/cream star cap, brown hair and eyes, smiling face, red open zip hoodie, cream undershirt/drawstrings, charcoal cargo shorts, striped socks, red/white sneakers and blue star backpack. Height 1.427 m including cap; bare face height about 0.36 m. Relaxed stance and soles at ground level. Protected NPC metadata; no gore or stump geometry.

Animation: 19 contract nodes, correctly nested shoulder/elbow/hand and hip/knee/foot pivots. Pose test rotates armL, foreArmL and legR with their attached details and sockets following. Fifteen rigid GLB meshes (49 material primitives in Three.js). Applied subdivisions; no live subdivision modifiers, image textures, non-finite positions or zero-area triangles.

Validation: 53,892 exported triangles, WebGPU and WebGL2 both load without console errors. Hero 1600×900 at 96 samples; four review views and pose 960×540 at 24 samples; turnaround 1680×540.

Remaining simplifications: cap rear opening and fine fabric stitching; rigid sleeve joint transitions remain visible at close range.

Reproduce delivery:
`python3 experiment/tools/blender_run.py ../assets/npc.brother assets/npc.brother/build.py -- --render assets/npc.brother/renders/hero.png --view deliver --glb assets/npc.brother/model.glb --samples 24 --width 960 --height 540`
