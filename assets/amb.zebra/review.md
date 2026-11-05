Verdict: PASS
Comparison: test-results/epics/E07/zebra/after-lod-comparison.png
Source reference: unchanged zoo concept S23, reproduced in the comparison header. The sheet renders normal/infected zebra, existing inf.lion and inf.gorilla at the same 16 m game-angle camera for all three LODs; inspected with the image viewer on 2026-10-11.

- [must] Gameplay recognition: PASS — stripes, upright ears, long face, mane, hocks and hooves retain an equine zebra silhouette in all tiers.
- [must] Main part layout: PASS — rounded barrel, sloping neck, four long legs, muzzle and tufted tail agree with the concept; both skins share the exact exported surfaces and rigid hierarchy.
- [must] Material separation: PASS — cream/dark coat stripes are integral face regions, dark hooves/muzzle/mane separate cleanly; the normal model has no emissive eyes or world health bar.
- [must] No brands: PASS — no labels, logos or trademarks; this is animal anatomy.
- [should] Hidden sides: PASS — closed ring surfaces wrap the whole body, legs and ears, with no flat fins, open shells, decimation holes or decal panels.
- [should] Gameplay faceting: PASS — authored LOD0/1 remain rounded at the game distance; LOD2 deliberately widens the stripes and has a coarse but solid readable silhouette within 700 triangles.

Shared rear-kick and stampede pose sheets inspected: the four rigid legs stay connected, rear kick extends backward rather than forward, and both skins retain matching proportions at every LOD. Pose assets are not evidence of sim move effects/cooldowns.
Scene Lab reuses D-ZOO player-start/safe-point anchors; the normal animal rests on the ground as a prop with no bar. No prop penetration, clipping or invisible-but-active frames in the isolated captures.
