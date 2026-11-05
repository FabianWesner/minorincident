# Bandage pickup — slim ground-pickup version
The hollow peach roll, broad center wrap, foreground three-panel folded strip, and secondary folded bundle preserve the reference silhouette. No label or brand appears in the reference.

LOD0 budget: ≤2,500 triangles and ≤6 draw calls. Model uses a 20-segment roll, two winding ridges per end, compact chamfered folded panels, and sparse six-sided perforation markings. Boolean holes, individual wound layers, and raised torus rims have been removed. Markings stand 4 mm above their support faces. Geometry is joined into five palette meshes.

`build.py --lod 0|1|2` regenerates all tiers. Lower LODs use 12/8-segment rolls, one winding ridge per end, simpler panel corners, and no perforation markings. All tiers preserve `root`, `body`, `front`, and the four `static_pal_*` mesh names, metre scale, +X forward, and z=0 contact. Approximate footprint remains 0.763 × 1.022 m and height 0.639 m.

Manifest registration is handled centrally; this job changes only assets/pick.bandages.
