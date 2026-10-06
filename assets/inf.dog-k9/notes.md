# Infected police K9

Reference studied: upscaled four-view turnaround, original crop and infected-animals sheet. Broad crouched shepherd with oversized head and paws, vertical pointed ears, tan coat with dark saddle/mane, dimensional open snarl, red emissive eyes, navy police vest, chest/side POLICE patches, webbing, buckles, top handle and collar tag. The anatomical body stays canine rather than adopting the worker zombie's biped pose.

Rigid hierarchy: hip → torso → neck → head → jaw; front legs use arm/foreArm/hand and quadruped legF/pawF aliases; rear legs use leg/shin/foot and legB/pawB aliases. Hidden stump caps remain on the proximal joints. All fur is thick mesh volume. No image textures or thin fur cards. Subdivision and bevels are applied before export. Decorations are joined within each rigid part with palette material slots retained.

Dimensions follow the visual reference rather than the placeholder manifest's humanoid dimensions. Blender +X is forward and -Y is the right side. Oversized feet touch Z=0. This standalone asset does not change manifest, specifications or runtime code.

Review rounds: round 1 established the full sculpt and harness (62,491 triangles); round 2 strengthened shepherd markings, mane and the open jaw, fixed vest/fur intersection (41,787 triangles). Round 3 pulls the mouth lining behind the teeth, exposes canine fangs and incisors, lowers the forehead dome, adds visible shoulder fur, makes the chest identity plate stand clear and reduces applied surface density again. Four camera views check coverage and the silhouette.

Orchestrator animal-budget correction: LOD0 is now capped at 12,000 triangles. Applied per-part reduction retains the same source sculpt, anatomy and palette, with red eye geometry protected separately. Lower LODs use fewer fur tufts and direct low-segment spheres/tubes without subdivision. LOD2 omits fine lettering but keeps the harness panels. Each level retains the full rigid joint/cap contract.
