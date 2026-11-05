# int.metro-exit self-review

Verdict: PASS
Comparison: test-results/l6-metro-and-shelter-kit/int.metro-exit/comparison.png

This is lane self-review; orchestrator acceptance is independent. Reference, four sides, fixed game camera and all authored tiers inspected visually. Game-scale sheet: `test-results/l6-metro-and-shelter-kit/int.metro-exit/game-reference-peer.png`; LOD sheet with source reference: `test-results/l6-metro-and-shelter-kit/int.metro-exit/lod-contact.png`. All image widths <=1600 px. No placeholder loading or browser page errors in captures.

- [must] Visual read: PASS — The yellow platform edge, two climbing routes and heavy dark gate read at 135 and 190 px. The escalator is the flight with thick teal skirts, dark continuous handrails and rounded newel returns; the adjacent stone stair has thin baluster rails. Reoriented toward +X after the first camera review, raised the gate to 2 m, and mounted the exit lamps on the cheek walls.
- [must] Authored tiers: PASS — Closed recipes retain required silhouette, openings and relevant parts; no generic decimation. LOD0/1/2 shown with matching framing from 45/135/225/315/0 degrees.
- [must] Delivery budget: PASS — Actual manifest caps enforced; all three tiers <=8 total primitive draws including animated gate and emissives, <=8 palette materials, compressed meshopt/quantized GLBs.
- [must] Coordinates/contracts: PASS — Metres, ground Y=0, front marker +X, exact measured AABB through tiers, semantic/pivot/light/mount/brace nodes retained and collider empties with fixed ss_physics.
- [should] Reference/peer comparison: PASS — Integrated peer `bld.metro-entrance` at the same 135/190 px maximum extent and fixed FOV25/azimuth45/polar54 camera. Both share warm stone, dark ironwork, geometry signage and toy scale. The entrance peer has more canopy and masonry trim; this exit has larger flat retaining surfaces. The model has separate stairs as required by E24, while the reference focuses on a single escalator.
- [should] Distance readability: PASS — Primary cues remain in LOD2; smaller radial sides/omitted details remain intentional differences. No holes from collapsed panels or missing roof/glass/door borders.

Concrete remaining limitations: LOD2 omits NORTHGATE lettering and small tactile ridges; the gate and yellow platform edge remain. Retaining walls are plainer than the textured reference; no photo texture was added.

Initial faults fixed before delivery are stated above. No remaining P0/P1 found in lane asset review. No claim of full E24 district/mission acceptance: station fit, layout, NPC routines, sounds, gate runtime and light switching remain with their lanes. `int.metro-station` was absent from the starting merged main, so attachment to that asset is not independently verified here.
