# Infected flamingo

Reference studied: upscaled four-view turnaround, original crop and infected-animals sheet. Bare bird, no clothing or equipment. Required identity: coral/pink feathers with lighter overlapping coverts, dark missing-feather windows, sinuous neck, ivory/pink hooked bill with charcoal tip, glowing red eyes, one raised folded leg and clawed toes. Target height about 1.60 m; exaggerated skull/bill silhouette and soft rounded anatomy preserve the miniature art direction without making the bird humanoid.

Both bird and infected rigid node contracts are provided. `armL/R` drive the wing roots, `foreArmL/R` the lower coverts and `handL/R` the flight feathers. `wingL/R` are intermediate bird semantic nodes. Caps sit on proximal parts, have `stumpFor`/`hidden` extras, and export at zero scale. Set cap scale to one when displaying it. No skinning or textures. Applied subdivision, static parts merged by rigid parent/material.

Pink feather palette extensions: pal_flamingoPink, pal_flamingoBlush, pal_flamingoCoral, pal_flamingoShadow. Existing gore, beak-black, skin and eye palette tokens retain the specification colors. These pink extensions are needed to match the supplied reference.

## Animal crowd budget revision

LOD0 uses 8,270 triangles. Lower LODs retain one feather tuft in two/four with a minimum sculpt density, rather than crushing every feather into isolated triangles. They keep the same pivot positions and node names. Hidden caps use simpler spheres at lower LODs.

Rebuild: `python3 experiment/tools/blender_run.py ../assets/inf.flamingo assets/inf.flamingo/build.py -- --glb assets/inf.flamingo/model.glb` (add `--lod 1`/`--lod 2` and matching output filenames). Render all final evidence: same wrapper with `--render assets/inf.flamingo/renders/hero.png --view final`. Individual review views use `--view front|side|back|hero`; standalone pose uses `--pose`.

Assemble a turnaround without a render slot: use the same wrapper with `--sheet assets/inf.flamingo/renders/turnaround.png`.
