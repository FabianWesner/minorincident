# prop.checkpoint-gate

Fixed motor pedestal, counterweighted 4.6 m warning-striped boom, red rotating beacon. gateArm joint origin sits at the motor pivot; boom collider follows that joint. Raise the gate by rotating gateArm about local Z in glTF (Blender Y).

Dimensions (game Y up): 4.900 × 1.470 × 0.800 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- prop.checkpoint-gate`; lossless pack: `npm run assets:pack -- prop.checkpoint-gate`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
