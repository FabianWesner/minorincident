# E27 vision review — checklist H

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
