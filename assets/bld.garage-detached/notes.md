# Detached garage modeling decisions

Source: Level 1 key-locations sheet, upper-right garage. Building front is +X, Blender +Z up; metres. Garage shell is 2.96 m deep × 4.40 m wide with a 3.01 m eave and 4.27 m roof ridge. The paved apron is 5.85 × 7.00 m; the complete vignette including rear shrubs is centered on X/Y, ground at Z=0. A shallow workshop follows the open presentation of the concept so the workbench remains visible through the opening.

Part list: lap siding, gables, soft pale casing, staggered dark shingles/ridge, louver vent, raised sectional door and tracks, side window, entrance and side lamps, workbench/shelf/pegboard/tools, drawer chest, stool, crates, paint tins, vise/toolbox, wooden bat, shovel, hanging bicycle, red mower, bins, fence, gas can, flowering vegetation and paving weeds.

`root`, `roof`, `interior`, `door_main` and `window_side` are independent groups; the door origin is at the top track and exposes a vertical reveal control for the visible raised section. `weapon_bat` is an empty at the bat grip on the workbench, because the task requires a bat lying on the bench. Its barrel rests just above the counter; the socket follows the grip center. `bat_display` is a separately hideable group for pickup removal. The reference's leaning bat is represented by a leaning workshop shovel. Rear/side/floor colliders leave the entry clear. No solid collider fills the interior.

Palette uses the shared `sslib.palette` library reading src/assets/palette.json. Gray walls use asphalt, door/bins denim, dark roof uiDark/asphalt, pale casing picketWhite, wood woodWarm, accents survivorRed/backpackTeal/schoolBusYellow, vegetation foliage/grass, and emission windowGlow. All exported materials are single-sided. LODs are authored from the same procedural source with reduced bevels and selective detail, retaining contract nodes at every level.

Rebuild (always through the approved wrapper):

```sh
python3 experiment/tools/blender_run.py ../assets/bld.garage-detached assets/bld.garage-detached/build.py -- --glb assets/bld.garage-detached/model.glb
node assets/bld.garage-detached/optimize.mjs
```

The wrapper writes its own call log in this asset folder. No registry or manifest entries are changed; central reconciliation owns integration.
