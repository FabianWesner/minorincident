1. Merged `lane/l3-route` into main-based `lane/l3-route-final`; preserved tower LOS, yellow-ring finale and texture work; no deployment or merge into main.
2. Walking route grows 296.6 → 480.6 m (+62%) via four wreck blockades and a highway; compound, four towers and guard anchors move +76 m; elevated blockers retain the minY filter.
3. Project bake tool regenerated 140 static bakes; train world registration avoids a 1.38 MB startup LOD0 fetch. Native WebGPU cold card/playable: 5.35/5.59 s versus main 8.78/8.83 s ([load evidence](load-summary.json)).
4. Typecheck, lint, build and unit 789/789 pass; focused route/finale/cover 26/26 and Chromium L3 4/4 pass; seed 1 completes in 221.2 s with zero deaths/damage ([run](complete-seed-1.json)).
5. Smoke: sim 6/6, browser 24/26 initially; unchanged audio retry passes, leaving known T-E13-05. E21 verify: 67 pass/eight existing failure names; 88.2 m quiet walk remains a pacing observation ([limits](review.md)).
6. Inspected blockade, highway, compound and tower captures: guards stand on decks, shots clear low walls and respect taller cover, footprints pass through the gate, yellow ring stays grounded ([visual review](review.md)).
