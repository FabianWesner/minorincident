# wpn.halligan

Solid steel shaft, transverse adze, diagonal pick and two separated fork tines; grip and tip empties. No atlas.

Dimensions (game Y up): 0.381 × 0.933 × 0.120 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- wpn.halligan`; lossless pack: `npm run assets:pack -- wpn.halligan`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
