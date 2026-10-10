# Gun pose and muzzle origin review — 2026-10-11

## Changes

- A final torso/right-arm IK layer raises the courier and crowd guns to shoulder height. The firing arm is nearly extended with a small downward elbow bend; the torso faces the shot and the walking legs retain their animation and heading. The layer holds for 24 simulation ticks (0.4 seconds) after the last shot.
- Courier shots use the held GLB's authored `muzzle` socket. Police, army and armed civilians use their rendered prop barrel endpoints transformed by the actual hand/prop matrix. Army nests retain and rotate their authored gun and muzzle through district batching. Flash, first tracer particle and visual obstruction ray share the shot-time muzzle position.
- Both gun slots have no idle range line. Firing shows a low-opacity tapered cue from the muzzle, capped at 4 metres, stopped by the combat obstruction query and fading over the firing hold.
- Scene Lab attack scripts accept simultaneous movement and firing. Its zero-clipping gate now includes firing-gun triangles against the owner's torso, neck and head proxies. Hands and forearms are excluded because they grip the gun. This is sampled every three frames and supplemented by capture inspection; it is not an exact character-mesh intersection proof.
- Explicit Scene Lab NPC schedule commands clear the random spawn pause so the commanded walk starts immediately.

## Capture review

All browsers are headless. The six scenes use L3 lighting, asphalt and the normal game camera angle at an allowed close zoom; `side` uses a close profile. The committed captures and contact sheets are in [captures/](captures/). The separate [real L3 station view](captures/l3-station.png) comes from the merged-source level playthrough: police guns are raised and puff chains begin at their barrels. The HUD partly covers the courier there, so the unobstructed side scene provides the clearer player-pose review.

| Scene | Inspected observation |
| --- | --- |
| [Standing](captures/standing.png) | Pistol rises from rest and extends in front of the courier; puffs start at the barrel. No visible gun/head or gun/torso intersection. |
| [Walking](captures/walking-sheet.jpg) | Walk cycle continues underneath the raised arm; the muzzle, flash and tracer move with the courier. No visible body clipping. |
| [Turning](captures/turning-sheet.jpg) | After the target switch, torso, arm and barrel turn together and the tracer reverses direction. |
| [Side](captures/side.png) | Level pistol, nearly straight right arm, small elbow bend; clear space from the head and torso. The sheet shows the arm lowering after firing. |
| [Police](captures/police-sheet.jpg) | Officer aims the pistol at the infected target; puffs begin at the barrel. The separate army and armed civilian render probes also show no gun/head overlap. |
| [Idle](captures/idle.png) | Equipped gun rests in the right hand; no cyan or yellow ground line. The two-slot render test independently checks zero cue vertices for LEFT and RIGHT. |

Fresh merged-source native Metal runs pass all six scene gates: zero console errors and zero static, actor, held-prop and gun/body clipping hits. Before the main merge, all six also passed remote SwiftShader.

## Pose and muzzle measurements

All twelve standing/walking render cases pass: courier handgun, police pistol, army rifle, army HMG handheld fallback, armed civilian pistol and hunting rifle. Standing NPCs and the separate authored HMG nest use normal ally firing logic. Walking NPC probes emit the production firing event at a real walking rig pose, with a distant target avoiding threat-awareness interruptions. Courier walking uses normal movement and held fire.

| Measurement | Worst result | Required |
| --- | --- | --- |
| Rendered muzzle versus first tracer start | 0.00008995 m (0.09 mm) | <0.05 m |
| Hand versus shoulder height | 0.00001741 m | ±0.15 m |
| Forearm versus shot direction | 6.6684° | <15° |
| Clipping count | 0 in every case and scene | 0 |

Courier speed is 2 m/s and NPC walking probe speed is 0.787 m/s. [Raw standing](captures/metrics-standing.json), [raw walking](captures/metrics-walking.json) and [summary](captures/metrics-summary.json) preserve the world positions, joint positions and scene gates. The separate nest test compares its rotating authored muzzle with the shot origin. The temporary-cue test checks fence obstruction, the 4 m cap and fading. Rig unit tests include male/female courier and NPC root scales 1 and 1.3; unchanged feet matrices verify the upper-body override leaves the gait intact.

## Validation

- Typecheck, lint and build: pass on the final source.
- Full remote unit suite: 467 tests pass across 132 files, one worker, after merging main and restoring the aim import.
- Focused rig, Scene Lab tooling and figure-height units: 23 pass locally after the main merge; the final balance criterion check also passes all three tests.
- Native Metal gun-pose render suite: 5/5 pass after the main merge. Before the merge, both native Metal and remote SwiftShader passed all five.
- Native smoke browser suite: 11/11 pass, including both crowd-render backends. The E05 simulation selection includes all six smoke simulation tests.
- E05 browser selection: 31/31 pass. The official `npm run verify -- E05` invocation returned zero before the main merge; final merged-source remote simulation selection passes 61/61, including all six smoke simulation tests ([summary](captures/e05-simulation-summary.json)).
- Native complete levels suite: 28/31 pass. L2 route travel stalls; Sam turns during L5 escort; L6 shelter red-eye sampling fails. The isolated exact main checkout reproduces L2 route failure (at an earlier waypoint), while L5 and L6 pass alone. Branch retries of L5/L6 are pending. [Level failure summary](captures/levels-summary.json).

Initial broad remote browser attempts encountered loading timeouts and a SwiftShader crowd-render allocation failure. Native smoke replaces those results. Level tests explicitly selecting Metal run on the Mac. The initial logs remain in `test-results/gun-pose-final/`; final native logs are in `test-results/gun-pose-native-validation/`.

## Main integration and criterion correction

Merged main `d27704a2` into this branch (`d3f15be3`). Main's NPC-height merge removed a `Vector3` import still needed by aim code; `4439d7e7` restores it and covers normalized NPC root scale 1.3.

The merged main baseline also fails the E05 fire-axe TTK criterion: the accepted PO 2026-10-10 damage increase from 45 to 56 reduces the swing count, but the authored lower bounds still describe the earlier damage. This reproduces on the isolated exact main commit without gun-pose changes. `83f75fcf` subtracts the saved 0.5-second swings from seven affected lower bounds: brute, riot, firefighter and lion lose one; armored and butcher lose three; gorilla loses five. Existing upper limits, pursuit allowances and gameplay damage remain unchanged. The corrected balance suite passes. No specification files were changed.

Final E05 simulation: 61/61 pass on the corrected merged source. [Isolated main comparison](captures/main-baseline-summary.json): L2 route test fails; L5 escort and L6 shelter readability pass alone. L5/L6 branch retries are pending.
