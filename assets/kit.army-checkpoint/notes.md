# kit.army-checkpoint

Two lines of three concrete T walls leave a clear center lane; authored razor-wire coils/barbs, two sandbag nests, wood watchtower/ladder, loudspeaker pole and two floodlight poles. Fixed compound colliders preserve the central passage.

Dimensions (game Y up): 11.575 × 5.890 × 9.800 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- kit.army-checkpoint`; lossless pack: `npm run assets:pack -- kit.army-checkpoint`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
