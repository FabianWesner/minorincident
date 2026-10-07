# veh.evac-bus

9.35 m cream/blue coach, rear/front glazing, six occupied windows per side with seated adult silhouettes, solid body pillars and roof, EVAC geometry lettering, mirrors and bumpers, four wheel pivots, hinged doorR, driverSeat/exitL/exitR and twelve seat sockets. Head/brake light anchors.

Dimensions (game Y up): 9.355 × 3.055 × 2.960 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- veh.evac-bus`; lossless pack: `npm run assets:pack -- veh.evac-bus`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
