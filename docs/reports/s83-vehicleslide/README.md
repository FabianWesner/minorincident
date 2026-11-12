# S83: APC infected foot-slide

## Status

**Acceptance is not met.** Twelve HIGH/LOW attributed vehicle-contact fixtures pass. Native HIGH L9 passes all 72 grounded groups (max 3.3 cm, highest p95 2.8 cm), including the final reach-bound refinement. Extended LOW still has a 25.1 cm grounded maximum after the retained fixes. Native airborne transitions and L7/L4 later vehicle-contact windows are not proven. Final validation is recorded below. No deployment or push.

## Current result and remaining work

| Scope | Result |
| --- | --- |
| Attributed push, hull shove, ram, clinging, prop push and prop momentum fixtures | All twelve HIGH/LOW rows pass on retained final runtime source |
| Native HIGH L9 driving/hatch contact groups | 72 grounded groups pass; max 3.3 cm / highest p95 2.8 cm |
| Native LOW L9 driving/hatch contact groups | 80 measured groups; highest p95 3.9 cm, but actor 852 max 25.1 cm fails |
| Native airborne and one-frame attachment transitions | Unproven; no-contact rows fail closed |
| Rail stall and detour | Route progression observed, but no separately tagged grounded rail-stall row or explicit detour contact matrix |
| L7/L4 HIGH/LOW opening windows | Zero eligible contact samples; not a pass |
| Existing WebGL2 foot-slide catalog controls | 20/20 pass, no known failures or missing rows |
| Typecheck, lint, full remote unit suite and E09 verify | Pass on retained source; 106 passed / 1 skipped, 202.6/240 seconds |
| L9 route regression / threat | All eighteen route cases pass; zero L9 threat flags (diagnostic aggregate flags partial selection only) |

Full acceptance still requires fixing the LOW cheap-solver reach failure, retaining it as an attributed persistent regression, and proving the missing campaign/transition windows. No stats, corpse persistence, threat audit implementation, or source specifications changed.

Reproduce native LOW with `REVIEW_TIER=low CAMPAIGN_MOTION_FRAMES=9000 SCENE_PORT=4983 E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/scenelab/vehicle-campaign-motion.ts`. Use `npm run qa:vehicle-motion` for the twelve attributed fixture rows. The complete unfiltered/unsharded `npm run scene:gate` now includes these fixtures; the 20-row control run used an explicit WebGL2 foot-slide filter and therefore ran fixtures separately. The full unfiltered catalog was not rerun.

## Finding and change

The L9 attached-infected path repositions boarders with the APC every tick. The shared resolved-motion pass in `AgentMotion` then explicitly set their render velocity and speed to zero and did not advance gait distance. `CrowdView` uses those values to select locomotion clips and stride phase, so carried roots moved while their pose remained stationary. The pass now reports the resolved displacement for attached infected just like other actors.

The PO screenshot at `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/reports/po-slide-apc.png` was opened. It shows an infected upright beside the APC's front/side hull, with another smaller infected partly visible at the rail. The still does not identify the exact contact state or prove its root-motion history.

## Verification so far

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `sh tools/qa/l9-progress-regression.sh` — passed for all 18 path/route/seed cases.

## Remaining acceptance work

- Extend the persistent Scene Lab motion gate to directly create and measure vehicle push, hull separation, clinging/boarding, and ram knockback states. Include grab/hatch attackers, prop pushes, and crowd overlap near vehicles where those paths can move infected roots.
- Run each contact state in L9 driving, stalled-at-rail, hatch-fight, and detour contexts, plus the relevant L7/L4 vehicle scenes, at HIGH and LOW. Prove per-state p95 <= 5 cm and max <= 15 cm with sufficient foot-contact samples.
- Open and describe a consecutive-frame APC capture strip at HIGH zoom 1.5.
- L9 threat audit completed: zero skilled and passive L9 flags. The overall diagnostic command exits 1 solely for `PARTIAL_LEVEL_SELECTION`; this is not a complete campaign gate. See `threat-summary.json`.
- Run the complete requested validation set, including the remote unit suite, and commit the remaining gate/capture work when focused checks pass.

## Vehicle-contact baseline

The ram and surrounded Scene Lab fixtures now assert 5 cm p95 and 15 cm maximum and retain actor traces. Both HIGH and LOW runs fail. The aggregate p95 10.8 cm / max 19.5 cm is the courier boarding transition; surrounded infected p95 values are 1–2.5 cm, with one infected maximum 16.9 cm at frame 38. See `contact-baseline.json`. These initial fixtures do not yet prove every requested contact state occurred.

Opened the HIGH surrounded sheet: a stationary APC with four infected moving away around its hull. The catalog sheet samples every 19 frames, so it does not satisfy the consecutive-frame capture requirement.

