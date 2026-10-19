# Controls and content, PO 2026-10-19

Bicycle keyboard input uses local W throttle, S brake/reverse and A/D steering. Pointer navigation and touch retain their existing movement paths. Automatic keyboard fire selects the nearest unobstructed on-screen infected within ±35° of movement (facing while idle), otherwise shooting ahead. Automatic shots skip the second soft snap, so it cannot widen that cone.

L3 acknowledges the rendezvous immediately and counts down 15 simulation seconds, retaining the rescued-group/closed-boom completion condition. Its separate rescue encounter clock stays unchanged. L4 issues the gun, emits pickup/alarm and starts war in one simulation tick; waiting without taking the gun stays calm. The arrival checkpoint moves to ride completion so the quartermaster cannot overwrite the same-tick turn checkpoint.

The E03/E05/E19/E21/E22 criteria and test plan are updated for these PO decisions. No performance threshold is relaxed.

## Regression evidence

[Main failures](main-regressions.txt): six selected regressions fail against main sources (bike local axes, cone selection, current movement direction, L3 15 s feedback, L4 pickup timing at both tiers). [Focused green run](targeted.txt): seven tests pass on Hetzner. Typecheck, lint and production build [pass](checks.txt). The broader results and remaining gate limits are recorded below.

## Game-camera review

Opened `captures/bike-rider.png`: the courier sits on the bicycle outside Sunset Parcels, hands at the bars, cargo box and both wheels drawn; the depot entrance and objective remain visible.

Opened WebGL `controls-aim-north@high-z1` and `z0.5` sheets: the north and south infected flank the courier vertically on screen. The courier turns and raises the handgun toward screen north while moving upward; the nearer southern infected remains behind. At zoom 0.5 the northern infected approaches the upper frame edge, illustrating why targeting must use the viewport rule. These short sheets show the pose; hit/direction assertions provide the behavioural proof.

Opened WebGL `controls-l3-evacuation@high-z1.5`: the ring changes from yellow to green, the tracker reads “Evacuation in 15 s”, the bus sits in the foreground, and soldiers fire at the crowd outside the checkpoint. The courier and ring remain visible.

Opened all eight `captures/north-*.png` images. WebGL and WebGPU show the same northward muzzle flash and hit reaction; the nearer southern infected remains behind the courier. The low tier reduces grass density and shadow detail. At zoom 0.5 the northern figure is partially cropped at the upper edge, while the courier and southern target remain readable.

The first L3/L4 fixed-target fixtures passed numeric gates but cropped the courier or showed empty tables at close zoom. They were replaced with courier-follow cameras; L4's `pickup` fixture positions the courier beside the real quartermaster before issuing the gun. The corrected WebGPU close-zoom L3 sheet keeps the courier, green ring and 15 s tracker visible, with the soldier cordon behind; the wider checkpoint is cropped. The corrected L4 sheet shows the courier holding the machine gun beside the quartermaster table. Alarm/attack tick equality is proven by sim events, not by a still image.

Opened bike sheets at zoom 1 and 0.5, both tiers on both renderers: mounting gives way to forward movement along the pavement, the bars and bicycle change heading, then the bike moves back toward the bench. The rider remains seated and aligned with the frame; the following game camera keeps the whole bicycle in view.

The immediate L4 alarm exposed a tank cadence regression: safe street fallback selection happened only after the cooldown, adding hull-turn time to the 8–12 s interval. The tank now aims at a safe fallback during cooldown. Its focused regression fails against main and passes with this change; the existing military-spectacle test also passes with its original interval and ally-safety thresholds. See [green checks](tank-fix.txt) and [main failure](tank-main-red.txt).

The calm-camp movement check now uses a verified open position outside the pending quartermaster's click-snap area, retaining all four 6 m diagonals, all three input schemes and the original 1 m tolerance. The civilian check retains its minimum cohort and samples the settled camp before pickup, since pickup now immediately starts the alarm.

## Final validation

