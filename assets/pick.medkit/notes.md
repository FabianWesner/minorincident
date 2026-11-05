# Medkit construction

Upright red case; approximately 0.266 × 0.750 × 0.731 m, +X broad front, Z up. The case outline, closure seam, corner guards, clasps, orange grip and raised white cross are retained.

Performance revision: single-segment bevels and eight-sided pins reduce LOD0 from 9,272 to 2,104 triangles. Pins share pal_uiDark; the former body_pal_sidewalk name survives as an empty anchor, keeping all 12 node names. Body, hinged lid and carry handle remain separate. Static geometry is joined by material in each assembly, for six draws.

Calling build.py with --glb automatically regenerates LOD1 and LOD2 from LOD0 at decimation ratios .65 and .40. Exports contain 1,362 and 836 triangles, respectively, and preserve nodes and AO. No image textures. Cross is one extruded shape, standing 3 mm clear of the shell.
