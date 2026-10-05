# Light tower production notes

Reference proportions: approximately 2.16 m × 1.20 m cabinet, 1.25 m body height,
0.72 m wheels, 4.1 m overall height. Forward is +X; four wheels and no towing
hitch match the supplied image. No visible text or brand occurs in the reference.

Identity parts: yellow bevelled cabinet, front dark mounting shield, telescopic
metal mast, two differently filled LED matrices, broad bronze/silver lamp cases,
service doors and six-slat grilles, narrow switch/socket panels, fuel filler,
rear lifting handle, rear mudguards and bumper corner protectors.

Physical panels and details have at least 8 mm separation between exposed
layers. Moving wheels, doors, mast, crossbar and lamps have joint origins.
Static meshes merge by palette; moving assemblies merge per material locally.
The light anchors use local -Z direction and refer to the emissive meshes.
The physics center of mass uses game-space coordinates in extras.

Round 1: readable silhouette; too many triangles in small bevels; palette was
washed out by AgX. Removed tread bevels and redundant moving material splits.
Round 2: reduced wheel/cylinder radial density, neutral preview color transform,
32-sample seeded Cycles AO bake, reference camera moved to the matching side.
Round 3: replaced the torus tyre with a broad closed shoulder profile, tightened
tread rows, opened the smaller lamp aim, and linked mast → lightBar → lamps.
Round 4 final QA: recalculated tyre normals, aligned measured wheel contact to
z = 0, added separate cabinet/mast/lamp colliders, and widened hero framing.

The requested standard Three.js capture command initially timed out: the
shared Vite server returns HTTP 504 for stale optimized dependency URLs.
`capture.mjs` bundles the existing `preview/glb.ts` in memory and routes only
that module to the browser; study camera distance is enlarged to fit the tall
asset. The game camera and both renderer implementations are unchanged. No
server restart or edits outside this asset directory were needed.
Final consistency check: Blender bevel helpers introduced 1-ULP differences in
unused UV coordinates across identical builds. Removed those maps from the
palette-only GLB; positions, normals, indices and AO colors were unchanged.
Light anchors' local Blender -Z maps to glTF local -Y through the axis conversion;
their transformed ground hits are 12.67 m from the heads, within the 24 m range.
