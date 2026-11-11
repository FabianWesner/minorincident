# S47 render readability

Implemented and visually reviewed the three render-only changes. [Opened contact sheet](evidence/contact-sheet.jpg). Raw captures remain outside Git in `/private/tmp/s47-readability/`.

- Low gorilla uses the standard atlas while retaining its low-tier geometry. All four backend/zoom luma comparisons meet the 15% margin.
- L10 includes nearby living threats in its existing foreground reveal subject; the console also qualifies for the broad cut when it fills a quarter of the view.
- L3 thrown bodies receive a blue-white motion ribbon through the existing particle pool. No simulation, AI, damage, timing or shared clip code changed. No new render mesh or draw call was added.

## Final checks

- Typecheck and lint passed after the final tracer correction.
- `sh tools/remote/run.sh "$PWD" -- npm test`: exit 0; 27 files, 106 passed and 1 skipped (107 tests); 150/150 collected case budget; 162.8 seconds within 240 seconds.
- `SCENE_PORT=4936 E2E_UNITS=1 npm run scene:gate`: 62/62 rows passed, no known failures or unrun rows. Includes night boss rows on both backends/tiers and courier/companion rows. Receipt: `test-results/scene-gate/summary.md`.
- Initial sandbox restrictions were lifted; worktree slimming subsequently succeeded and all visual runs used one headless browser through `tools/e2e-lock.sh`. Own servers were stopped.

## Gorilla matrix follow-up

All eight `measured.png` captures under `/private/tmp/s47-readability/matrix/{low,high}-{webgpu,webgl}-z{1,1.5}/` were opened individually. Each shows a charcoal body with grey silverback areas and a clear light rim; neither low zoom sample has the earlier uniformly pale coat. The views retain nearby allies and the courier, with some body overlap, and the gorilla pose differs slightly because these are real-time route runs rather than a frozen identical tick. The body-mask measurements are retained in [gorilla-matrix.json](gorilla-matrix.json).

| Backend | Zoom | Low luma | High luma | Difference |
|---|---:|---:|---:|---:|
| WebGPU | 1 | 32.30 | 36.77 | 12.16% |
| WebGPU | 1.5 | 35.94 | 34.11 | 5.36% |
| WebGL2 | 1 | 35.16 | 34.42 | 2.15% |
| WebGL2 | 1.5 | 34.15 | 32.93 | 3.70% |

All four pairs meet the requested 15% luma margin. Route: `60,0;60,-22`, reach 1 m, 20 seconds, god mode, no firing, no kiting. The arena requires seven metres of entry depth; the earlier route bypassed its entry trigger. These measurements establish tier agreement for the sampled live encounter, not identical-pose pixel equality.

## L10 live follow-up

Opened `/private/tmp/s47-readability/l10-z15/s005-t1288.jpg` and `/private/tmp/s47-readability/l10-z1/s005-t1279.jpg`, both high WebGPU, god mode, real firing, stationary courier at the console fixture. At zoom 1.5, the foreground bullet tank has a broad cut around the Mega and its warning ring; courier, Mega and nearby infected remain visible. At zoom 1 the same tank/platform cut exposes the close fight despite the tighter framing. The read-only occlusion probe selects `kit.dispersal-tank-bullet@4014.0,-39.0` and `kit.dispersal-platform@3992.0,-33.0` in both runs. This is evidence for the current cut at both zooms; the matched frozen comparison below supplements this live sample.

## L3 projectile follow-up

A deterministic L3 Scene Lab fixture starts the Thrower's real `alpha.living-missile` attack at frame 0 and places six additional infected around its flight corridor. The attack becomes active at frame 47 and recovers at 78. Opened all four `/private/tmp/s47-readability/l3-crowd/shot-{0030,0060,0070,0090}.png` captures: frame 30 shows the held body and landing warning; frames 60 and 70 show the airborne body with a bright blue-white direction ribbon separating it from upright nearby infected; frame 90 shows the landed body with the ribbon gone. The fixture passes with no console errors or clipping failures. This is a controlled crowd fixture, not a complete live L3 playthrough.

The initial invisible ribbon was caused by passing zero for the tracer distance channel (the same argument is gravity for ballistic shapes). Supplying its actual length produces the expected streak through the existing pooled particle draw. No shared clip code or simulation timing was changed. The final emission is 1.6 m long, 0.09 m wide, emitted every 0.05 render seconds, with a 0.12-second lifetime.

## L10 matched cut comparison

Opened all four `/private/tmp/s47-readability/l10-pairs/z{1,1.5}-{uncut,cut}.png` images. The fixture is paused after 1,200 additional simulation ticks; each pair switches only the existing `seeThroughOff` render diagnostic and redraws with zero simulation ticks. At both zooms the opaque bullet tank hides most of the Mega and portions of warning rings. Enabling the foreground cut exposes the Mega, nearby infected and complete combat area around the courier. The retained outer structure has a feathered dotted edge. These are cut-disabled/reference versus production-cut comparisons, not historical binary screenshots. JSON audits beside the captures retain the identical tick and selected placements.

The sheet includes two gorilla quality images, both L10 z1.5 reference/cut images, the L10 z1 cut, and L3 telegraph/active/recovery. Every source image cited above and every sheet cell was opened and visually inspected.
