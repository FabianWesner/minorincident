# Civic-center production review

Verdict: PASS, Hero, four visual review rounds.

1. Initial masonry / signage / roof build. Ref review identified the overly narrow facade view and budget excess.
2. Broader front view, larger pavement, tower brickwork and detailed utilities. Both Three.js backends loaded successfully; review identified blocky sandbags and an entrance panel depth artifact.
3. Reduced text curve detail and small bevels, preserved exterior brick bevels while removing concealed ones, replaced sacks with rounded pillow geometry, increased door-panel separation. Final GLB: 84,460 triangles and 39 draw calls. Both backend captures have empty error lists. Entrance artifacts disappeared.
4. Final camera margin review; hero rendered at 1600×900 / 96 samples, game at 960×540 / 24 samples.

Checklist C: recognizable civic safe zone at the game camera; two banners and sandbag barricades flank a central double-door entrance; clock pediment, brick facade, cream pilasters, framed gym windows, roof access tower, fans and ventilation grilles match the reference part layout. Warm brick / cream stone / blue fabric / glowing glazing material separation is clear. Rear and opposite side are consistently inferred. The name is Sunset Grove; no real brands. Side panels, signage and letters have deliberate physical depth separation. Final WebGPU and WebGL2 study and game captures show no visible surface interference.

Required root / roof / interior and hinged door nodes are present in all three GLBs. Lanterns have mounting pivots and light anchors. Static walls have collider empties. Static geometry joins by material within roof / interior visibility groups. Deterministic vertex AO, palette materials only, no textures. LOD1: 8,261 triangles (~9.8%); LOD2: 2,855 triangles (~3.4%). Build simplification replaced repeated Blender cube operators with direct bevelled mesh construction and removed redundant ornament geometry.

Evidence: `renders/hero.png`, `renders/game.png`, `renders/three-*`, `three-validation.jsonl`, `validation.json`, `lod-stats.json`, `report.json`.
