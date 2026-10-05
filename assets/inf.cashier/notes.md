Cashier: white short-sleeve collared shirt, sleeveless charcoal vest, name badge, draped red apron with rear bows, dark trousers, blood-stained sneakers, swept brown hair and high bun. Adult chibi head about one third of height; crouched lurch with mildly reaching arms matching the turnaround. Applied subdivision, rigid pivot hierarchy, proximal zero-scale stump caps with hidden extras. Palette-only geometry, no textures.

Final scale: 1.635 m, with the skull/hair mass approximately one third of height before the elevated bun. The dark brown hair uses the woodWarm palette token with a reference-matched dark base; eye emission uses emi_infectedEye. Static decorations are joined by palette material within each rigid joint, with caps kept named and separate.

Rebuild/export: `python3 experiment/tools/blender_run.py ../assets/inf.cashier assets/inf.cashier/build.py -- --glb assets/inf.cashier/model.glb`
Review set: add `--render assets/inf.cashier/renders/review.png --view review-set --samples 24 --width 960 --height 540`.
Final delivery: `--render assets/inf.cashier/renders/hero.png --view delivery --samples 96 --width 1600 --height 900`; this also creates the turnaround and posed proof. Standalone pose: `--render assets/inf.cashier/renders/pose-test.png --pose`.
GLB audit: `python3 assets/inf.cashier/verify_glb.py`.
