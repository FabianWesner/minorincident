# decay.boarded-windows

Window frame with four broad wood boards and raised nail heads in LOD0. No glass/roof geometry is decimated.

Dimensions (game Y up): 1.550 × 1.600 × 0.210 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- decay.boarded-windows`; lossless pack: `npm run assets:pack -- decay.boarded-windows`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