## Contact peak investigation

The surrounded infected-3 maximum contact begins at frame 38, while its root is still at [-1, -2.5] with reported speed zero. The same contact spans the idle-to-lurch transition and subsequent movement. This points to checking pose/foot-anchor continuity before attributing that full contact displacement to vehicle shove. The gate now reports each required actor’s maximum as well as p95, preserving the aggregate checks. Typecheck passes after that harness change.

## Production vehicle AI diagnostic

`tools/scenelab/vehicle-contact-motion.ts` removes Scene Lab’s L1 search controller, matching the existing L9 APC harness. The prior catalog baseline did not do this. Both tiers now record 14 windups and 12 hull hits in surrounded and six combat hits in ram. Ram contacts pass; surrounded maximum remains 34.5 cm HIGH / 34.6 cm LOW, with p95 below 5 cm. See `native-contact-summary.json`. State-specific clinging/push coverage remains outstanding.

Opened `apc-consecutive.jpg`: HIGH zoom 1.5, consecutive frames 140–145, stationary APC with infected at its front corner and rear side. The red attack arc advances beside the hull; feet are small at this framing, so this strip alone cannot certify planted-foot quality.

## Largest production contact discontinuity

The HIGH surrounded infected-3 left toe jumps from [-1.144, 0.002, -2.705] at frame 3 to [-0.816, 0.004, -2.621] at frame 4. The root advances only millimetres while the clip changes from infected-idle to infected-lurch. This is a pose transition discontinuity rather than a 34 cm vehicle root shove. See `transition-trace.json`; subsequent lurch stance positions remain nearly fixed. No acceptance claim is made from this diagnosis.

## Resolved travel direction

CrowdView now passes the simulation motion velocity into CourierGroundContacts, whose existing travel argument plans sideways/backward steps while keeping body facing. Previously only speed reached this solver. This applies to actors with resolved simulation motion; render-sampled fallback actors retain the existing path. Typecheck and targeted lint pass. The isolated HIGH/LOW contact diagnostic remains unchanged, including its transition failure. InfectedSystem installs AgentMotion in this fixture as well; the prior inference that resolved motion was absent was unproven and is withdrawn. Actual campaign and per-state motion evidence is still required.

## Executable contact checks

The diagnostic now exits nonzero unless each infected supplies at least five contacts, p95 <= 5 cm and maximum <= 15 cm; vehicle events must prove at least six ram combat hits or four hull windups plus a durability hit. HIGH/LOW rerun completed with exit 1, retaining the surrounded failure. Targeted ESLint passed. This remains partial coverage, without clinging/boarding or all campaign contexts.

## Remote unit suite

`sh tools/remote/run.sh "$PWD" -- npm test` completed exit 0 on 46.225.66.90: 27 files passed, 106 tests passed and 1 skipped (107 collected), test-budget 204.3 s / 240 s. The complete command was run without test selection or trimming; this checkout’s count differs from the older 150-case job description. Local transcript: `/private/tmp/s83-unit.log`.

## Contact inheritance fix

Temporary instrumentation confirmed the detailed foot solver hands contacts to the cheaper solver as movement starts. No invalid-pose fallback fired. The incoming phase could already be mid-swing, so the cheap solver moved the inherited foot toward a landing immediately. GroundContacts now starts that first swing at the inherited plant. The same diagnostic passes: HIGH ram p95/max 0.3/0.8 cm; HIGH surrounded 2.7/13.9 cm; LOW ram 0.3/0.6 cm; LOW surrounded 3.5/4.0 cm. Typecheck and targeted lint pass. See `contact-after-inheritance.json`.

Reopened the updated consecutive HIGH zoom-1.5 strip: APC stationary, infected by the front corner and rear side, attack arc beside the hull. Foot detail remains small; numeric contact traces provide the measurable proof for these two fixtures. Missing push/clinging and campaign contexts prevent completion.

## Clinging coverage

Added a floor-policy driven APC fixture with infected at the actual boarding boundary (2 m lateral), followed by throttle input. Both HIGH and LOW record four vehicle.grabbed events. All four actors have zero ground contacts, so p95 is null and the gate deliberately fails; this is not a 0 cm slide pass. Attachment-relative foot motion, actual APC travel, and clearance need explicit proof before this state can pass. See `clinging-baseline.json`. Targeted lint passes.

## Attachment movement audit

Per-tick hull-relative tracing shows the clinging fixture’s APC travels exactly 0 m on HIGH and LOW despite its throttle script. Moving-cling coverage is therefore absent; the diagnostic now separately requires >=2 m of vehicle travel. The trace also reveals coincident boarder pairs: IDs 4/5 share along -1.4225, side +1.595; IDs 6/7 share along -0.7725, side -1.595. Attachment clearance rises from 0.1 m to 0.8 m, while horizontal slots stay fixed. Both the ineffective drive fixture and duplicate-side slot assignment require follow-up.

