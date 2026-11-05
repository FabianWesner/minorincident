# bld.kessler-hardware (L4 Kessler Lane hardware store, basement approach)

Source: `tools/blender/sslib/fh_kessler.py` via `sslib/fairhaven.py`; reference `assets/bld.kessler-hardware/reference-upscaled.png`.
Warm brick two-storey shop, wood shopfront, striped awning, hip slate roof with chimney and two dormers, tool/paint displays,
projecting hammer sign, lit KESSLER HARDWARE sign. Authored LODs (LOD1 keeps roof shape and courses without bevels/tabs, LOD2 solid roof).
Materials (7): brick, woodWarm, canvasTan, asphalt, redDark, sidewalk, emissive windowGlow; the animated cellar door adds one draw (8 total).

Interface anchors: `door_cellar` joint (rear wall, -X face, hinge at world y=1.05, `ss_door` axis Z, openAngle 95 = swings outward to -X,
initialState closed), `cellarDoorSocket` (-4.1, 1.6, 0.2) = the shared cellar-door anchor: `int.basement-cellar` exports the same socket name at
its barrable door (level layout aligns the two sockets), `shopDoorSocket` (front double door), `front`; `col:walls`;
lights: shop windows, two sign lamps, `light:cellarDoorLamp` (powerGroup `kessler-lane`).
