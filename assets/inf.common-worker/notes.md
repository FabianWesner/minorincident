# Common Worker — hero Runner

Source: original crop and upscaled turnaround. Final height 1.665 m, enlarged chibi head/face, big hooked hands and welted shoes. Charcoal jacket and grey trousers, ivory collared shirt, red tie, rolled/torn cuffs, dark swept layered hair, glowing red eyes and open snarling mouth. The latest explicit instruction requests a hunched forward-reaching rest pose instead of the original relaxed stance.

The self-contained build uses documented palette names and glTF-friendly scalar materials, without image textures. Subdivision is applied before export, followed by game-budget reduction and explicit triangulation. Static details merge per rigid parent/material set. The jaw has two palette regions; duplicate slots are removed. Current export: 37,142 triangles, 58 glTF mesh records / 59 Three.js mesh primitives.

Rig: all named joint empties remain separate, pivoted at neck, shoulders, elbows, wrists, hips, knees and ankles. Rest shaping/rotations are baked into vertices and joint locations. Exported joints have zero rotations and unit scales. Feet are grounded after knee bending. rig-rest.json records measured pivots and ground contact.

Stump caps remain on proximal nodes so they stay with the body when a limb detaches. Zero scale plus hidden/stumpFor extras implements hidden caps because glTF lacks a visibility flag. Enable a cap by restoring its scale to one. Pose test rotates armL/foreArmL/legR and exposes stump_armL; an opposite-arm amputation shows stump_armR unobstructed.

The task's applied subdivision and 40k infected hero budget override generic pipeline defaults. Only this asset directory was edited; no specs or reference image edits.