## Moving clinging fixture corrected

The driven=true fixture installed an idle pilot that overwrote scripted drive input. Using ordinary courier interaction followed by the drive command now yields four attachments and 8.76148 m of APC travel on both HIGH and LOW. The moving-attachment evidence passes. Ground-contact assertions remain red (0–1 contacts per actor), requiring a separate explicit airborne/attachment-relative pose proof. See `moving-cling-baseline.json`.

## Explicit airborne clinging proof

The settled cling window (frames 181–300) now requires all two-foot heel/toe samples on every frame, minimum ground clearance >=1.2 cm, and >=2 m travel for every foot. Four actual attachment events and >=2 m vehicle travel remain mandatory. Both tiers pass this explicit airborne proof; ground p95 stays undefined and is not represented as zero. All six current fixture/tier rows pass. See `clinging-airborne.json`. Targeted lint passes. This does not yet validate climb-transition contacts, hull-relative pose quality, duplicate slots, push states, or campaign coverage.

## Hull shove attribution

A diagnostic wrapper records actual resolved displacement for the vehicle overlap resolver’s authored 0.12 m knockback calls. HIGH/LOW ram each execute seven nonblocked shoves (maximum 0.12 m); surrounded and clinging execute none. All six current rows still pass. Ram coverage now additionally requires a resolved shove, not just combat hits. Typecheck and targeted lint passed. See `shove-evidence.json`. Separate shove-only contact windows and prop-push/campaign contexts remain unverified.

## Per-shove windows and executable entry point

`npm run qa:vehicle-motion` runs the persistent contact diagnostic under the browser lock on a default unique 49xx port. HIGH/LOW six-row run completed exit 0. Per-shove windows now retain nine frames (tick-2 through tick+6) with clip labels and independently recomputed motion. All seven ram shove windows transition into knockdown/death and contain no planted contacts: they prove reaction coverage, not standing shove slide. Separate low-speed surviving push coverage is still needed. Typecheck and targeted lint pass. See `shove-windows.json`.

## Standing reverse-push fixture

A slow reverse drive exercises 493 unique resolved hull shoves per tier on ordinary infected without stat changes. All eight current fixture/tier rows pass: standing push worst p95/max HIGH 2.9/6.1 cm, LOW 2.3/5.5 cm. Typecheck and targeted lint pass. The diagnostic hook was found to wrap itself between scenes and duplicate records; the harness now retains the original knockback method. Reported shove counts are deduplicated by tick/entity from the captured run; a rerun after the hook fix remains due. See `standing-push.json`. Campaign contexts and prop pushing remain outstanding.

## Corrected-hook rerun

`npm run qa:vehicle-motion` completed exit 0 after the hook fix. All eight rows pass. Standing push HIGH/LOW each record exactly 493 records and 493 unique tick/entity pairs: HIGH worst p95/max 2.9/6.1 cm, LOW 2.3/5.5 cm. See `corrected-hook-results.json`. This closes the pending duplicate-hook rerun, not the full objective. PropSystem inspection identifies both infected-to-prop impulse and fast-prop-to-infected momentum paths as still needing direct coverage.

## Prop approach fixture

Added a folding chair beside parked APC, between an ordinary pursuing infected and courier. HIGH/LOW chair displacement is 0.211918 m; infected p95/max HIGH 0.5/0.6 cm, LOW 0.2/0.5 cm. All ten rows pass; typecheck and targeted lint pass. The gate requires >=0.2 m prop displacement. This alone does not distinguish an infected impulse from natural settling; direct impulse attribution remains required before claiming prop-push coverage complete. Fast-prop knockback and campaign contexts also remain outstanding. See `prop-motion-baseline.json`.

## Prop impulse attribution

The harness records explicit horizontal applyImpulse calls and nearby living infected. The stationary-APC chair fixture records two such calls, both in infected contact range, at HIGH and LOW, plus 0.211918 m chair travel. Its strengthened gate passes; p95/max HIGH 0.5/0.6 cm and LOW 0.2/0.5 cm. All ten current rows pass. Typecheck and targeted lint pass. See `prop-impulse-evidence.json`. Fast-prop momentum knockback, broader actor variants, and campaign contexts remain unverified.

## Fast-prop momentum fixture

