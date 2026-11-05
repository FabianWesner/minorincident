# Production review

Verdict: passes the Hero asset production contract after four review rounds.

Reference and game-camera renders preserve the long black hood and trunk, white four-door cabin, raised POLICE markings, gold-and-blue shields, black vented wheels, front push bar, spotlight and segmented red/blue lightbar. Purposeful detail includes wheel tread/lugs, lamp flutes, grille lattice, handles, wipers, mirrors, antenna, plates and interior seating. The cabin curvature and ornamental badge engravings remain simplified; glass follows the global palette tint.

LOD0: 73,209 exported triangles, 39 total material primitives (including every animated assembly), 9 materials. LOD1: 10,329 triangles. LOD2: 2,707 triangles. All three exports preserve required nodes and joint origins, contain vertex AO and zero image textures, and have zero nonfinite positions and zero degenerate triangles. LOD0 ground contact is exactly 0; overall dimensions in game coordinates are approximately 5.437 × 1.930 × 2.320 metres. Geometry bounds are centered within 3 mm on X and exactly on Z.

The prescribed capture_glb.mjs command succeeded against the shared server on WebGPU and WebGL2, with errors=[] for both. Study views from both ends and the game view are saved. Four consecutive game-camera frames on each backend have identical pixel hashes and empty console-error lists; no livery flicker is visible. The stability harness intercepts local resources in memory to avoid unrelated shared-server restarts, while running the existing viewer code unchanged.

A second Blender rebuild has the same canonical geometry hash, including material assignments, at 1 micrometre coordinate precision. Exporter buffer ordering is not used as the geometry identity. See renders/determinism.json, renders/frame-stability.json, renders/backend-log.jsonl and audit.json for evidence.

The final source was simplified by removing unused material/cutter options, retaining only the primitive helpers needed by this asset, and keeping one material-merge loop per rigid assembly.
