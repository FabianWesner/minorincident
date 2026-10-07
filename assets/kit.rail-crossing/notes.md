# Rail crossing build

Reference composition: square earth/ballast tile, road along +X, railway along Y, two roadside masts behind the track. Tile 7.4 × 7.1 m; road 4.3 m wide; rail centers 1.56 m apart; masts 3.74 m tall. Ground at Z=0.

Purposeful details: sleeper chairs and fasteners, rail crowns/webs/feet and flange channels, segmented pavement and road markings, roadside ballast and grass, cast pedestal ribs, service cabinets and locks, gate hinge bosses, diagonal raised bands, marker lamps, twin hooded signals, crossbuck boards with raised lettering, red mast beacons.

Gate origins are the hinge centers; rotation about local X opens them. Signal and beacon assemblies remain named and separate. Static geometry is merged by palette material. All decals are physical solids proud of their substrate by at least 3 mm. Deterministic seed 26. Texture-free Principled materials. Shared sslib AO baker writes vertex AO; Authored coarse LODs are regenerated on every GLB export.

Final exports after QA: LOD0 18,906 triangles, LOD1 2,568, LOD2 620; 28 total draw calls. Silver uses 0.18 metallic for readable poles in the Three.js environment. Baked AO is remapped to 0.4–1.0 for soft contact shading.

## Orchestrator railway readability correction
Track extended to 10.68 m along Y, about 3.2 m beyond each 4.3 m road edge. Exposed sleepers are dark timber with warm top plates and steel rail chairs. Rails use a wider foot/web/head profile; redundant bright guard rails were removed. Gray aggregate and a continuous ballast bed distinguish the railway from the soil. A separate timber plank deck fills the crossing between the rails and outer approach margins. Both authored LODs retain the same extended track/deck silhouette. Track extension foundation boxes meet the central tile without overlapping coplanar faces.

## Art registration (2026-10-07)

Measured delivered bounds (X/Y/Z, metres): 7.4269, 3.7377, 10.8. Source, named pivots/sockets, palette, front marker and delivered tiers are validated by the production validator. Runtime status is integrated. Five-angle LOD contact evidence: `test-results/art-register/kit.rail-crossing/lod-contact.png`.
