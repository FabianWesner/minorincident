# Civilian kid

Reference: original civilian sheet, crop and upscaled four-view turnaround. Approximately 1.47 m tall including tousled crown; visible face/skull is about one quarter of the silhouette including hair. Warm child face, chestnut layered hair, lavender-white rocket tee, olive cargo shorts, striped white socks, red/ivory sneakers, blue star backpack, left wristwatch.

Rigid hierarchy uses world-preserving joint parenting at neck, shoulders, elbows, wrists, hips, knees and ankles. All static details are joined inside each rigid joint (15 mesh nodes); sockets are empties. Subdivision is applied before export. No image textures, coplanar details or external dependencies. Palette additions describe reference skin, hair, lavender, olive and blue cloth colours beyond the spec's starter palette.

Run through `python3 experiment/tools/blender_run.py ../assets/npc.civilian-kid assets/npc.civilian-kid/build.py -- --glb assets/npc.civilian-kid/model.glb`. Render options: `--render`, `--view front|side|back|hero|turnaround`, `--samples`, `--width`, `--height`, `--pose`.
