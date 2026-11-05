# Sunset Grove Courier long-john bicycle

Two wheels only: small front wheel beneath the front of the orange cargo tub, normal rear wheel. The bottom bracket has a filled gear of radius 0.06 m with small teeth, not an open ring. The frame, teal courier panels, cream lettering and rear rack retain the existing palette and approximately 2.8 × 1.2 × 0.76 m envelope.

Blender: **+X forward, +Z up, +Y left**. Exported glTF/game: **+X forward, +Y up, +Z right**. Wheels and crank rotate about game `rotation.z`; handlebar steering is `rotation.y`. Pivots have unit scale and identity rotation at rest. `seat` is a root-level empty, so BicycleView can read its `position.x` directly. The separate `saddle_mount` owns the saddle mesh.

World positions in exported GLB metres (before the game's 0.6 scale):

| Node | X | Y | Z |
| --- | ---: | ---: | ---: |
| wheel_front | 1.035 | 0.335 | 0 |
| wheel_rear | -0.940 | 0.405 | 0 |
| handlebar | -0.075 | 1.065 | 0 |
| grip_l | -0.230 | 1.175 | -0.290 |
| grip_r | -0.230 | 1.175 | 0.290 |
| seat | -0.650 | 1.160 | 0 |
| crank | -0.470 | 0.300 | 0 |
| pedal_l | -0.390 | 0.220 | -0.180 |
| pedal_r | -0.550 | 0.380 | 0.180 |
| cargo_box | 0.530 | 0.370 | 0 |
| box_lid_top | 0.530 | 0.890 | 0 |
| kickstand | -0.100 | 0.320 | 0 |

`grip_l/r`, `seat` and `box_lid_top` are mesh-free attachment empties. Grips are children of the handlebar; pedals are children of the crank, with pedal origins at their spindles. Wheels have hub origins. The handlebar origin lies on its vertical steering axis, connected to the front fork by the linkage beneath the tub.

`kickstand` owns all stand geometry, with its origin at the mount. Default is deployed (`rotation.z = 0`); game riding pose is `rotation.z = Math.PI / 2`, which raises both feet clear of the road. BicycleView now retracts it when mounted and deploys it on dismount. The source also exports these angles as node extras. Legacy `wheelF/R`, `pedalL/R`, and `basket` names are empty aliases, without duplicated geometry. Updated BicycleView uses the canonical names.

At scale 0.6 the saddle top is 0.696 m high. Its front edge is approximately 0.28 m behind the box's rear edge. The hand sockets are 0.252 m forward of the saddle centre. BicycleView shifts the saddle under the rider's hips using the seat X coordinate; the parcel uses the explicit lid socket.

## Rebuild and review

Run from the worktree root. Use the shared wrapper from the main checkout (the worktree intentionally does not contain `experiment/`). The absolute slug routes the wrapper's call log into this asset folder.

```sh
python3 /Users/fabianwesner/Workspace/suburban-survivors/experiment/tools/blender_run.py "$PWD/assets/veh.courier-bike" assets/veh.courier-bike/build.py -- --glb assets/veh.courier-bike/model.glb
node --import tsx assets/veh.courier-bike/pack-source.ts
npm run assets:pack -- veh.courier-bike
node --import tsx assets/veh.courier-bike/inspect.ts
python3 /Users/fabianwesner/Workspace/suburban-survivors/experiment/tools/blender_run.py "$PWD/assets/veh.courier-bike" assets/veh.courier-bike/build.py -- --render assets/veh.courier-bike/renders/hero.png --width 480 --height 360 --samples 24
```

All review renders use Cycles on CPU. `--lod 1` or `--lod 2 --view side` renders a lower tier. All tiers are authored explicitly, with intact closed tires/rims and cylindrical spokes; **no automatic decimation**. LOD1 uses one central rim hoop per wheel and fewer cosmetic details; LOD2 keeps eight-sided tires, rim strips and a spoke cross. The unit asset check rejects generated LODs and checks attachment pivots in all tiers.

Review: [five-view contact sheet](contact-sheet.png), [LOD comparison](contact-sheet-lods.png), and [measured delivery report](report.json). Individual render PNGs are reproducible development outputs. Run `python3 assets/veh.courier-bike/contact-sheet.py` after rendering all tiers to compose the compact PNGs. WebGPU requires manual review and is not claimed by this asset rebuild.
