# E27 vision review — checklist H

**Current AC15: MET visually (2026-10-22).** Final-source named H review below supersedes the historical physical-consequence claim; full final verification is pending.

Inspected 2026-10-10, headless Chrome / Metal WebGL2. Scene Lab fixtures use a fixed game angle (1.5× framing), and production L4 uses its authored `l4-collapse` photo spot. No L6 missions/data were changed. All twenty-three Scene Lab scenes completed with zero console errors; nine lighting presets and twelve effect scenes are described in the epic reports.

| H item | Result | Inspected evidence / observation |
| --- | --- | --- |
| [must] Flash → fireball → shockwave → debris → smoke | PASS | `ac03-t000/002/006/015/040/180/900.png` plus `ac03-detectors.json`: short pale flash, expanding noisy orange volume, growing ground ring, sparks, gray rising puffs, lasting scorch. The 60-tick contact sheets do not replace this short-beat evidence. |
| [must] Physical consequences and persistent scorch | PASS | `ac05-car-blast.png`, `ac05-car-parts.png`, `ac05-wreck-20s.png`; `scene-lab/car-wreck/sheet.jpg` shows the lifted body, black detached panels, burning wreck. Medium/mega scene aftermath retains charred ground and struck actors; sim checks prove the one-tick delayed impulse. |
| [must] Volumetric noisy fireball with hot-to-cold gradient | PASS | Medium/car short-frame captures and `scene-lab/blast-mega/sheet.jpg`: white-yellow cores, orange lobes, dark dissolving edges, holes and rounded overlapping volumes. Production `collapse/t015.png` and `t040.png` show the staged cab/tanker fireball above the shop roofline. |
| [must] Lit, wind-bent smoke and a visible player silhouette | PASS | `scene-lab/building-fire-night/sheet.jpg`, `ac11-fire-column.png` and numeric fire/strobe evidence; lower orange volume, cooler gray upper puffs and drift along the existing wind. `ac12-smoke-player.png` and ID mask prove ≥2:1 player contrast and ≤40% measured coverage. Grenade sheet ends with clear ground after the final puffs fade. |
| [should] Car jumps, parts detach, wreck burns | PASS | Car sheet frames 210–330 and the AC05 physics/capture checks; detached panels are separate silhouettes, not a sprite. |
| [should] Fire flickers, emits embers and lights surroundings | PASS | Medium and night-building sheets show changing flame tongues/ember scatter, warm ground spill and bright lower smoke; the upper column stays gray. |
| [should] Intensity matches the class | PASS | All six class sheets inspected: small sparse smoke/compact scorch, medium localized fires, larger car-scale aftermath, mega broad ring and many fireballs/columns. Toxic is green gas; incendiary direct-definition smoke differs from the actual Molotov's tested fire zone. |

## Required scenarios

- **blast-lab medium:** complete fixed-tick detector sequence, persistent char mark and sparks.
- **blast-lab car:** telegraph before rupture, body lift, detached parts, persistent burning wreck/smoke.
- **blast-lab mega:** fuel-truck sequencer in the Scene Lab fixture; much larger noisy fireball, dust ring, casualties, orange spill and persistent fire columns.
- **fire-lab building at night:** bright changing flames, orange lower smoke and cooler wind-bent top, illuminated ground/nearby wall; player remains clear to the left.
- **smoke-lab grenade/column:** dense low cloud, visible player-facing silhouette through ordered dither, measured night readability; cloud emitter ends at twelve seconds and its last visual puffs fade out. Fire column and police strobe use paired clean backgrounds to sample actual smoke pixels.
- **L4 l4-collapse:** `collapse/sequence.json` records pump/cab hit, canopy/tanker rupture, tanks/mega explosion; `t015` and `t040` show the noisy expanding volume over the foreground pharmacy, `t150` shows persistent flames/columns and `t900` the aftermath. Foreground shops hide part of the blast base, while the fireball rises above them. Town orange tint accompanies the rupture. This is the production mission set piece, not an isolated replacement scene.

The required H items pass on the inspected evidence. Backend: WebGL2 only; manual WebGPU parity belongs to E25 and is not inferred from browser test names.

## Fresh gate review (2026-10-11, source 7510e7b2)

All twelve E27 Scene Lab sheets were opened and inspected after the merge. Small blasts leave compact scorch and short sparse gray smoke; medium/large leave progressively more flames, embers, orange lower smoke and gray drifting tops. Mega has a broad expanding ring, overlapping yellow/orange noisy volumes, casualties and many persistent columns. Toxic blast/hazard are clearly green; tear gas is pale and dithered toward the player. The direct-definition incendiary fixture leaves brief smoke/scorch; gameplay Molotov fire belongs to the existing weapon tests. The car sheet shows its smoking tell, rupture, detached panels and burned wreck. Night building fire casts warm spill on the ground/wall and lights the lower column. Extinguisher fire stops after frame 30, replaced by a short pale burst. Grenade smoke has a visible courier-facing dither region and dissipates by the final cells without repeated throws. All scenes have zero console errors.