The fixture launches a production kickable folding chair via PropSystem.kick beside the APC, without changing actor stats. Both tiers record prop.momentum at tick 8, 1.2 m authored knockback, positive damage and a surviving infected. Grounded p95/max HIGH 0.2/0.4 cm, LOW 0.2/0.2 cm. The focused two-row run passes; typecheck and targeted lint pass. `VEHICLE_MOTION_SCENE=prop-momentum npm run qa:vehicle-motion` selects it; unknown scene filters fail. See `prop-momentum-evidence.json`. The full twelve-row rerun and campaign context coverage remain due.

## Full twelve-row rerun

`npm run qa:vehicle-motion` completed exit 0 with all twelve fixture/tier rows passing. Receipt: `full-contact-gate.json`. These are isolated production-system fixtures, not the requested campaign-context matrix. Native campaign rendered soles are available through GameView.crowdFigures(), enabling the next sampler without substituting isolated actors.

Completion is still unproven: L9 driving/rail stall/hatch/detour and L7/L4 runtime contacts at HIGH/LOW need native motion traces; hull separation and crowd resolution need direct attribution; climb transitions and duplicate boarder slots need review. Final full validation must be rerun after the shared GroundContacts change (the recorded remote suite and L9 route/threat receipts predate it).

## Native campaign sampler

Added `tools/scenelab/vehicle-campaign-motion.ts`, which loads a native L9/L7/L4 mission, runs the production completion bot, samples GameView.crowdFigures rendered soles near actual vehicle hulls each tick, and groups contacts by actor and attached/hull-ground state. Empty coverage exits nonzero. The 1800-tick HIGH L9 opening observation completed with zero eligible samples (exit 1), so it establishes no campaign contact pass. Typecheck and targeted lint pass. The sampler needs later route/checkpoint windows and mission/vehicle progress context next. See `native-opening-sample.json`.

## Native L9 failure exposed

The empty observations were affected by missing renderer.nextNodeFrame() calls during repeated fixed-step rendering: draw flags were stale. Advancing the node frame like Scene Lab now yields 123 eligible samples from five infected in the first 1800 native L9 ticks. The bot is driving and reaches about [-347,-250]. Actor 760, clip dog-gallop, frames 1531–1540 beside the hull, has measured p95 27 cm and max 66.2 cm. This contradicts completion despite isolated fixture passes. The native sampler now applies 5/15 cm failure limits. See `native-l9-driving-failure.json`. Prior no-sample observations do not establish absence of contacts. The context sampler typechecked; targeted lint passes after the draw-frame and threshold update.

## Native gallop LOD investigation

The sampler now records archetype and LOD. The failing actor is infected.dog at LOD2 with two sole pairs. An experimental global LOD1 override reduced p95/max to 20.2/26.8 cm but did not fix it and was removed. Probe initialization now also recognizes declared animalSoles, matching CrowdLocomotion; the native LOD2 result remains 27/66.2 cm, so this actor still lacks a four-paw declaration or uses a reduced rig. The measurement needs rig/asset inspection before claiming the true paws slide by that amount. No LOD behavior change is retained. Typecheck passed for added sampler metadata; targeted lint passes. See `native-dog-lod-trace.json`.

## Late-spawned L9 dog cast fix

GLB inspection confirms all dog tiers include four paws and sole metadata; the failing actor is full-health infected.dog, variant inf.dog, with no severance. L9 initializes its render cast before that pack spawns, leaving the dog aliases absent and rendering a runner fallback with dog-gallop. Registering the existing dog rig and coats in the L9 planned cast fixes that mismatch without stat or LOD changes. Native 1800-tick HIGH/LOW observations now show four paw pairs and 0/0 cm dog p95/max. HIGH grounded rows max at 0.3 cm; LOW at 0.4 cm. LOW still fails the sampler because of one attached no-contact frame: no aerial proof is inferred. Typecheck and targeted lint pass. Capture review of the dog fix and later campaign contexts remain due. See `l9-dog-cast-fix.json`.

## Native dog capture review

Added optional CAMPAIGN_CAPTURE_FROM to the native sampler. The 1800-tick HIGH rerun with capture frames 1531–1536 completed exit 0; targeted lint passes. Opened `native-dog-consecutive.jpg`: native APC drives diagonally across a grassy verge beside a road, small brown dog beside the front corner, upright infected farther ahead in the headlight beam. Feet are too small to judge individual plants visually; four-paw quantitative traces carry that proof. The strip confirms native context and corrected quadruped appearance, not completion of every contact state. See `native-dog-capture-summary.json`.

## Extended native rail/hatch observation

The HIGH L9 native completion bot was observed for 9000 ticks. It produces 14,120 contact samples across 82 actor/context groups, reaches rail stall at tick 6095, samples hatch combat, and restarts before tick 9000. Six grounded groups fail: four late-spawned zebras (two-foot fallback traces, maxima up to 459.8 cm) and two bathrobe-variant sprinters (maxima 30.2 and 22.5 cm). The native command exits 1. This contradicts full completion; next work must inspect the late zebra cast and the two sprinter contact intervals. See `native-l9-rail-failures.json`.

