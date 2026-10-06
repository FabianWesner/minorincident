# Visual and contract review

Four rounds: three modeling rounds, then a source-matching final render after invisible mesh-sliver cleanup. Final front, side, back, three-quarter and hero views compared against the upscaled turnaround and original crop. Four adult identities remain recognizable: tan-capped stocky man with beard; purple-capped woman; tousled brown-haired man with rectangular glasses; auburn-bun woman in mustard. Healthy wide eyes, raised inner brows and small open mouths communicate fear. This is the relaxed rest stance requested for animation, rather than the original crop's gesture pose.

Round 1 established geometry and hierarchy, but clipped the nearest soles and obscured brows with the cap bills. Round 2 widened framing, raised the bills, tightened the group, added tailoring folds and broader male torsos. Round 3 added a full cap-man beard, dark cargo cloth, hair ridges, pink sneaker panels and pack stitching. The centered group root preserves four independent rigid hierarchies. Applied subdivision and soft bevels provide sculpted volumes without live modifiers or skinning.

The final side sheet separates members for inspection, matching the source sheet presentation; GLB formation stays close. Pose-test rotates armL, foreArmL and legR on every member, with a compensating shinR rotation. Clothing, fingers and shoe shells follow the owning joints; shoulders, elbows and hips remain attached. Export happens before this diagnostic pose is applied.

GLB has no textures. Materials are flat Principled palette tokens; the extra skin, hair and fabric colors extend the starter palette. Static details are joined into 64 rigid-part meshes, keeping the required joints and sockets. Both browser backends are captured at front/rear study angles and the game angle. Structural and binary geometry checks are reproducible using `python3 assets/npc.survivor-group/validate.py`.

No source references or files outside this asset directory were changed.

Final exported count: 56,324 triangles across 64 GLB meshes, with 141 nodes. Binary validation found zero degenerate triangles and no non-finite positions. Both WebGPU and WebGL2 report an empty console-error list; logs are stored in browser-validation.jsonl.
