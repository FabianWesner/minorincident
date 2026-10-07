# decay.damaged-sign

Offset sign on a leaning support, scar stripes and a fallen plate fragment. Blank fictional hazard signage remains usable across storefronts.

Dimensions (game Y up): 1.552 × 2.025 × 0.761 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- decay.damaged-sign`; lossless pack: `npm run assets:pack -- decay.damaged-sign`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