Current-source full typecheck and lint pass. Remote complete npm test passes on 94.130.181.173: 27 files, 106 passed/1 skipped, test-budget 221.6/240 seconds, exit 0. Transcript `/private/tmp/s83-final-unit.log`. These code checks do not override the failing native motion evidence.

## Late zebra cast baseline

L9’s dry-shortcut controller spawns zebras after cast initialization, so their existing render role is now registered alongside the dogs. Native HIGH rerun has four hoof pairs, confirming the fallback is gone, but zebra motion still fails: p95/max up to 44.8/530.8 cm on actor 858 and 108.2/140.3 cm on actor 804. The two sprinter maximum failures remain 30.2 and 22.5 cm. Typecheck and targeted lint pass. Correct-species rendering is retained; these are failing hoof-contact traces requiring an actual locomotion fix, not a completed motion acceptance. See `zebra-cast-baseline.json`.

## Stampede contact root cause fixed

Zebra-stampede was absent from strides, so present() skipped procedural correction and moving zebras held their hooves. Adding its stride activates the existing paw solver; a separate full distance-driven contact phase avoids using the restricted attack-body phase as a gait. Native HIGH 9000-tick rerun now gives zebra p95 0.3–0.4 cm and max 0.7–0.9 cm across four groups (26–175 contacts each). Two sprinter maxima remain 30.2/22.5 cm, so the native command still fails. Typecheck and targeted lint pass. LOW verification and capture review of this visual fix remain due. See `stampede-contact-fix.json`.

## Sprinter discontinuity investigation

A tested change transferring detailed contacts on budget denial instead of fading them had no effect on the known native failures and was removed. Actor 888 still measures 30.2 cm max, with 14.7 cm and 12.5 cm consecutive grounded-foot jumps at frames 8835–8836; actor 918 still measures 22.5 cm max, with 6.4/7.9/8.2 cm jumps at frames 8739–8741. All are within shamble at LOD2, not clip-switch frames. See `sprinter-discontinuities.json`.

Opened the native HIGH zoom-1.5 strip at frames 8834–8839 (local `test-results/s83-vehicleslide/campaign/L9-high-consecutive.jpg`): damaged APC at a roadside structure, dense infected and several zebras around its front/side. Individual feet are too small to identify the exact discontinuity visually. Next evidence must compare actual rendered feet with stored contact targets and IK reach. No speculative budget patch is retained.

## Inner-reach pelvis correction

Joint traces show the remaining sprinter swing targets inside the leg’s minimum reachable distance: unequal loaded thigh/shin lengths cannot fold far enough. The pelvis solver now computes an inner-reach lower bound from the actual world-space segments, including flight when neither foot is locked. A supporting-foot upper bound still limits reach. This is shared contact behavior; no infected stats or corpse lifetime changed.

Native HIGH L9, 9000 ticks: all 72 grounded groups pass, maximum 3.4 cm and highest per-group p95 2.8 cm. Actor 888 improves from 30.2 to 1.6 cm max; actor 918 from 22.5 to 1.8 cm. Ten no-contact groups still fail closed: knockdown/pounce exclusions or airborne attachments, including one-frame transitions. They are not reported as zero slide. See `inner-reach-high.json`.

The complete twelve-row attributed contact fixture rerun passes (`final-contact-gate.json`). Full remote npm test passes on 46.225.66.90: 106 passed / 1 skipped, 202.0 seconds within 240 seconds, exit 0 (`/private/tmp/s83-unit-final2.log`). Full typecheck/lint pass before the gate integration edit. The ordinary unfiltered, unsharded `scene:gate` now also runs the attributed HIGH/LOW vehicle fixture gate; filtered or sharded catalog diagnostics remain scoped to their selection. The complete 87-row catalog has not been rerun with this change.

Final L9 threat diagnostic again has zero L9 flags; its aggregate exit 1 is solely PARTIAL_LEVEL_SELECTION. Route regression is still running at the time of this entry. Native fixed-frame capture and LOW/L7/L4 observations are next.

Opened `inner-reach-consecutive.jpg`: native HIGH, zoom 1.5, consecutive frames 8834–8839 after both the stampede and pelvis corrections. The damaged APC is beside a road structure, with zebras along its left/front hull and upright infected to the right/front; smoke partly obscures the grille. The relative crowd positions change continuously across the strip, with no visible large snap. Individual feet remain small, so the 72-group quantitative trace establishes the measured slide bound. This one small sheet reviews both visual corrections.

