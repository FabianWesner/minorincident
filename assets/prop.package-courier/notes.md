# Modeling notes
Parcel dimensions: 0.54 m depth × 0.75 m width × 0.48 m height including proud markings. Scanner about 0.19 × 0.25 × 0.42 m, presented beside the parcel as in the concept. Blender Z up, parcel front +X, ground z=0.

Parts: bevelled orange/cardboard shell and lid; tape and lid seam; reinforced corners and square rivets; cream medical panel and teal cross; native raised text, blue cold-chain label, red fragile wineglass label; top shipping barcode, two blue display panels; side up arrows; dark/orange scanner head, screen barcode, trigger, angled grip and foot. Static geometry joins by palette separately for parcel and scanner (20 material primitives). Shared palette tokens are read directly through sslib.palette; no textures or bespoke colors. AO uses shared deterministic 32-sample CPU bake.

Reference-specific surface wear and tiny shipping text are simplified to solid details. Scanner shell is squarer and more upright than the painted concept. Snowflake is an asterisk; temperature label uses ASCII 2-8 C. These are side-tier simplifications. Large identifiers and warning colors remain readable. No animation applies. Collider sizes use glTF Y-up ordering; collider locations are Blender Z-up before export.

Reproduce: python3 experiment/tools/blender_run.py ../assets/prop.package-courier assets/prop.package-courier/build.py -- --glb assets/prop.package-courier/model.glb
Then: node assets/prop.package-courier/optimize.mjs
Render: same wrapper with --render assets/prop.package-courier/renders/hero.png --width 1600 --height 900 --samples 96. Use --view game/front/side/rear for review views. All preview materials have backface culling enabled; delivery materials are single-sided.
