# Visual review: bld.apartment-block-b

Reviewed source reference plus final game-renderer `comparison.png`, authored `lod-contact.png`, `game-reference-peer.png`, and `cutaway.png` under `test-results/l4-fairhaven-civic-buildings/bld.apartment-block-b/`.

FOV25°, azimuth45°, polar0.30π, approximately 135px and 190px; the contact sheet also covers 45/135/225/315/0° with identical framing per tier. The small view uses the production renderer's distance fog, which mutes color compared with the closer view.

Five storeys, cream walls, teal parapet/shop trim and outer recessed balcony columns read distinctly from A at both tested sizes. Piers and slab ceilings sit ahead of the window plane. The reference has deeper shaded loggias and warmer furnished shop interiors. bld.mainstreet-brick is more decorated, while this block uses the reference's cleaner large stucco regions.

Concrete differences / limitations: LOD2 drops window crossbars and thin balcony return rails, using closed frame rings and two front posts. Recessed balcony bays remain open rather than becoming perforated panels. Roof hiding removes HVAC and its grille. Shop interiors are not furnished.

All tier captures load production GLBs (no placeholder). Continuous roofs/walls, silhouette, door hinge and empties survive the authored reductions. No perforated/collapsed panels observed. Cutaway shots retain exterior body landmarks and a floor. No page or console errors in the custom capture.

Worker verdict: ready for independent asset QA. This review does not confer orchestrator acceptance. No runtime level placement, survivor behavior, power switching or W5 variants were implemented.