The final L9 route regression completed exit 0 across all eighteen path/route/seed cases. Full typecheck/lint also pass after integrating the contact gate. Required per-epic E09 verification is now running remotely.

## Extended LOW and neighboring level coverage

The native LOW 9000-tick run fails: attached actor 852 p95/max 15.2/35.9 cm, attached 863 p95 10.1 cm, grounded 852 max 25.1 cm and grounded 681 max 18.8 cm. See `native-low-final.json`. These override any earlier LOW opening pass. Standing windup peaks show repeated foot travel while roots remain still; a budget-loss contact transfer is under test, not yet accepted.

L7 HIGH/LOW and L4 HIGH/LOW 3600-tick native opening observations all have zero eligible contact samples. L7 has no registered cars; L4 has six but none overlaps the sampled infected. These runs exit 1 and establish no vehicle contact pass (`l4-l7-opening-observations.json`). The renderer changed during this diagnostic batch, so these are coverage observations only, not fixed-source validation. Later authored vehicle windows or explicit level-native fixtures remain required.

Remote E09 verify failed its two scene-gate integration fixtures: fake repositories lacked the newly required qa:vehicle-motion script. The fixture now supplies a fake child and also asserts failure propagation and filtered scope, without changing the test count or production gate criteria. Focused tests and verification rerun remain due.

## LOW standing-contact transfer

When detailed admission is lost, transfer grounded standing contacts as well as walking contacts instead of fading them toward the baked pose. The cheap solver now holds both standing feet; transitions retain world anchors. Native LOW rerun reduces attached 852 from 15.2/35.9 cm p95/max to 0/0.2 cm, and attached 863 from 10.1/12.9 cm to 0.1/2.1 cm. Every finite-contact group now has p95 <=3.9 cm, but grounded maxima 25.1 and 18.8 cm remain failures. See `low-standing-transfer.json`.

All twelve attributed fixture rows pass after this change. Typecheck/lint pass. Opened `low-standing-transfer.jpg`, consecutive native LOW frames 8426–8431 at zoom 1.5: APC beside the rail and yellow bus, infected at the hull and a large infected on the road. The visible attacker poses remain stable across the alternate-frame updates; the small feet require the numerical contact trace for measurement. No HIGH claim is inferred from this LOW strip.

Focused gate-tools tests pass 8/8 after the integration fixture update. E09 verification rerun is still running remotely.

## Remaining LOW grounded peaks

When inner/outer pelvis bounds conflict, prioritize the minimum reachable distance. The fixed-source LOW 9000-tick rerun removes actor 681’s 18.8 cm failure without new finite-contact failures. Actor 852 still fails at 25.1 cm max / 2.9 cm p95 (`reach-priority-low.json`). A separate cheap-solver travel-direction experiment worsened it to 28.3 cm and introduced three other maximum failures; that experiment was removed completely. No cheap travel-direction change is retained. HIGH validation, contact fixtures and catalog controls for the retained bound priority remain in progress.

The corrected remote E09 verification passed on 94.130.181.173: full unit suite 106 passed / 1 skipped, test-budget 227.0/240 seconds, exit 0 (`/private/tmp/s83-verify-final2.log`). A final verification is running for the retained one-line reach-bound refinement.

The remaining LOW actor 852 peak is in the cheap ground-contact solver: stored stance/swing targets extend beyond the loaded leg’s reach, while rendered IK clamps the shoe and it travels within the floor-contact band. At frame 8886 the right target is about 0.85 m from the upper joint versus approximately 0.80 m total segment length. Fixing admission fade does not fix this reach failure; it needs an early lifted release/replanning rule rather than longer allowed slide or a metric exemption. Native world trajectory and stats were not changed.

## Final reach-bound HIGH validation

Retained source passes all 72 finite-contact HIGH native L9 groups over 9000 ticks: max 3.3 cm, highest p95 2.8 cm. No-contact airborne groups remain fail-closed, so the native command still exits 1. See `reach-priority-high.json`. Reopened the updated `inner-reach-consecutive.jpg` after the final bound priority: same HIGH zoom-1.5 frames 8834–8839, damaged APC with zebras along its left/front hull and upright infected beside the grille. No large snap is visible; small/occluded feet still require the contact trace. This replaces the earlier sheet for this same fix.

Final WebGL2 foot-slide catalog controls and per-epic verification are running.

## Final validation receipt

Retained runtime source plus the reach-bound priority passes remote `npm run verify -- E09` on 46.225.66.90: typecheck/lint pass; 27 test files pass, 106 passed / 1 skipped, test budget 202.6/240 seconds, exit 0. Transcript `/private/tmp/s83-verify-final3.log`. The explicitly requested remote plain `npm test` also passed earlier (`/private/tmp/s83-unit-final2.log`); E09 includes the same complete suite on final runtime source.

