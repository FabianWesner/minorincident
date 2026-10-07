# prop.crowd-fence

Two feet, end posts, top/bottom rails, seven infill rails (three at LOD2). 22 kg medium pushable barricade body.

Dimensions (game Y up): 2.380 × 1.125 × 0.650 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- prop.crowd-fence`; lossless pack: `npm run assets:pack -- prop.crowd-fence`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
