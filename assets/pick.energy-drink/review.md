# Review — three rounds

1. Shell proportions, open pull tab and oversized lightning bolt blocked out;
   reference and game renders revealed shoulder blue edges and a pale studio floor.
2. Metal shoulder covers the shell seam, subtle shell facets and darker studio
   floor added. Curved label subdivision seams were identified.
3. Label triangles welded before solidification, smooth label normals, label
   angled 20 degrees toward gameplay view. Final hero: 1600×900, 96 samples;
   final game: 960×540, 24 samples. All Blender rendering used blender_run.py.

GLB checked directly after slimming: 1682 triangles, five mesh primitives/materials, root/body
and cylinder collider nodes, physics extras, no image textures. All static
geometry joined by material; no animated parts are required for this pickup.

WebGPU and WebGL2 study/rear/game captures checked. Both have zero console
errors and two successive game-camera screenshots are byte-identical: no
visible flicker. Capture runner uses an isolated Playwright dependency and a
loader shim under .capture/. The existing server returns 404 for /@vite/client;
the shim supplies an empty JavaScript HMR module for that URL only. Asset loading
and renderer errors remain visible. Commands and results are retained locally.

Known reference deviation: the canonical policeBlue palette replaces violet.
Warm metallic sidewalk/picketWhite and schoolBusYellow preserve the reference
identity within the permitted palette. Final model passes the Side budget.

## Pickup performance revision

LOD0: 1682 triangles (82.3% fewer), five draw calls, 84,204 bytes.
LOD1: 1198 triangles; LOD2: 906 triangles; both five draws. All eight node names
are retained across the three GLBs. Hero and game Blender renders refreshed.
The tall silhouette, metal rims, open pull tab and raised lightning badge remain
readable. LOD0 and LOD2 pass WebGPU/WebGL2 capture checks; successive LOD0 game
frames are identical. Pickup-specific cap is 2500 triangles / six draws.
No manifest registration was performed.
