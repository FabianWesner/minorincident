# E04 character vision review

PENDING: runtime art uses code placeholders. E04-AC11 applies when final assets are integrated; the supplied GLB review remains in tests/visual/survivor-review.md.


## Courier round-one animation correction — 2026-10-07

Scope: the PO-selected courier outfit and fitted round-one skeleton. This is a motion regression review; the historical red-outfit art review above remains about its original assets. Inspected paired production-pose stills at the game camera, final L1 stills, and sampled sequences from all four 6–10.75 s videos. Evidence: `player-animation-r1-female-walk.png`, `player-animation-r1-male-walk.png`, and [the complete evidence index](../../player-anim-r1/README.md).

Checklist B, applied to preservation of the selected courier:

- B1 [must] PASS — Front/side/back identity is retained through the recorded turns: female ponytail/shorts, male hair/cargo shorts, courier cap and messenger bag remain recognizable; the asset geometry is unchanged.
- B2 [must] PASS — The approved courier amber top/visor, teal bag and wristbands, and white cap/shoes remain intact; the red S01/S02 example is the older outfit, not this PO-selected courier.
- B3 [must] PASS — No mesh, rest-joint position or character scale changed, preserving the round-one head/body proportions.
- B4 [should] PASS — Cap/cross, bag/strap, wrist details and male pouches remain visible; extreme bat poses still stretch the existing strap weighting.
- B5 [should] PASS — Eyes and mouth read in the close game camera; cap/top/bag remain the dominant cues at normal gameplay distance.

Motion review: walking no longer arches backward; idle and stop settle over the feet. Arms counter-swing with bent elbows, running leans forward and has a slower steady cadence. Turns release the support foot. Knee anticipation takes a shorter path to the unchanged contact; all seven fists and three bat beats were observed under fast clicks. Hurt recovers forward. Riding keeps the bike-frame orientation, grips and saddle placement, with held weapons stowed through release. Both variants completed the L1 capture without console errors.

Remaining visible work: short-legged running is still brisk; knee windup remains four ticks; mount/exit is an IK/root blend rather than an authored leg-over-frame step; the bag strap stretches at extreme bat poses. These are explicitly recorded in the [lane report](../../../../docs/reports/player-anim-r1.md), not hidden by the checklist. This is ready for PO motion review, not a claim of flawless animation or a replacement for manual WebGPU review.
