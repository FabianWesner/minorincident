# decay.broken-glass

Fifteen closed triangular glass shards, staggered heights to avoid coplanar overlap. Palette teal rather than an expensive transparent atlas; 120 triangles retained at every tier.

Dimensions (game Y up): 1.944 × 0.076 × 1.633 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- decay.broken-glass`; lossless pack: `npm run assets:pack -- decay.broken-glass`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
