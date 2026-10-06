# inf.skater measurements and review
Authoritative upscaled turnaround: adult skater, no board. Red ribbed beanie,
brown swept fringe, charcoal purple open hoodie with ivory lining and tee,
muted blue skinny jeans, exposed torn knees with dark protective rings/straps,
red canvas shoes with ivory toe caps/soles/laces, dark wrist bands, blood smears.

Accepted worker proportion overrides generic survivor quarter-head: head including
beanie about one third of standing silhouette; thick limbs, oversized claw hands,
bent knees, forward torso, reaching arms. Target posed height 1.6 m. +X forward,
-Y character right, feet z=0. Use rigid joint empties, applied subdivision and
joint-local merged meshes. Stumps stored at zero scale on proximal nodes.
Palette token variants are tuned to reference cloth/hair hues (start-value palette).

Round 1: complete silhouette and garment/accessory construction.

Round 1 review: all nodes present; 38,890 triangles, 72 meshes, feet z=0,
unit scale and zero joint rotations. Beanie lower sphere overlapped its brim,
laces were partly buried, knee blood covered too much skin, stance too narrow.
Round 2: replace full-sphere hat with sculpted closed dome and taller folded brim;
raise crossing laces 30mm, reduce knee blood, expose fuller knee, spread hips and
lower body 50mm, deepen red canvas/knit. Budget reduction target lowered.

Round 2 review: 36,706 triangles, 72 meshes. Knit beanie, exposed knee skin,
wider/lower crouch and true rear garment holes improved fidelity. Hip spread
rolled the shoes and laces were too far towards the heel. Round 3: level shoe
world transforms before baking, move laces forward/down, add torn back flaps.
Final-set batches all review views, 1600x900/96-sample hero, articulated pose,
left amputation/stump panel, turnaround and pose contact sheets in one GPU slot.

Round 2 browser review: WebGPU and WebGL2 both load cleanly with no console
errors. Close view identified knee-pad upper straps following the shin above
the knee; final build reparents upper straps to thighs and tightens lower straps.
Laces now ray-fit to canvas/tongue surfaces with 4mm minimum underside clearance.