`SCENE_PORT=4983 npm run scene:gate -- --backend webgl2 --jobs 1 --filter 'foot-slide-*'` passes 20/20 rows, zero known or missing rows, in 2.5 minutes (`final-motion-controls.json`). WebGPU was not automated. Final attributed vehicle fixture rerun is still pending at this entry.

Final attributed fixture rerun completed exit 0: all twelve HIGH/LOW rows pass after the reach-bound priority (`final-contact-gate.json`). One final native LOW diagnostic is being retained to confirm actor 852’s remaining peak on this same source.

L7 coverage diagnosis: `LevelSevenDeparture.install()` spawns the evacuation bus through `spawnSetPiece` and stores `state.busId`; it is not a `Vehicles.cars` entry. The native sampler only selects hulls from that registry, so its zero L7 samples are also a selector blind spot. Extend the observer to set-piece vehicle hulls (and wrecked/static hulls where relevant) before claiming L7 coverage; merely waiting longer is insufficient. L4 does have six registered cars but the opening bot window gives no contact samples.

## Time-box closeout — acceptance not met

Final native LOW reproduction on committed runtime `84684ffd` confirms exactly one finite-contact failure among eighty measured groups: actor 852, infected.sprinter / inf.suburban-mom, driving/hull-ground, p95 2.9 cm and max 25.1 cm at contact start frame 8885. The highest p95 across all finite groups is 3.9 cm. No-contact transition groups still fail closed. `final-low-failure.json` includes the final group results, progress and fourteen consecutive diagnostic frames. At frame 8886, left/right target distances are 1.008/0.849 m versus actual segment sums 0.778/0.805 m; corresponding ankle errors are 23.03/4.45 cm. This proves an unreachable cheap-solver target, not a threshold or visual-size artifact.

Retained changes are committed through `84684ffd`; all final focused checks are terminal. Twelve attributed contact fixtures and twenty WebGL2 motion controls pass; E09 verify passes (typecheck, lint, complete 106-pass/1-skipped suite); eighteen L9 route cases pass; L9 threat has zero level flags. HIGH consecutive capture is opened/described above. These passes do not satisfy the remaining 15 cm LOW maximum bar.

Open work at the ~2.5-hour time box: safely release/replan cheap contacts before targets become unreachable, add that failure to persistent attributed coverage, measure L7 set-piece/static hulls and L4 actual contact windows, prove rail-stall/detour and one-frame boarding/climb transitions, and independently attribute crowd-overlap resolution beside hulls. No human-only blocker is claimed. No push, deployment, main movement, stat tuning, corpse removal, source-spec edits or threat-tool edits occurred.

## Goal continuation: cheap-solver reach recovery

Resumed from the committed LOW failure. The cheap solver held its stance/swing target after a resolved shove exceeded the leg’s reachable distance. It now releases support before that margin is exhausted; an overextended recovery target lifts above the floor and stays inside actual loaded leg reach, rather than letting IK clamp a travelling shoe on the ground. This is shared presentation behavior, with unchanged simulation stats and corpse lifetime.

The original-selector LOW 9000-tick rerun now passes all eighty finite-contact groups: max 5.1 cm, highest p95 1.3 cm (`recovery-low.json`). It still exits 1 for no-contact airborne/transition groups, which are not reported as zero slide. Opened the local consecutive LOW frames 8885–8890 at zoom 1.5: smoky APC beside the rail and yellow bus, infected crowd at the front/left hull and a large infected on the road. No gross foot snap is visible, but small feet and smoke mean the quantitative track carries the measurement. Broader hull coverage and HIGH validation are running.

The campaign observer now includes registered traffic/convoy/set-piece hulls and static vehicle collider placements, records which hull was sampled, tags overlapping driving/detour/rail-stall/hatch contexts, streams progress every 300 frames, and fails if the runtime source hash changes during observation. L9’s native complete bot explicitly uses the road detour (`testApi.ts` constructs `LevelNineBot(..., 'road', true, ...)`). These additions correct observer blind spots; no simulation changes are involved.

## Expanded recovery stress gate

Added `reach-recovery` to the persistent attributed gate: six sprinters use the three native failing body variants beside a slowly reversing APC, with the detailed presentation budget exhausted. It requires at least 120 frames with all six actors in the cheap solver, real resolved hull shoves, and the unchanged 5/15 cm contact limits. The first run correctly fails on suburban-mom bodies: HIGH max 96.9 cm / highest p95 28.4 cm, LOW max 95.4 cm / highest p95 25.5 cm. Delivery-driver and bathrobe bodies stay below 2 cm max. Thus the earlier eighty-group native-window pass is insufficient for completion.

