# Blue sedan

Reference: compact 1980s-style four-door silhouette, short trunk, rectangular warm headlamps, horizontal grille, gray bumpers and six-slot wheel covers. No brand emblems or registration lettering are present in the reference; plates remain blank.

Dimensions: approximately 4.54 m including exhaust and bumpers, 2.16 m including mirrors, 1.68 m high. Wheelbase 2.70 m, wheel diameter 0.83 m. Blender +X forward, +Z up, tire bottoms at zero.

The build uses hollow cabin glazing with seats, dashboard, steering wheel and rearview mirror. Four doors are grouped at their leading hinges; wheel groups originate at axle centers. Lamps are independent front/brake assemblies with semantic light anchors. Static geometry is joined by material, with raised panel and trim geometry. No image textures, real brand names or external model dependencies.

Reproduction uses experiment/tools/blender_run.py with this build.py. Default is LOD0; --lod 1 and --lod 2 produce deterministic decimated distance exports. Export includes baked vertex AO and physics/light extras. Review renders are deliberately separate from exported asset geometry.

Rounds: 1 complete body and parts; 2 reduce draw calls and soften paint; 3 refine glazing, moulding and bake AO; 4 replace gasket slabs with hollow frames to reveal the interior. Final renders follow round 4.
