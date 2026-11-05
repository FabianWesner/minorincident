# Production review

Five build/render review rounds completed against reference-upscaled.png, with a reference and a game view in each round. The final kit has a readable S-curve, broad elevated middle span, three visible concrete piers, segmented bevelled Jersey barriers and fascia, yellow edge lines, broken white center markings, three framed amber lanterns, and a cross-braced green SUNSET GROVE EXIT gantry with raised lettering/arrow.

The main corrections were exposing the piers, reversing the S-curve direction, reducing repeated bolt bevels, and removing hidden roadway/deck faces. The far Three.js game camera exposed depth fighting that the Blender study render did not: paint now occupies disjoint road bands, shallow pavement overlays became real expansion joints, and the sign has deeper raised relief. The final moving-camera captures no longer show the earlier radial road artifacts.

Geometry passes the local audit: LOD0 34,236 triangles / 13 draw calls, LOD1 4,063 (11.9%), LOD2 1,009 (2.95%). All three contain baked vertex AO, no image textures, no nonfinite positions, no invalid indices and no degenerate triangles. Required root, independently controlled lamp heads, three light anchors with palette tokens, and 19 collider anchors are exported. The lowest LOD uses 11 draw calls. Static geometry is merged by material; each lamp-head pivot remains at its center.

The supplied capture tool loaded the final LOD0 on WebGPU and WebGL2 without console errors or warnings. The supplemental checker loaded all three LODs on both backends without console errors; all six checks recorded zero changed pixels across stationary game-camera frames. Small azimuth offsets were inspected for depth artifacts. Backend captures and audit JSON are retained alongside the renders.

The main deliberate reference deviation is lighter road weathering: shallow colored asphalt patches and hairline overlays were removed in favor of physical expansion joints for stable distant rendering. The sign uses the shared backpackTeal palette rather than introducing a custom highway-green material. No reference files, repository specs, preview tooling, or unrelated assets were edited.
