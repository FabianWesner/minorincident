# inf.lion visual review

Four modeling rounds, compared against reference-upscaled.png, original reference.png, and the infected-animals concept sheet.

- Identity: broad tawny feline body, heavy chestnut mane, cream muzzle, round ears, red infected eyes, an open snarl with ivory canines, dark claws, and a curved tufted tail.
- Proportions: oversized skull and mane, thick forelegs and paws, bent rear hocks, low forward prowling stance. Adult quadruped anatomy; no human clothing.
- Finish: smooth applied subdivision, layered volumetric mane locks, separate jaw and teeth, sculpted toes, fur ridges, raised torn skin and red wounds. No image textures or coplanar painted details.
- Back review: additional nape locks cover the smooth mane core.
- Budget: animal LOD0 is below the revised 25,000-triangle limit. Static parts are joined only within their own rigid joint.
- Rig: both quadruped and infected node names share an operative hierarchy; cap meshes remain on the retained parent and are zero-scale hidden in the GLBs.

Deliberate simplification: fur consists of broad chunky tufts and scars are clean geometric islands, preserving readability at game scale and the animal crowd budget. The reference's fine shredded fur is represented by volumes rather than individual hairs.

Reviewed views: renders/front.png, side.png, back.png, review-hero.png. Final image and backend evidence are in renders/hero.png, turnaround.png, pose-test.png, and three-* captures. GLB checks are recorded in validation.json and backend console output in browser-check.log.