The combined six-scene matrix passes all 72 unique rows (two renderers, two tiers, three zooms including 1.0 and 0.5). High maxima are 117 draws / 462,837 triangles; low maxima are 113 draws / 337,875 triangles, within unchanged E18 render budgets (high 600/1.5M, low 300/500k). The aggregate explicitly checks the low draw limit as well as the scene gates. See [matrix summary](matrix-summary.json), [WebGL sheets](scenes-webgl/index.md) and [WebGPU sheets](scenes-webgpu/index.md). All eight real-input north/south configurations pass; all eight captures were opened.

Fresh-build browser follow-up: 20/20 pass (north/south aiming, smoke, L3 closure/countdown, true calm-camp movement and L4 pickup alarm). The separate real-click L3 evacuation-to-L4 handover passes with the 15 s countdown. The initial broader browser run had four failures and one retry-only pass; the four failures were repaired and rechecked without relaxing their assertions.

The first remote [full unit/sim/levels sweep](full-suites.txt) passed 3,176 tests, skipped nine and failed six (510 files). Five failures have focused green follow-ups: L3 officer share (preserve explicit-target soft assist), L4 tank cadence, settled civilian cohort, true calm-plaza movement and immediate campaign hold activation. The sixth failure, first-beat soldier attrition, now passes after first-line pressure reuses the concealed camp exits from the alarm. The new concealed-exit regression fails against the original director and passes with the fix; see [main failure](concealed-main-red.txt), [green regression](concealed-green.txt) and [original attrition check](inside-flanks-corrected.txt). Counts, damage, caps and beat timings are unchanged. The full sweep was not repeated after these repairs. The final wider focused rerun passes [87/87 tests](final-focused.txt), the pickup/tank/concealed-exit set passes [4/4](concealed-green.txt), and the final director passes [all four collapse variants plus the military spectacle check](l4-final-director.txt). These focused follow-ups cover all six original failures. A further [final bot check](l4-final-bots.txt) passes the complete, newbie and evade-only tests, including low-quality completion, with the final first-line pressure change.

Native desktop/phone hitch timing is **unmeasured**: `tools/perf/quiet-run.sh` stopped admission after the binding 30-minute wait. No further reservation was requested. Node E18 horde and level budgets passed in the full sweep (200-infected reference p95 2.44 ms against 4 ms).

Native timing coverage is incomplete; this report does not claim deploy approval. The final L4 scene follow-ups pass on both renderers, with high/low and zoom 1.0/0.5 captures opened. Results are consolidated into the per-renderer indexes; the revised first-line view replaces the initial short framing.

## Additional capture observations

Opened the final L3 low-tier WebGL zoom 1 and WebGPU zoom 0.5 sheets: the courier remains centred in the green rendezvous ring, the tracker reads “Evacuation in 15 s”, and the bus and soldier cordon remain visible. Distinct officer fixture positions avoid rejected overlapping teleports and allow the real boom-closure check to run.

Opened the tank low-tier sheets on both renderers at zoom 1 and 0.5: hull rotation precedes the shot; at zoom 1 the full tank and nearby fighters are visible, while close zoom crops the front hull. A black perimeter railing intersects the tank at its existing authored hold point. This visual defect is recorded; no layout or asset was changed for it.

Opened the final real-input alarm capture, `captures/alarm-final.png`: the courier stands beside the quartermaster with the machine-gun HUD and “Hold the plaza with the army” tracker active; gunfire and a partially visible infected are at the frame edge. The browser measured 46 living infected, one in view, 3.67 s after the pickup. See [final alarm check](alarm-final.txt).

Scene indexes and `matrix-summary.json` retain gate values and renderer/quality coverage alongside the contact sheets. Raw per-scene world snapshots (`metrics.json`) remain local and are excluded from the commit.

Opened the final first-line sheets at zoom 1 and 0.5, both tiers and renderers. Soldiers stand beside the sandbags; at zoom 1 the road and later distant figures are visible along the upper edge. Close zoom emphasizes the soldier and crops the road. These sheets document the view and rendering, not the casualty result; all four collapse sim variants retain their original assertions. The initial short tent-focused view was reframed and extended to ten seconds.
