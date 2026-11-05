# Modeling notes

Reference crop: l1v2-neighborhood-kit.png rectangle [1215,160,1628,500], original resolution; complete main car wash and separate foam curtain.

Architecture: 5 m long base, 5.9 m total width including external foam curtain, 4.584 m height. Bay width 3.5 m. The placeholder's 5 × 4 × 10 m dimensions do not match the concept proportions; integrator must reconcile measured bounds. Main front faces +X, Blender Z-up, foundation bottom at zero.

Blue barrel-vault roof with white ribs, Sunny Suds sign and friendly sun, tiled cream pillars with teal bands, yellow fascia/bollards, blue payment machine and red button, three multicolor cloth brushes, silver track/drain, wet floor and foam. External curtain is retained in the same asset as requested.

brush_a/b/c origins sit at their drive shafts, local Z rotation. curtain origin is the overhead rail, local X swing. start_button is independent in kiosk coordinates and can depress along local X. roof and interior are separate groups for game visibility. Nonblocking pillar and kiosk collider empties; no solid collider across the drive-through bay. vfx_foam anchor is present.

Authored coarse LOD assemblies retain whole surfaces, moving nodes, roof arch, brush colors and external curtain. Static geometry joined by palette material within semantic assemblies. No textures; only palette tokens. Deterministic CPU AO softened to preserve toy colors. Materials have backface culling enabled.

Reproduce delivery: `python3 experiment/tools/blender_run.py ../assets/kit.car-wash assets/kit.car-wash/build.py -- --glb assets/kit.car-wash/model.glb`, then `npx tsx assets/kit.car-wash/optimize.mts`. The second command applies shared production optimization in place to this asset only and writes structural report.json.
