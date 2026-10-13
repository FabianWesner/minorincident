# wpn.minigun-mounted

Mounted rotary minigun on a sandbag ring with a pivot column, shield plate and ammo drum. Nodes: `pivot` (yaw), `elevation` (pitch about Y, child of pivot), `barrels` (spins about +X, child of elevation, six barrels with three clamps), `heatGlow` (emissive orange sleeves around the barrel muzzle ends, child of barrels; the runtime hides it when cool and shows or scales it while overheating). Sockets: `muzzle`, `seatAnchor`/`gunnerSocket` (stand behind the mount, on the duckboard), `heatGlowSlot`, `front`. The ring is open to the rear (-X).

Dimensions (game Y up): 2.8 x 1.76 x 2.7 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 2524 / 1228 / 604 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 3500 / 1500 / 800).

Rebuild/publish: `npm run assets:build -- wpn.minigun-mounted`. Registry status: integrated; independent asset QA and level placement pending.
