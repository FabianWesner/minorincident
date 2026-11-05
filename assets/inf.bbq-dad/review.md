# inf.bbq-dad — hero review

Visual review: pass. Final hero and four-view turnaround were compared again with reference-upscaled.png and reference.png after three modeling rounds. The accepted common-worker render guided the enlarged head, thick hair volumes, chunky hands/feet, bent knees and forward-reaching silhouette.

- Cream camp shirt, separate collar, rolled sleeves and hanging shirt hem; charcoal apron with modeled GRILL / flame / CHILL motif, bound edges, seams, back waist knot/bow and tails.
- Taupe cargo shorts with raised flap pockets and cuffs; two sandal straps, footbeds, soles, individual toes and nails.
- Brown swept volumetric hair; orbital sockets, angry brows, nose/nostrils, carved open mouth, separate gums/teeth/tongue, red emissive eyes and raised blood smears.
- Right-hand spatula has a grip, shaft and genuine open blade slots.
- Applied subdivision and smooth shading; palette-only Principled materials; no image textures. Blood is offset 4 mm before uniform scaling (3.78 mm after scaling).
- 35,404 triangles, 52 meshes including seven hidden stump caps. Height 1.602 m; soles at z=0 within floating-point tolerance.
- All required infected nodes are separate joint empties with zero rest rotations and unit scales. Caps remain children of the proximal part and have origins at the cut joints.
- renders/pose-test.png compares joint movement (armL, foreArmL, legR) with the left-arm subtree hidden and stump_armL revealed. Left-side camera makes the red cap visible.
- Final WebGPU and WebGL2 captures have no console errors. See browser-check.json and renders/three-*.png.
- Repository typecheck, lint, and 25 unit tests passed, with Vitest capped at four workers. Epic-wide verify was not invoked because it writes/builds outside the authorized asset directory.

Rounds: 1 initial build; 2 wider stance, shorter hair, claw direction, conforming blood and triangle reduction; 3 shirt hem, cheek blood and mouth/material finishing. Final pose camera was adjusted after review so the cap is visible. Script review removed duplicate sheet assembly and temporary construction files; helpers are limited to materials, joint nodes, rounded primitives, cloth patches, tubes, projection and rendering.

Known gap: Blender's mesh reduction produces small vertex-data differences across repeat builds, including a single-thread check. Triangle count and node hierarchy match, but byte-identical rebuilds are not guaranteed. Hash evidence is recorded in determinism.json.

Deliverables: build.py, model.glb, renders/hero.png (1600×900, 96 samples), renders/turnaround.png, renders/pose-test.png, WebGPU/WebGL2 captures, report.json, validation.json.
