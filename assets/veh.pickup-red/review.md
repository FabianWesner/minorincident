# Production review — veh.pickup-red

Four paired 960×540 / 24-sample comparison rounds completed. Final hero is
1600×900 / 96 samples. The model retains the red/ivory single-cab silhouette,
open red ribbed bed, squared wheel openings, chunky tread, perforated steel rims,
three-bar grille, diamond emblem, rectangular warm lamps, mirrors, handles,
plate, wipers and roof stamps. Fictional tailgate lettering: SUNSET GROVE.

LOD0: 73,795 triangles / 37 material primitives. LOD1: 9,706 triangles.
LOD2: 3,664 triangles. Static parts are merged by palette material; separate
wheel, door, tailgate and lamp assemblies retain joint origins. Both sides and
the rear are finished. Light meshes have anchors; the root has physics extras
and a non-mesh collider. All variants are centered and grounded.

The 32-sample deterministic Cycles AO bake is stored as `ao`, exported directly
to COLOR_0 and softened to preserve the warm palette on broad stamped panels.
No image textures. Signs/plates/emblems/trim have solid geometry and deliberate
clearance; game-camera temporal capture pairs are compared pixel-for-pixel.

The standard repository Three.js viewer is authoritative. Earlier Vite stale
optimization failures were resolved by the existing server restart; no viewer
or server source was changed for this asset. Final capture results are recorded
in browser-check.json and flicker-check.json.

Remaining aesthetic simplifications: fine reference surface wear and optical
lens refraction. Clean stylized finish is intentional. No real brand names.
