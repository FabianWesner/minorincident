# bld.metro-entrance.w5: asset vision review

Inspected the reference-plus-LOD sheet, all five orientations at each tier, turntable comparison, and game-reference-peer sheet at 90/135/190 px. Game renderer: headless Chromium, Metal WebGL2, FOV 25 degrees, azimuth 45 degrees, polar 0.30 pi. Independent orchestrator acceptance is pending.

The stairs, green rails, sign housing and separate sliding shutter retain the same positions as the base. A large section of the canopy, gable and a post top are removed; exposed bent rafters and side-ledge debris read as collapse. The entrance remains open and the missing canopy is obvious beside the intact peer at 90/135/190 px in all tiers.

## Checklist C / E

- **PASS — recognizable at game scale:** the major asset silhouette and identity landmarks survive at all three distances and tiers.
- **PASS — main part layout:** base-derived buildings preserve their original proportions, ground footprint, sockets and moving pivots; facade dressing has the required slab, broken wall edge and fallen piece.
- **PASS — material separation:** palette regions distinguish remaining masonry, dusty stone, charred structure and black glazing; no texture atlas or external material is introduced.
- **PASS — decay is obviously worse:** broad silhouette loss and rubble, plus blackened windows, distinguish the building variants from intact peers; dressing reads as an already collapsed wall.
- **PASS — varied damage:** missing structural sections, glass teeth, soot/impacts and separate fallen pieces provide several forms of damage, with detail reduced explicitly at distance.
- **PASS — budget and silhouette:** closed solids remain continuous at distance and measured asset primitives stay within triangle and draw caps.
- **PASS — fictional identity:** inherited signage uses Fairhaven/Kessler and other existing fictional shop labels.

## Concrete limitations / refinements

The integrated base has no side glazing, so this variant has no broken glass enclosure. It is more heavily collapsed than the flat-canopy reference and keeps the base gabled architecture. The right canopy half remains intact. Outdoor fixture anchors are dark; the runtime lane supplies shelter cues.

The initial clean brick-colored collapse cut was changed to charred cut faces with jagged fracture points before this review. No generic decimation was used. Lighting is the asset viewer's shared daylight rig; sunset/fire mood and district dressing belong to the runtime lane.

## Evidence

- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/reference-lod-contact.jpg`
- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/lod-contact.png`
- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/comparison.png`
- `test-results/l5-fairhaven-commerce-w5/bld.metro-entrance.w5/game-reference-peer.jpg`
