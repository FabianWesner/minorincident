# prop.armory-table

Four steel legs, wood top, blue servicing mat, decorative handgun silhouette, equipment case and magazine. pickupSocket accepts the existing gameplay pistol.

Dimensions (game Y up): 2.000 × 1.080 × 0.800 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- prop.armory-table`; lossless pack: `npm run assets:pack -- prop.armory-table`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
