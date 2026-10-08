# Visual review: bld.apartment-block-a

Reviewed source reference plus final game-renderer `comparison.png`, authored `lod-contact.png`, `game-reference-peer.png`, and `cutaway.png` under `test-results/l4-fairhaven-civic-buildings/bld.apartment-block-a/`.

FOV25°, azimuth45°, polar0.30π, approximately 135px and 190px; the contact sheet also covers 45/135/225/315/0° with identical framing per tier. The small view uses the production renderer's distance fog, which mutes color compared with the closer view.

The four-storey count, brick/pale trim, projecting central balcony pair and shop band remain legible in all LODs. Compared with the reference the footprint is wider/deeper in the isometric view; the side has three window columns. Compared with bld.mainstreet-brick, it has less rooftop dressing, but LOD0 masonry, facade depth and occupied window highlights now provide a comparable exterior finish.

Concrete differences / limitations: LOD1/2 omit the masonry relief; LOD2 loses mullions and most railing posts. The pale balcony slabs still separate A from B at ~135 px. The peer has richer shop lighting and props; those are outside this apartment facade brief.

All tier captures load production GLBs (no placeholder). Continuous roofs/walls, silhouette, door hinge and empties survive the authored reductions. No perforated/collapsed panels observed. Cutaway shots retain exterior body landmarks and a floor. No page or console errors in the custom capture.

Worker verdict: ready for independent asset QA. This review does not confer orchestrator acceptance. No runtime level placement, survivor behavior, power switching or W5 variants were implemented.