Fresh L4 production collapse frames 15/40/220/900 were inspected: pale initial flash, a noisy lobed hot fireball above the pharmacy wall, orange town spill, then persistent flames and columns. Foreground shop walls hide the lower portion of the blast. The fresh car-parts image shows separate flying panels beside yellow cores and broken orange outer volumes. The fresh smoke-player image retains the courier's red/teal silhouette through the dither.

Checklist H: all four must items PASS (fixed-tick staged sequence; lifted car/detached parts/scorch; noisy hot-to-cold volume; orange fire-lit and drifting smoke with visible player), and all three should items PASS (car/wreck physics; flickering flames/embers/spill; clear class-scale progression). Fresh AC11 lower hue is 23.731 degrees and lower/top luminance 14.268x; AC12 contrast is 2.235:1 and measured smoke coverage 39.110%. These measurements pass their unchanged bounds. Frame-stage, car-lift/20-second-smoke, flash-reduction, grenade lifetime, pool recovery, L5 landmarks, and production collapse browser checks passed. Final performance evidence is recorded in the closure gate report.

## Final source refresh (`41b57aa2`, 2026-10-11)

All twelve refreshed sheets were inspected: small/incendiary leave dark scorch as flames expire; medium/large sustain orange fire under gray smoke; mega starts with a bright spherical blast/ring then sustained fire and debris; toxic stays green. The car-wreck sequence bursts into separated panels and fire. Night house fire lights its surroundings; extinguisher replaces flame with a short pale plume; tear gas is white; smoke grenade expands then dissipates with its directional cue still visible. No new visual regression was observed relative to the earlier fresh review. Scene Lab checks validate this controlled scene set; they do not provide manual WebGPU parity or the missing E25 lighting reference review.

## Final-source named H review — 2026-10-22

This review supersedes the earlier incomplete physical-consequence signoff. I opened both final seven-row high/low frame sheets, plus full-size medium/mega flight, night wind column and the two late grenade frames. `docs/reports/ac-close-shared/h-high.jpg` and `h-low.jpg` retain all seven required spots; `evidence/vfx-final.json.gz` records 102 frame states and source-image SHA256s. Grenade frames use a pinned production preview after the earlier dev blank frame failed review; both tiers now pass an explicit non-flat-image assertion. A concurrent source edit is only a possible cause of the old blank, not a proved diagnosis.

| Priority | H item | Observed result |
| --- | --- | --- |
| must | Staged blast | PASS — medium f6/8/12/21/46, car f186/190/200/230 and mega f6/20/40/70 separate flash, yellow-orange lobes, expanding pale ring, flying fragments and dark plume. Production L4 f6/40/186 repeats the authored sequence. |
| must | Props / corpses / cars move; scorch stays | PASS — cart/cone displace, car lifts and panels fly; retained body id6 rises to y1.56 in medium and y10.72 in mega, then lands with its original id. Car body id7 rises to y1.47 and lands at (3.82,0.7,3.87); medium late position stays (1.95,0.7,3.90). Late black scorch and burning wreck remain. Cosmetic body flight is now implemented and checkpoint-tested; no combat collider/damage or corpse removal was added. |
| must | Volumetric noisy hot-to-cold fireball | PASS — overlapping lobes have yellow hot centers, orange folded rims, holes and dark cool clouds; mega has a much broader ring and scattered persistent fires. |
| must | Lit / wind-bent smoke; visible player | PASS — night house-front fire and separate column have rounded overlapping puffs drifting right; orange lower smoke/cooler top is quantified at 2.62× luminance. Actual thrown grenade cloud keeps the cap, face and orange clothing visible at f90/240/840, with the ground marker visible through the dither. At f840 the smoke has not fully expired; no fade-to-clear claim is made for that frame. |
| should | Car jump / detached parts / burning wreck | PASS — raised body, separate dark panels and persistent charred burning chassis appear in order. |
| should | Flicker / embers / nearby lighting | PASS — night flames change shape at f60/90/180/600; sparks rise and warm pools light the pavement and porch/facade. |
| should | Class intensity | PASS — grenade is a localized cool gray cloud; medium/car affect a few metres; mega lights a wide area, throws the corpse higher/farther, and leaves multiple fires. |

**AC15 met: 4/4 must and 3/3 should**, across medium/car/mega lab, night house-front building fire, actual smoke grenade, persistent wind column and production L4 `l4-collapse`. The house fire is a real fire hazard against the porch/facade, not a claim of a newly destroyed house mesh. Focused smoke/player regressions pass unchanged thresholds; full final E27 verification remains pending until its receipt is complete.
