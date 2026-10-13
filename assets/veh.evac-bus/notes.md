# veh.evac-bus

Hero evacuation coach, 9.38 x 3.055 x 2.95 m (mirrors included), cream body with a blue belt stripe. Blender frame: +X front, +Y door side (`doorR`), Z up, ground z = 0.

Built by `tools/blender/sslib/evac_bus.py` (called from `build.py`; `npm run assets:build -- veh.evac-bus [--decay wrecked|burned]`). Every part is a closed solid, trim sits at least 8 mm off the surface it decorates (no coplanar faces: `tools/assets/zfight.ts` fails the validator otherwise). LOD1/LOD2 are the same recipe with fewer arc segments and fittings, not decimation.

- Shell: lofted lower body with real wheel arches (boolean), interior pocket (floor 1.14 m), stair well and entry opening; rounded roof loft with raked windshield header; dark sill and window surrounds.
- Glass: `pal_backpackTeal` with alpha .18 (BLEND), six panes per side, wrap-around windshield, rear window, door glass; 24 navy/cream seats, driver chair, dash and steering wheel behind it.
- Details: EVAC destination sign (emissive letters under `signEvac`, flagged `decorativeEmissive`), EVAC side lettering, bumpers, grille, headlights, tail lights, rear louvres, plates, mirrors, roof AC pod and vents, wheel arch lips.
- Contract: `root`, `body`, `wheelFL/FR/RL/RR` (pivots at the axles, tyre + rim), `doorR` (hinge at the front edge of the entry, two folding leaves), `lightsFront` / `lightsBrake` with `light:*` anchors, sockets `driverSeat`, `steeringWheel`, `exitL`, `exitR`, `seat_1..seat_12`, `front`, collider `col:body`.
- Triangles LOD0/1/2: 11,316 / 4,494 / 1,904 (caps 15,000 / 6,000 / 2,000), 10 materials, 22 draw calls.
- Variants: `wrecked` (crumpled front, shattered glass shards, opened door) and `burned` (charred shell, removed glazing, sagging roof) are derived from the LOD1/LOD2 meshes by `traffic_wrecks.py` / `burned_vehicles.py`; the manifest lists `decayNodes` without the door animation.
- Interior AO is lifted (`rescue_assets.finish`) so seats read through the glass at dusk.
