# decay.dropped-belongings

Red suitcase and handle/straps, teal backpack with front pocket, folded blanket and fallen bottle. Light physics dressing.

Dimensions (game Y up): 1.570 × 0.460 × 1.052 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- decay.dropped-belongings`; lossless pack: `npm run assets:pack -- decay.dropped-belongings`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
