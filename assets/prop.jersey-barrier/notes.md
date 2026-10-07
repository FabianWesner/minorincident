# prop.jersey-barrier

Closed extruded eight-point concrete profile with broad foot, sloping shoulder and narrow top; three raised reflectors at LOD0/1. 650 kg heavy physics body.

Dimensions (game Y up): 3.000 × 0.950 × 0.720 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- prop.jersey-barrier`; lossless pack: `npm run assets:pack -- prop.jersey-barrier`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
