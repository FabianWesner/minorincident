# bld.dugout — accepted small-structure QA

Two optimization review rounds reduce LOD0 from 70,088 to 19,708 triangles
(72% reduction), satisfying the revised 20,000-triangle cap. The roof silhouette,
bench, masonry courses, signage, diamond fence and equipment remain readable.
Plants are purposefully simplified into a few low-poly clumps.

Hero re-rendered at 1600 × 900, 96 samples; game render refreshed at 960 × 540,
24 samples. Reference, hero and game views visually reviewed. Lettering/signs
remain offset from backing surfaces; no visible coplanar flicker in game views.

Authored LOD1: 2,216 triangles / 11 draws. Authored LOD2: 520 / 9 draws.
Both keep a solid roof/wall/bench/fence silhouette; LOD1 retains full lettering.
All three GLBs pass WebGPU and WebGL2 captures with zero console errors.
Binary audits confirm finite vertex data, no image textures, required named
nodes with populated cutaway groups, and geometry/draw-call budgets.
Verification details: verification.json and renders/*-check.jsonl.
