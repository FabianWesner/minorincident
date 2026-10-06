# Civilian man A

Measured target: 1.4 m, head and hair approximately 0.36 m. Relaxed adult stance; +X forward, -Y right. Teal polo, tan cargo khakis, dark belt, left watch and teal/white lace sneakers. Hair consists of overlapping swept volumes.

Geometry is deterministic and rigid, with applied subdivision. Required joint empties carry static meshes consolidated per material. Skin, brown hair, khaki and teal cloth extend the starter palette using pal_* tokens, matching the reference. No images or branded marks.

Review rounds:
1. Built full character, 56,049 triangles; corrected torso/leg balance after first render. Both runtime backends loaded without errors.
2. Inspected four views, 55,991 triangles; refined open finger tips, hair nape and crown silhouette, rectangular buckle, cloth width and removed overly raised fold strips.
3. Final hero and four-view batch, followed by articulated pose and final GLB audit.

Render commands use experiment/tools/blender_run.py with the shared GPU pool. --deliverables renders the requested hero, four neutral views, and the pose test in one run. Export happens in the neutral pose before any review articulation.

Final numeric cleanup uses direct triangle cross products, eliminating export-collapsed bevel slivers without changing the visible silhouette. The exported height is 1.4317 m and ground contact is within floating-point tolerance of zero.

## M1 crown coverage (2026-10-06)

Corrected inward cap winding; retained the continuous scalp beneath the locks and increased distant-tier clearance to prevent rear skin slivers. Joint pivots, attachment sockets and rig hierarchy are retained. LOD0/1/2: 55,554 / 6,774 / 1,824 triangles. Distant geometry omits fine trim and retains coarse geometry for every required source contract node.

Rebuild hero through `experiment/tools/blender_run.py` with `--glb assets/npc.civilian-man-a/model.glb`, then `npm run assets:pack -- npc.civilian-man-a`. For authored LOD2, build with `--lod2 --glb .cache/m1-art/man-lod2.glb`, then run `npx tsx assets/char.survivor-female/pack-lod2.ts` after building all three edited humanoids. Do not use `--regenerate` after producing the authored tiers. Delivery-driver crowd geometry is rebaked from LOD1.

Regression: `npx tsx assets/char.survivor-female/scalp-regression.ts` casts exterior, backface-culling crown and rear rays against all 15 L1 humanoids and all three tiers. Before: exposed crowns on female survivor, civilian-man-a and delivery-driver. After: all 45 tier checks pass. Other audited humanoids needed no source edits. Desktop/iPhone game-camera and rear-view renders are reviewed then deleted.
