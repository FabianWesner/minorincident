# decay.looted-store

Two empty three-tier shelving units with exposed uprights and deterministic merchandise scatter. Compose inside an existing storefront.

Dimensions (game Y up): 2.000 × 2.000 × 1.780 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- decay.looted-store`; lossless pack: `npm run assets:pack -- decay.looted-store`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