The cheap solver now also enforces the inner reach bound for unequal loaded leg segments, rather than only lowering the pelvis toward unreachable targets. Its HIGH/LOW stress rerun is pending. The horizontal-release correction preserves the original changing-support unit assertion; a new overextended-shove assertion was added within that existing test (test count unchanged). Focused render-contract tests pass 14/14.

The complete remote npm test after the horizontal-release correction passes (46.225.66.90, 106 passed / 1 skipped, 204.7/240 seconds, exit 0, `/private/tmp/s83-recovery-unit2.log`). The newer cheap inner-reach refinement still needs complete validation.

The expanded campaign selector initially omitted `vehicle.*` drivable IDs while retaining only `veh.*` set pieces; that run has zero samples and is not a pass. The corrected selector checks every registered hull and explicitly rejects a missing drivable car. A fixed-source HIGH rerun with the outer-recovery correction measures all 72 grounded groups: max 3.3 cm / highest p95 2.8 cm, plus 11,577 separation and 3,376 collision corrections in sampled frames. Driving/detour have 14,120 samples; hatch and rail-stall overlap in 48 samples. These predate the latest cheap inner bound.

## Cheap inner-reach recovery verified

The budget-exhausted sprinter regression now passes HIGH and LOW: max 2.3/4.5 cm, highest p95 1.6 cm at both tiers. All six infected are drawn/in view for all 300 frames, the cheap solver is directly witnessed, and actual vehicle shoves occur (`cheap-recovery-stress.json`). The shared cheap solver now respects both ends of the loaded leg’s reach: release/lift overextended steps and keep the pelvis outside the inner sphere. The original changing-support assertion still passes unchanged; recovery assertions and verdict negative controls extend existing tests without increasing the test count.

Opened `cheap-recovery-consecutive.jpg`, HIGH zoom 1.5, consecutive frames 146–151: reversing APC in the night slab with small infected clustered at its front/side. The bodies are visible but feet are too small at the sheet scale to certify gait visually; actual rendered sole traces carry the quantitative bound. This one small sheet documents the combined cheap-solver correction.

The original six runner ram targets die, so that row alone does not prove living knockback. A new native butcher row uses ordinary reverse input: forward full-speed contact killed even their native 1350 HP; reverse contact lets all six survive without stat overrides. Both tiers now directly witness a vehicle-hit-correlated resolved impulse, positive remaining health, actual root motion, and multiple advancing frames of the heavy reaction clip. The vehicle impulse is instantaneous (one tick), not the shotgun’s multi-tick slide component. Grounded/recovery contact checks pass. The full contact gate now has sixteen rows; the separate reverse-ram rerun replaces the initial lethal-only survivor attempt.

E09 verify passes with the cheap inner-reach runtime (207.7/240 seconds in the complete unit suite). New canonical verdict tests additionally reject floating locomotion, missing/incorrect feet, stale or absent reactions, and planted special-move slide; the Leaper’s deliberate .22-phase resting crouch remains measured as ground contact, never an air exemption. Final native matrix validation remains open.

## Final attributed contact gate

The complete sixteen-row HIGH/LOW contact gate passed in one run, including every boarding frame and six living reverse-ram survivors at each tier. `final-contact.json` records per-actor limits and attributed witnesses. Opened the refreshed HIGH zoom-1.5 APC strip (frames 140–145): the whole vehicle is visible with infected by the front wheel and left rear and a progressing hull-attack arc; no gross foot snap is visible. The refreshed cheap-recovery strip (146–151) shows the reversing APC with attackers mostly occluded by its grille; it cannot independently certify feet. Both sheets are native-resolution crops of the headless capture, with no camera or simulation change.

Final plain remote npm test passes: 106 passed / 1 skipped, 200.2/240 seconds. E09 verify also passes (full suite 201.5/240 seconds). Local typecheck/lint pass. L9 route regression passes all eighteen cases; the L9 threat audit has zero level flags (aggregate exit 1 solely for partial campaign selection).

Native L9 LOW passes all eighty grounded groups, max 5.1 cm / highest p95 1.3 cm. HIGH numerical contacts pass, max 3.3 cm / highest p95 2.8 cm; one correction window ended within lifted recovery. Correction sampling now includes half a second either side to measure the landing with the same 5/15 cm limits. The complete native matrix rerun and twenty motion controls are queued. Native soldiers may kill/occlude a staged actor immediately: scene coverage requires two sustained moving actors (>=60 observed frames and >=20 cm travel), all rendered tracks still undergo numeric/pose validation, and all staged entities must persist. A whole-window root audit separately proves stationary actors rather than inferring stationarity from a short render window.
