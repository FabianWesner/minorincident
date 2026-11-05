# prop.axe-rack

Wall mounting plate, two wood handled red axes with steel cutting edges, mounting cross rails. A fixed pickup dressing assembly.

Dimensions (game Y up): 0.830 × 1.500 × 0.290 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- prop.axe-rack`; lossless pack: `npm run assets:pack -- prop.axe-rack`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
