# Final review — char.corgi

Five rounds (initial plus four refinements). Compared the final hero and front/side/back
sheet with reference-upscaled.png and reference.png once more after all exports.

The model preserves the orange-and-white barrel body, short white paws, broad head,
upright pink ears, forehead blaze, expressive glossy eyes, open grin, tongue, red collar,
golden bell, white-tipped tail and paired teal pack. Purposeful raised details include
pockets, fabric piping, buckles, rivets, corgi badges, handle and rear red medical cross.
The sculpted surfaces are intentionally smoother than the reference's faceted fur.

Outputs: hero.png at 1600×900 / 96 Cycles samples; final individual review views at
960×540 / 24 samples; turnaround.png in front/side/back/three-quarter order; pose-test.png
at 960×540 / 24 samples. All model builds, renders and sheet assembly used blender_run.py.

Pose test: legFL swings −0.48 radians and legBR +0.38 radians at their body joints;
head tilts at the neck and tail wags at the rump. The lifted paws and attached face/ears
prove parent-child motion. The humanoid pose nodes and infected stump caps do not apply
to a healthy corgi. glb-audit.json verifies all nine exact corgi nodes and their hierarchy.

The final GLB contains 58,624 triangles and 35 meshes, no image textures, no camera/light
or ground geometry. Subdivision and bevel modifiers are applied before export. A second
build has the same canonical triangle-position/material geometry hash (1e-6 m precision).
The exporter may pack/deduplicate accessors differently, so GLB bytes are not guaranteed
identical. No render modifiers remain in the exported model.

Three.js: final WebGPU and WebGL2 captures succeeded with empty console-error lists;
three-validation.jsonl contains backend statistics matching the final Blender export.

Verdict: needs-human for the two disclosed gaps. A small collar/ruff intersection remains
at the rear neck. Asset-local fur/mouth and shaded teal material tokens also require
production palette registration, which is outside this job's allowed directory. No specs,
references, source app files or protected folders were edited. The bounded refinement
limit is exhausted; the deliverable is reviewable rather than silently marked flawless.
