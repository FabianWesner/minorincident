# thr.molotov

Side-tier throwable weapon: bottle diameter 0.116 m, neck diameter 0.046 m, mouth height 0.345 m; flame reaches 0.442 m. Upright on z=0, label faces +X. The tilted reference pose is reproduced by the studio camera, not by tilting the export.

Reference parts: broad olive-green cylindrical bottle, rounded shoulders, long narrow neck, two chamfered brass collars, cream curved label with frame/flame emblem/print bars, folded pale cloth, trailing red/gold/cream fire.

All visible geometry uses Principled palette materials, without textures. Bottle is opaque glossy stylized glass to retain palette readability. Static pieces merge once per material; flame stays separate with its origin at the bottle mouth for procedural motion. Grip socket at body center; cylinder collider and light/physics extras are exported. AO is baked on static meshes. Label is 4 mm above bottle, frame/print 3.5 mm above paper, emblem layers 3 mm apart. Fire color bands share their vertices instead of overlapping sheets.

Rebuild/render through experiment/tools/blender_run.py. Ref renders also write a game-view companion. Model export occurs before studio cameras/lights are created.
