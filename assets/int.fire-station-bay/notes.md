# int.fire-station-bay

12 × 10 m cutaway bay; clear central parking aisle and 6 m aperture for the 7.4 m fire engine. Six lockers with handles/vents, radio desk and antenna, sink/counter/fridge, two benches, rotating red beacons. Empty truckParking and radioSocket anchors; separate floor and wall collider empties.

Dimensions (game Y up): 12.000 × 4.300 × 10.000 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/rescue_assets.py`; shared palette, no textures, deterministic Cycles vertex AO. References reviewed read-only: `initial-drafts/interiors.png`, `town-edge-bridge-rail-and-power.png`, `wrecked-and-burned-vehicles.png`. Explicit solid primitives at each LOD; fewer fittings/radial sides at distance, no triangle collapse. Interior AO contrast is bounded to retain floor readability.

Rebuild/publish: `npm run assets:build -- int.fire-station-bay`; lossless pack: `npm run assets:pack -- int.fire-station-bay`. The script also refreshes all three source tiers. Registry/preview status: integrated; independent Opus QA and level placement pending.
