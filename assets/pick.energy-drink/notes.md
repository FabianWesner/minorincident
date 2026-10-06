# Energy drink can

Tall can: 0.152 m diameter, 0.354 m total height. Grounded at Z=0,
label faces +X. Reference identity: blue-violet shell, yellow lightning
bolt, warm reflective rolled rims, recessed silver lid and open ring tab.
No text or real brand is present in the reference.

Canonical policeBlue is used because the palette has no violet token.
Metal uses sidewalk and picketWhite, with scalar metallic/roughness.
Markings are solid curved geometry at radius 0.080 m versus shell 0.075 m;
no textures. Static parts join by material under body. Pull tab is static
because the pickup has no opening animation. Cylinder collider and light
physics extras describe the filled can. AO is baked into vertex colors.

Performance revision: pickup-specific LOD0 cap is 2,500 triangles / six draws.
Cylinder segment counts are 24/16/12 for LOD0/1/2; tab counts 16/12/8.
Redundant shell rings and the lid score were removed. The lightning badge uses
only two subdivisions per edge at every LOD to preserve clearance from the shell.
Build lower exports with --lod 1/2 and --glb model.lod1.glb/model.lod2.glb.
