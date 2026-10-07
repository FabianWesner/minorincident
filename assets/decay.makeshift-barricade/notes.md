# decay.makeshift-barricade

Sofa, crates, cross timber and inverted chair silhouette. Heavy wooden/furniture barricade.

Dimensions (game Y up): 3.279 × 1.500 × 1.682 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- decay.makeshift-barricade`; lossless pack: `npm run assets:pack -- decay.makeshift-barricade`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
