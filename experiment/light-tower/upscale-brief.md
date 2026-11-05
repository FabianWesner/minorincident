# Task: upscale one concept-art asset into a clean modeling reference

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Work ONLY inside `experiment/light-tower/`.

Input: `experiment/light-tower/crop.png` — a small crop of one asset (yellow mobile generator light tower) cut out of a
stylized isometric game concept sheet. It may contain slivers of neighbouring objects or labels.

Produce `experiment/light-tower/reference-upscaled.png`: a high-resolution, clean reference image of
THE SAME object that a 3D modeler can rebuild from. Use the built-in imagegen tool (edit mode:
first load crop.png with view_image so it is in context). Requirements:
- Same object, same design, same proportions, same colours, livery, markings and text, same
  three-quarter camera angle as the crop. Do not redesign or "improve" it; only clarify detail.
- Isolated: only this one object, centred, fully in frame with a small margin, nothing cropped.
  Remove neighbouring objects, labels, ground clutter and the dark sheet background.
- Seamless light-grey studio background (about #ececec), soft contact shadow only.
- Stylized high-quality 3D game-asset render look, crisp edges, readable small details.
- Landscape (wide) for vehicles/wide objects, portrait for tall objects.
Generate once; if the result is clearly wrong (different object, cropped, extra objects) generate
one more time. Copy the chosen file from $CODEX_HOME/generated_images to the output path.

Finish with exactly one JSON object as your final message:
{"slug": "light-tower", "output": "experiment/light-tower/reference-upscaled.png", "width": <px>, "height": <px>, "attempts": <n>, "notes": "<one sentence>"}
