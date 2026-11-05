# decay.collapsed-facade: asset vision review

Inspected the reference-plus-LOD sheet, all five orientations at each tier, turntable comparison, and game-reference-peer sheet at 90/135/190 px. Game renderer: headless Chromium, Metal WebGL2, FOV 25 degrees, azimuth 45 degrees, polar 0.30 pi. Independent orchestrator acceptance is pending.

The model has two genuinely open wall bays, tall broken piers, a stepped jagged wall crown, exposed slab, snapped posts/joists, soot and a large fallen facade piece. Its broken silhouette remains visible at 90 px in LOD2. Compared with the integrated burned-brick peer, the taller pale ruined masonry and fallen wall piece give a distinct collapse read.

## Checklist C / E

- **PASS — recognizable at game scale:** the major asset silhouette and identity landmarks survive at all three distances and tiers.
- **PASS — main part layout:** base-derived buildings preserve their original proportions, ground footprint, sockets and moving pivots; facade dressing has the required slab, broken wall edge and fallen piece.
- **PASS — material separation:** palette regions distinguish remaining masonry, dusty stone, charred structure and black glazing; no texture atlas or external material is introduced.
- **PASS — decay is obviously worse:** broad silhouette loss and rubble, plus blackened windows, distinguish the building variants from intact peers; dressing reads as an already collapsed wall.
- **PASS — varied damage:** missing structural sections, glass teeth, soot/impacts and separate fallen pieces provide several forms of damage, with detail reduced explicitly at distance.
- **PASS — budget and silhouette:** closed solids remain continuous at distance and measured asset primitives stay within triangle and draw caps.
- **PASS — fictional identity:** inherited signage uses Fairhaven/Kessler and other existing fictional shop labels.

## Concrete limitations / refinements

The reference has denser rubble, individual masonry chips and softer surface variations. This model is more geometric; LOD2 removes loose rubble and thin joists to retain the major wall/fallen-piece silhouette within 196 triangles. Standard side-view coverage is 8.09% / 7.91%, below the turntable tool's 10% threshold; full contact sheets and properly framed game-scale comparison are retained.

The facade crown was refined to a stepped fracture edge, with pier soot and shallow bevels on the main piers and slab; fewer loose pieces keep LOD0 under its cap. No generic decimation was used. Lighting is the asset viewer's shared daylight rig; sunset/fire mood and district dressing belong to the runtime lane.

## Evidence

- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/reference-lod-contact.jpg`
- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/lod-contact.png`
- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/comparison.png`
- `test-results/l5-fairhaven-commerce-w5/decay.collapsed-facade/game-reference-peer.jpg`
