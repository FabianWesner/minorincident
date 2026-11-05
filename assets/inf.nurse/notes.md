# Infected nurse

Reference: `reference-upscaled.png`, original crop, and nurse in `initial-drafts/infected-workers-and-specials.png`. Main cues: messy brown high bun/red scrunchie, large red eyes and snarling mouth, faded teal V-neck scrub tunic and trousers, pale sneakers, wrist bands, ID lanyard and draped stethoscope. Torn knees and back, blood on face, hands, forearms and clothing.

Construction follows the accepted `inf.common-worker` rigid-part model helpers. All forms use applied subdivision or soft bevels; no live modifiers or texture dependencies are exported. +X forward, Z up, -Y right. Oversized head/hair, hands and shoes; hunched torso and bent knees with lower asymmetric reaching arms reproduce the turnaround pose. Joint transforms are baked into a rest mesh with unit-scale zero-rotation pivot nodes. Feet are grounded individually after posing.

Decorations merge by material inside their moving parent. Seven hidden stump meshes remain on proximal parts, carry `stumpFor`/`hidden` extras and use zero-scale hiding so a runtime can reveal them by resetting scale. The pose test moves armL, foreArmL and legR, reveals stump_armL, and also removes the right arm to expose its cap.

Build through `python3 experiment/tools/blender_run.py ../assets/inf.nurse assets/inf.nurse/build.py -- --glb assets/inf.nurse/model.glb`. Views: hero/front/side/back/turnaround; `--pose` exercises joints. The turnaround assembles front.png, side.png, back.png and review-hero.png from renders/ through Blender.

Round 1: 42,780 triangles, 60 merged meshes. Light brown hair and smooth bun differed from the reference; claws curled upward.
Round 2 changes: deep brown shade of woodWarm, lower lobed bun with loose strands, downward-curled claws, wider bent-knee stance, thinner teal collar stitching, and lower mesh reduction ratio to stay below 40k.

Round 3: four-view review, 37,902 triangles, 62 meshes. Both Three.js backends loaded without warnings/errors. Rear review revealed a short nape, exposed waistband, and shoes rolled with the leg spread.
Round 4: extended layered nape locks and rear tunic shell; counter-rolled the feet so soles lie flat. Final geometry is 39,584 triangles / 62 meshes. Front, side, rear and three-quarter reviewed against the reference. No more geometry changes.

Final render mode: `--render assets/inf.nurse/renders/hero.png --view final-set --samples 96 --width 1600 --height 900` produces the hero, a 24-sample 960×540 pose test and assembled turnaround. The deep brown woodWarm shade preserves the source hair color. Zero-scale stump hiding must be restored by setting cap scale to one at runtime.
