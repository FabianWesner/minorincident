# s55-lionmotion: investigation in progress

Date: 2026-11-11

## Current candidate summary

The motion defects found are: healthy zoo animals entered humanoid lean layers;
continuous crowd skins missed the live-skin paw path; support correction could
drop/release the pelvis abruptly; clip fades re-solved already corrected poses;
and healthy cats lost their stalk crouch at a hard speed threshold.

The candidate fixes those render paths without asset or simulation-stat edits.
The full objective is **not yet accepted**: the full remote unit suite and
62-row scene gate now pass, but the consolidated acceptance audit and complete
real-fixture comparison coverage remain.

| Measurement | Before | Current measured after | Scope |
| --- | ---: | ---: | --- |
| Maximum pelvis frame step | 98.05 cm | 0.37 cm | Controlled centered cat 10 s walk + 5 s run |
| Speed-threshold pelvis step | 4.40 cm | 0.37 cm | Healthy cat, same walk clip |
| Real L8 pelvis step, lion | 95.69 cm | 0.83 cm | Same 15 s fixture/probe |
| Real L8 pelvis step, lioness | 100.80 cm | 0.56 cm | Same 15 s fixture/probe |

All 16 centered cat backend/tier/zoom configurations drew 900/900 frames, with
zero measured sole penetration and zero reported run jitter. These summaries
are evidence with the detailed limits recorded below, not a completion claim.


## Scope

Investigate flicker reported for the L8 lion and lioness. Motion only; model assets
are outside this lane. The current candidate and measurements are summarized above. The sections below
are a chronological investigation log; earlier limitations and claims are
superseded where later measurements explicitly correct them.

## Current evidence

Read `CrowdView`, `MotionPresentation`, `GaitPhase`, `AnimalMoves`,
`CrowdLocomotion`, and `PawContacts`. Locomotion uses distance-integrated gait
phase, fractional pose-atlas frames, and interpolated root position/yaw. The
animal night-read setting is assigned as a material uniform during batch setup;
the inspected path does not toggle it per frame.

Simulated the `tests/fixtures/saves/qa/l8-before-lion.json.gz` fixture for 900
ticks (15 s), with the player stationary. This is a simulation-only baseline,
not the requested rendered L8 measurement:

| Actor | Max root step / tick | Max yaw step / tick | Max speed | Moving ticks |
| --- | ---: | ---: | ---: | ---: |
| lion (entity 397) | 0.01645 m | 0.0750 rad | 0.9867 m/s | 841 / 900 |
| lioness (entity 410) | 0.01664 m | 0.1967 rad | 0.9985 m/s | 699 / 900 |

For each actor the largest translation step equaled the expected `speed / 60`
(maximum ratio 1.0). This does not show a root-position pop. The lioness's
maximum yaw step is an investigation lead, not proof of rendered flicker; the
renderer limits crowd heading to 6 rad/s and needs to be measured in-browser.

## Validation attempted

- `npm run typecheck` and `npm run lint` completed without reported errors.
- `sh tools/remote/run.sh "$PWD" -- npm test` could not run: no healthy Hetzner
  runner was available, and the configured Mac fallback rejected the command.
- Headless Scene Lab capture was attempted through `tools/e2e-lock.sh`. The
  browser pool could not bind its local port (`listen EPERM`); the legacy lock
  path was also blocked because the sandbox denies `ps` to `mac-gpu-guard.py`.
- `npm run scene:gate` and the requested before/after capture matrix therefore
  remain unrun. No images or frame strip were produced.
- `tools/ops/slim-worktree.sh "$PWD"` was attempted as required. Git could not
  update `.git/worktrees/s55-lionmotion/config.worktree` under the sandbox.

## Next work required

1. Obtain an authorized headless browser and runner slot; capture 10 s walk and
   5 s run with root position, yaw, and pose index in Scene Lab and the real L8
   fixture, including the requested zoom/tier/backend matrix.
2. Inspect a contact sheet and compare frame-to-frame jumps with this
   simulation-only baseline. Check the other zoo species with the same metric.
3. Confirm the cause, make the motion-side fix, rerun before/after measurements,
   run the required test and scene gates, and update this report before commit.

## Continuation: browser access restored

The required slim step succeeded after sandbox restrictions were lifted. A
headless WebGL2/high baseline run through `tools/e2e-lock.sh` on port 4951
produced shots at frames 10, 25, and 40 in
`test-results/s55-lionmotion/before/`. Frame 40 was opened: the walking/running
cats show distinct limb poses alongside the idle animals. This single-frame
inspection cannot establish smoothness. The run failed while producing the
video/contact sheet with `browserContext.newPage: Target page, context or
browser has been closed`; it reported no console errors. The 900-frame trace,
complete video, before/after metric, and confirmed cause remain outstanding.

## Focused 900-frame probe

`tools/qa/s55-lionmotion/probe.ts` completed a headless WebGL2/high run without
video/sheet creation and wrote `test-results/s55-lionmotion/probe/metrics.json`.
It exposes a baseline-fixture problem: both infected actors in
`r36-lion-cats-run.json` remained stationary for all 900 frames, with speed zero
and clip `infected-search`; the healthy actors were idle. The scene's declarative
walk/run state therefore does not currently exercise locomotion. Its screenshots
must not be treated as walking/running evidence. The next probe must explicitly
establish movement and assert nonzero travel before measuring continuity.

## Controlled moving baseline

The focused probe now asserts travel and applies a controlled simulation-tick
trajectory to two healthy cats: 600 ticks at 1 m/s followed by 300 at 3.2 m/s.
The completed 900-frame WebGL2/high run recorded 25.9833 m of travel per actor.
This establishes an actually moving render fixture after both declarative scene
paths and direct zoo waypoints failed to move actors in isolated Scene Lab.
Existing motion summaries report zero grounded contacts and 9.6 cm maximum sole
lift for both cats. These summaries are insufficient to prove continuity; the
next step is to record presented root/yaw and joint pose changes per frame.
No gameplay fix or confirmed flicker cause has been established.

## Per-frame pose trace and probe correction

The probe now saves all 900 presented crowd joint/phase samples in `frames.json`.
Its original phase-0 trajectory was followed by simulation cleanup that overwrote
motion with idle data. Moving the controlled trajectory to phase 1000 establishes
both travel and the production walking animation. The completed run reports 66
contact samples per cat, maximum planted-foot slide 5.3 cm, and maximum contact
yaw drift 0.1 degrees. Healthy cats select `walk` even at the 3.2 m/s segment.
The prior moving-root run therefore did not verify a walking animation and must
not be treated as its baseline. The cause remains unconfirmed; the saved joint
trace is now available for frame-to-frame discontinuity analysis.

## Confirmed solver discontinuity and candidate fix

The controlled trace shows a smooth root but a 0.98048 m one-frame pelvis jump
for both cats; the torso/head/tail follow it. PawContacts lowers the pelvis to
reach an overextended planted target and removes that correction at stance end.
Continuous-skin handling was gated on `root === template`, excluding private
crowd pose skeletons. Enabling that path alone reduced the maximum jump only to
0.73266 m. The candidate additionally bounds continuous-skin support correction
to 8 cm and eases it at 0.5 m/s across stance boundaries, treating unreachable
support as a catch-up step. A completed repeat of the same 900-frame probe gives
0.0083334 m maximum pelvis change for each cat (98.05 cm -> 0.83 cm).

This is a candidate source fix, not completion: real L8, other species, full
backend/tier/zoom captures, and regression gates remain outstanding. The raw
before trace is `test-results/s55-lionmotion/before-frames.json`; current after
trace is `test-results/s55-lionmotion/probe/frames.json`.

## Broader validation

Typecheck passed. The required remote `npm test` completed exit 0: 27 files,
106 passed and 1 skipped, with the repository case budget 150/150. Test duration
was 158.81 s (wrapper 161.5 s).

The expanded controlled WebGL2/high probe completed 900 frames for lion,
lioness, zebra, gorilla, elephant, and flamingo, each traveling 25.9833 m with
zero measured sole penetration. Monkey is still missing because the isolated
scene schema rejects a healthy monkey actor. Raw traces are under
`test-results/s55-lionmotion/zoo-after/`. This is not a visual acceptance result.
The two-cat trace still contains a 0.2474 m maximum root-relative forepaw step
(after 0.5690 m before); the pelvis improvement alone does not establish smooth
paws. Further solver analysis is required before completion.

## Lift-off correction

The remaining forepaw step occurs as stance ends while a catch-up step is still
between endpoints. Swing used the planted target instead of the last drawn paw.
The candidate now starts swing from that last drawn point. A completed six-species
900-frame repeat is saved at `test-results/s55-lionmotion/zoo-swing/`. During the
comparison, lioness forepaw maximum fell from 21.7 to 13.2 cm and elephant from
43.7 to 19.8 cm; final maxima and speed-normalized continuity still need analysis.
The shared source changed after the passing remote suite, so those tests must be
rerun for the final candidate. No completion claim is made.

## Opened frame strip

The probe can now capture consecutive canvas frames without the CLI video/sheet
context failure. Opened `test-results/s55-lionmotion/cats-capture/sheet.jpg`, six
consecutive frames at the walk-to-run transition, WebGL2/high zoom 1.5. Both cats
remain visible with steady body silhouettes across the strip; their small size
in this sheet does not support detailed paw acceptance. An earlier all-species
strip cropped the cats and was rejected. Full-scale crops and longer motion
inspection remain necessary. The completed numeric trace's largest cat paw
steps are ~14.5 cm at run speed, so this is not yet a no-pop acceptance result.

## Real L8 rendered fixture

Added `fixture.ts`, loading the real `l8-before-lion` resume and stepping normal
simulation for 900 frames. Camera framing was corrected after an initial run
rendered neither cat. With the enclosure centered, both cats appeared in 840
samples. Maximum pelvis step was 0.00844 m for lion and 0.0800 m for lioness;
root-relative paw steps reached 0.1182 and 0.2363 m respectively. Thus real L8
still contradicts a complete smoothness claim. The candidate now carries its
support offset across LOD handoffs and eases it out in standing hold, since
walking-to-idle previously removed the full 8 cm correction. This latest change
needs its repeat measurement and regression checks.

## Avoid duplicate support during clip fades

A real-L8 repeat exposed the walk-to-idle drop applying twice: the outgoing
corrected pose is already lowered when blended, then PawContacts subtracts its
support offset again. Support now constrains the hip to a rest-height ceiling
instead of subtracting the offset from an already corrected pose. The completed
900-frame real-L8 repeat reduced the lioness maximum pelvis step from 8.00 cm
(original stop behavior) to 0.9071 cm; lion measured 0.8444 cm. Restore bookkeeping
records the actual amount applied, preserving live actor restore behavior.
Paw continuity, all requested matrices, and final checks remain outstanding.

## WebGPU low real fixture

Both probes now accept backend/tier configuration and the controlled scene also
accepts zoom. The real fixture completed 900 frames on WebGPU low. Maxima match
WebGL2 high: lion pelvis 0.8444 cm / paw 11.815 cm, lioness pelvis 0.9071 cm /
paw 23.634 cm. The shared remaining paw maximum occurs at frame 257 and still
needs investigation. This backend comparison does not replace the full visual
matrix or prove absence of pops.

## Rejected elevated-paw handoff experiment

A temporary change preserved the elevated last paw target when idle resumed
walking and retained its Y during swing. The completed real L8 repeat reduced
lion maximum root-relative paw step to 9.16 cm but increased lioness to 30.51 cm
(from 23.63 cm), while pelvis maxima stayed below 1 cm. The source experiment
was reverted. This result rejects a contact-height-only fix and leaves the
idle-to-walk ankle target/orientation conversion as the next investigation.
`l8-after/frames.json` currently contains the rejected experiment; the accepted
candidate's comparable trace remains `l8-webgpu-low/frames.json`.

## Reproducible discontinuity analysis

Added `analyze.ts <frames.json> [...]` to calculate root translation, root-relative
pelvis vertical step, root-relative paw step, and worst clip transition. Applied
to the accepted WebGPU-low L8 trace: lion root max 0.745 cm, pelvis 0.844 cm,
paw 11.815 cm at frame 657 (`walk->walk`, handR); lioness root max 1.664 cm,
pelvis 0.907 cm, paw 23.634 cm at frame 257 (`idle->walk`, handR). This localizes
the remaining problem beyond root translation. Scratch-vector review did not
establish an alias bug in placeAnkle/solve. No further source fix was accepted.

## Rejected solve-weight experiment

Tested easing the three solved limb rotations over the 0.12 s catch-up interval
when leaving hold. The full real-L8 repeat increased lioness maximum paw step
to 38.46 cm at frame 264, versus 23.63 cm for the accepted candidate; lion was
unchanged at 11.82 cm. The experiment was reverted. A simple rotation fade does
not maintain contact/pose consistency during the transition. Current `l8-after`
artifacts contain this rejected run; `l8-webgpu-low` retains accepted evidence.

## Solve incoming animal pose before clip fade

The animal path now optionally solves contacts on the incoming atlas pose before
TRS blending with the outgoing displayed pose. Previously the already-corrected
outgoing pose was blended first and then sent through contact correction again.
The default human path retains its order. A completed 900-frame real-L8 repeat
reduces lioness maximum paw step from 23.634 cm at idle->walk to 13.001 cm within
walk; lion remains 11.815 cm. Lioness pelvis maximum is 1.111 cm. This validates
the transition-order diagnosis but does not yet prove final visual smoothness.
The latest `l8-after` trace is this accepted candidate. Shared palette changes
require final finite-clip and regression validation.

## Preliminary scene gate and lint

Lint passed for the current candidate. Started the required 62-row scene gate on
port 4952. Both WebGL2-low batches passed (16/16), including
`night-boss-lion@low-z1.5`; the first four WebGPU-high rows also passed, including
zoo staff. Stopped this preliminary run intentionally (exit 130) because the
known touchdown discontinuity still requires source changes; it is not a 62/62
result and the full gate remains required for the final candidate. Log:
`test-results/s55-lionmotion/scene-gate.log`.

The accepted L8 trace localizes both remaining paw maxima to the foreleg phase
wrap near 0.5, within `walk`, pointing to touchdown handling after the clip-fade
fix. No additional solver change was made in this continuation.

## Authored-joint comparison

Rejected the touchdown catch-up experiment: lion paw maximum increased to
27.53 cm (lioness 18.15 cm). Reverted that experiment. Tested the existing
preserve-authored-joints path for continuous crowd animal skins, avoiding a
second paw IK solve over the already baked skin animation. The complete real
L8 repeat gives zero root-relative pelvis jump for both cats, with paw maxima
7.247 cm (lion) and 10.553 cm (lioness), compared with 11.815/13.001 cm for the
prior corrected solver. This is a new candidate requiring ground-contact and
visual validation, not final acceptance. `l8-after` now holds this comparison.

## Reject authored-joint bypass on contact quality

The full controlled two-cat repeat with authored-joint preservation measured
95.4 cm / 92.3 cm maximum planted-foot slide, 32 cm lift and 4.9 cm penetration.
This contradicts acceptable ground contact despite its stable pelvis. The bypass
was therefore reverted, and prior PawContacts support corrections retained.
The raw rejected run is `test-results/s55-lionmotion/authored-cats/`. No source
simplification from that bypass was kept. The remaining task is to make the
contact solver continuous while retaining planting and sole grounding.

## Rejected catch-up restart guard

Tested preserving active continuous-skin catch-up steps through the reach guard
and phase wrap. The completed real-L8 repeat worsened maximum paw steps to
14.629 cm for lion and 15.727 cm for lioness (accepted comparison 11.815/13.001
cm). Reverted the source experiment. The reach guard's restart behavior alone
does not explain the residual discontinuity. Direct target/solve instrumentation
is still required before another contact-state change. `l8-after` currently
contains this rejected run; earlier accepted summaries remain in this report.

## Direct target instrumentation

Temporarily logged requested paw contacts, prior solved contacts, converted
ankle targets and final solved contacts for legFR in the real fixture. Completed
900 frames; raw log saved as `test-results/s55-lionmotion/instrumented/solver.json`.
The trace contains a requested contact at Y=0.038 m whose solved contact remains
at Y=0.393 m, demonstrating an unreachable target. Across one handoff the
requested X changes ~0.284 m while actor root changes only 0.00134 m. Thus the
remaining discontinuity is in contact generation/reachability, not sim root
translation. Temporary renderer logging and fixture capture changes were removed.
No new source fix is claimed from this diagnostic run.

## Bind-pose reach calibration

Read GLB JSON and composed node transforms without editing assets. Lion's bind
foreleg shoulder is at Y=0.6713 m, ankle Y=0.1482 m, declared sole minimum
Y=0.00282 m, and two-link chain length 0.5932 m: the bind pose can reach its
floor. The rendered trace previously showed a shoulder near Y=1.1 m and contact
near Y=0.4 m. Therefore the unreachable solve is not explained by missing sole
metadata or bind geometry alone; the loaded locomotion pose/ancestor transforms
must be compared with the bind calibration. Zebra and elephant bind soles also
sit near zero. This changes the next investigation toward atlas pose construction
and transform alignment, rather than another paw-state workaround.

## Healthy animal classification fix

Found that `CrowdView` restricted `animalSpecies` to `e.infected`. Healthy zoo
animals therefore skipped the branch clearing humanoid layers and entered the
40-degree humanoid body-lean clamp. Their horizontal bind rig was being rotated
upright before the paw solve, explaining the shoulder-height discrepancy and
unreachable floor targets. Species classification now includes living healthy
zoo animals. A completed real-L8 repeat gives paw maxima 9.042 cm for lion and
19.839 cm for lioness with current solver changes. This fixes a concrete pose
classification error but does not yet pass continuity acceptance. The solver
must now be reassessed with anatomically correct input rather than the previous
humanoid-clamped pose. Latest `l8-after` contains this run.

## Original solver comparison and wall lean

With healthy-animal classification fixed, restoring the original PawContacts
still produced 66.89/66.29 cm maximum pelvis steps in a full real-L8 repeat.
The support corrections were restored. Found a second humanoid-only layer
applied after species clearing: the wall/contact branch set `lean = -.25` for
animals too. Excluded species from that branch. The completed real-L8 repeat
now measures pelvis maxima 0.8333 cm (lion), 0.5568 cm (lioness), and paw maxima
10.336/14.088 cm. Raw evidence is under `no-animal-wall-lean/`. Removing an
inappropriate humanoid layer is retained, but these paw maxima still need
continuity/visual assessment before acceptance.

## Seven-species classified-input probe

Fixed the Scene Lab animal validator's missing monkey entry (already supported
by ZooSpecies and the spawn implementation), and included monkey in the probe.
Completed 900 controlled frames per animal, 25.9833 m travel each. Reported
maximum contact slide in cm: lion 15.3, lioness 10.9, zebra 18.0, gorilla 7.0,
elephant 3.6; flamingo/monkey had no measured planted contacts. No measured sole
penetration. Drawn-frame counts: 845, 883, 900, 900, 900, 666, 159 respectively.
Thus this wide framing does not prove the full motion interval for every animal;
monkey especially needs a centered capture. Raw results: `zoo-classified/`.
These measurements expose remaining contact quality work and are not final gates.

## Centered coverage and stalk speed cutoff

The probe now supports one selected species with a following camera and asserts
900 drawn frames. Monkey, lion and lioness each passed 900/900 coverage. Monkey
max pelvis/paw steps were 0.452/9.337 cm, no penetration. Both cats measured
4.400 cm pelvis and 5.590 cm paw maxima; the pelvis step exposed AnimalMoves
removing the healthy-lion 4.4 cm stalk crouch at speed 2.6 while keeping the same
walk clip. Removed that abrupt cutoff, retaining the stalk pose for moving
healthy cats. A completed centered lion repeat is saved at
`lion-stalk-continuous/`; final matrices and regression checks remain required.

## Centered low-tier backend comparison

Lioness completed 900/900 drawn frames on WebGPU low zoom 1 and WebGL2 low zoom
1. Both report 0.3667 cm pelvis and 5.5898 cm paw maxima, zero measured sole
penetration, and zero run-jitter count. On WebGPU, contact slide p95 is 0.1 cm;
the 15.3 cm maximum is the initial frame, not a later gait frame. Opened the
WebGPU `strip-0.png`: horizontal body with attached articulated limbs, rather
than the earlier humanoid-upright silhouette. This is a single-frame inspection;
full strip/interval and remaining matrix acceptance still remain required.

## Completed centered cat matrix

Completed all 16 combinations: lion/lioness × WebGL2/WebGPU × high/low × zoom
1/1.5, each 600 walk-speed frames + 300 run-speed frames. Every row drew 900/900
frames and reported zero sole penetration and zero run-jitter count. New
`config.json` receipts confirm actual backend `webgl` for WebGL2 requests and
`webgpu` for WebGPU requests; no fallback rows. Raw traces/captures and summary:
`test-results/s55-lionmotion/matrix/`. These are centered controlled scenes;
real fixture acceptance, interval visual review, final type/lint/remote test and
62/62 gate still must be completed on the final source.

## Current real-fixture trace and heading-aware metric

Repeated real L8 on current source; full 900-frame trace is `l8-current/`.
Added yaw maximum and actor-coordinate paw maximum to `analyze.ts`, retaining
world-relative measurements. This separates root heading motion from joint
motion rather than labeling every turn-induced displacement a pose pop.
Lion: root 0.745 cm, yaw 0.075 rad/frame, pelvis 0.833 cm, local paw 8.775 cm.
Lioness: root 1.664 cm, yaw 0.100 rad/frame, pelvis 0.557 cm, local paw 9.203 cm.
The lioness yaw matches the existing 6 rad/s presentation cap at 60 Hz. The
local paw metric still needs speed/phase and visual acceptance; no completion
claim follows solely from changing the measurement coordinates.

## Opened real-L8 consecutive strip

The fixture probe now captures consecutive canvas frames 174–179. Completed
900-frame run under `l8-visual-current/`, opened `sheet.jpg` and enlarged
`crops.jpg`. Both cats remain behind the black fence with horizontal bodies;
the lion's visible foreleg shifts incrementally while body position stays
steady across the six frames. No whole-body jump is visible in this short
window, which includes the lion's previous maximum frame 178. Fence bars obscure
some feet, and this is not a full-interval or all-matrix acceptance statement.
The lioness's maximum frame 182 is outside this six-frame window and remains to
be inspected. Captures were opened rather than merely generated.

## Extended strip audit and current static checks

Current typecheck and lint both completed exit 0. Extended the capture through
frame 185 and opened the 12-cell crop sheet. A batch-boundary pixel orientation
change disagrees with the continuous recorded forward vectors (<=0.1 rad/frame),
so direct in-task canvas reads cannot yet be trusted as synchronized consecutive
GPU frames. Added screenshotReady synchronization before each captured frame;
that capture change still needs a repeat run. Do not interpret the extended
unsynchronized sheet as proof of either a new game pop or smoothness. Earlier
single-window visual statements are limited by this discovery too.

## Synchronized real-L8 strip inspection

Repeated the 900-frame fixture with screenshotReady before each captured frame.
Opened the 12-cell enlarged `l8-synchronized/crops.jpg`; the previous pixel/trace
batch mismatch is gone. Across frames 174–185 both cats turn and shift attached
limbs incrementally with no visible whole-body height jump or frame replacement.
The lioness progresses from diagonal toward the fence to facing forward; the
lion's mane/head and forelegs move through intermediate poses. Fence bars still
hide portions of the paws. This is evidence for the inspected interval, not an
unqualified full-runtime acceptance. The reviewed sheet is committed as
[l8-contact-sheet.jpg](l8-contact-sheet.jpg).

## Final unit rerun capacity wait

Requested `sh tools/remote/run.sh "$PWD" -- npm test` on the current source.
The FIFO wrapper remained live for over five minutes without admitting the
suite. Two read-only runner-status checks confirmed a healthy runner with 2/2
slots occupied and local fallback waiting on an active browser reservation.
Cancelled this waiting request (exit 130); no tests started and no final pass is
claimed. The earlier green remote suite predates later source changes and is
insufficient for final acceptance. Log: `final-unit.log` under test-results.


## Current shared render regression check

Ran `node node_modules/vitest/vitest.mjs run tests/shared/render-contracts.test.ts
--project default --configLoader runner --maxWorkers=4`: exit 0, 14/14 passed,
3.16 s. This file includes the finite rigid/skinned action-clip helper and
fractional crowd palette/picking checks. This targeted suite is useful shared
render evidence but does not replace the pending required remote full suite,
full scene gate, or a complete companion-clip runtime audit.

## Centered remaining-species coverage

Zebra, elephant, gorilla and flamingo each completed 900/900 centered frames.
Pelvis/paw maxima (cm): zebra 8.109/12.132, elephant 1.874/11.886, gorilla
0.793/11.673, flamingo 0.833/6.189. No measured penetration. Zebra and elephant
largest paw steps occur at the imposed speed change frame 600. Elephant reports
2 run-jitter frames; this is unresolved and prevents blanket acceptance.
A temporary 0.12 s stride easing experiment reduced zebra paw maximum to 9.801
cm but left its 8.109 cm pelvis step unchanged, so it was reverted rather than
kept as a fix for the identified defect. Raw centered traces and
`zebra-stride-ease/` preserve the evidence.

## Corrected species maximum-frame attribution

The previous centered-species entry incorrectly associated pelvis maxima with
`worstFrame`, which the analyzer tracked only for paws. Added a separate
`pelvisWorstFrame` field. Zebra pelvis maximum 8.109 cm is at frame 743, phase
0.346->0.391 (next frame changes 6.313 cm), not at the speed change. Elephant
pelvis maximum 1.874 cm is at initialization frame 4, not frame 600. Their paw
maxima remain at frame 600. This correction invalidates the inference that the
zebra pelvis defect was caused directly by the imposed speed switch; the raw
values remain valid and require phase-specific interpretation.

## Zebra grounding isolation

Zebra has `ss_preserveAnimalJoints` and declared soles; current constructor logic
therefore still enters paw correction. Temporarily removed the second
CrowdLocomotion whole-body ground call for animals, retaining PawContacts sole
handling. Full centered zebra repeat produced identical metrics and maximum
frame 743, including zero penetration. Reverted the no-effect source change.
This rules out that second runtime ground pass as the zebra maximum's source;
the baked pose or earlier correction requires comparison before declaring it
the same defect as the cats. Raw experiment: `zebra-single-ground/`.

## Zebra raw atlas comparison

Probe samples now include the active batch's fractional authored atlas frame
index and uncorrected hip Y. Completed centered zebra run `zebra-atlas/`.
At frames 742/743 raw atlas hip Y is 1.183549/1.102461 m; rendered hip Y is
1.183549/1.102461 m to float precision. Therefore the 8.109 cm maximum is
already in the baked gait, not introduced by runtime paw support release.
The surrounding raw heights vary through the gait peak; this is distinct from
the cats' solver discontinuity. Atlas indices (175.958 -> 176.993) and raw
heights are retained for reproducibility rather than inferring pose from phase.

## Current-source full remote unit result

On 2026-11-12, retried the required remote `npm test` after status showed a free
slot. It acquired slot 1 and completed exit 0: 27 files passed, 106 tests passed,
1 skipped; duration 208.39 s, wrapper 211.5 s within 240 s. Repository collection
remains within the 150-case budget. Log: `final-unit-retry.log` under the lane's
test-results. This result covers current render source; the earlier cancelled
request is superseded. Full 62/62 scene gate and remaining acceptance audit are
still outstanding, so the goal is not marked complete.

## Infected cat locomotion coverage

Probe now supports infected actors. Completed centered infected lion on WebGL2
high and infected lioness on WebGPU low, each 900/900 drawn frames, active
infected locomotion clips, zero measured penetration/run jitter. Both measured
0.5500 cm pelvis maximum and 10.720 cm actor-coordinate paw maximum. Explicit
scans found all saved joint components finite. AI movement contributes alongside
the controlled tick trajectory (28.04 m travel), so these runs are not labeled
constant-speed baselines. Raw evidence: `infected-lion/` and
`infected-lioness-webgpu-low/`. This closes stationary infected-fixture coverage
but does not substitute for the full final scene gate.


## Current-source full scene gate result

Ran `SCENE_PORT=4952 E2E_UNITS=1 npm run scene:gate` to terminal exit 0 on
2026-11-12. **62/62 rows passed, 0 known, 0 not run**, in 10.4 minutes across
seven batches. This includes night lion/zoo lineup, healthy zoo animals,
courier locomotion/turns, companion corgi and pet-dog rows, on both render
backends/tiers represented by the gate. Log: `final-scene-gate.log` and canonical
`test-results/scene-gate/` receipts. No source changes occurred during the run.
This supersedes the earlier intentionally stopped partial gate.

## Repeated-render time correction

The four final-fixture backend/tier runs completed, but readiness redraws exposed
larger paw maxima (27.88/39.30 cm) in the captured interval. Found that crowd
PawContacts advanced catch-up/support state by a hard-coded 1/60 s on every
render, including redraws at the same render timestamp. CrowdLocomotion now
passes measured elapsed render time, zero for same-time redraws, capped at
0.1 s. A completed readiness-enabled fixture repeat measures local paw maxima
7.473/8.547 cm and pelvis 0.852/1.058 cm. This is a new source correction;
previous passing full tests/gate predate it and must be revalidated. Raw runs:
`fixture-final-*` before this correction, `fixture-elapsed-time/` after.

## Same-time redraw regression probe

The fixture now explicitly repeats five `view.update(1)` calls at one paused
simulation/render timestamp after readiness. Completed 900-frame run
`redraw-check/`: at tick 235 maximum joint-position change across the five
redraws is exactly 0 m. This directly validates the elapsed-time correction's
intended idempotence, beyond comparing independent motion runs. Shared render
contracts were rerun after that correction: 14/14 passed, exit 0. Full suite and
62-row gate still need their post-correction reruns.

## Declared-sole skin timing consistency

Audit found zebra carries `animalSoles` but not `crowdQuadruped`. CrowdLocomotion
now recognizes either marker as an animal skin, matching PawContacts, so declared
sole rigs receive shared elapsed-time/contact handoff state too. Added the
same-time five-redraw probe to centered scenes. A full centered zebra repeat
records exactly 0 m joint drift across those redraws; raw `zebra-time-tracked/`.
This is another source change, so the prior full-suite/gate receipts remain
historical until the final post-change validation run.


## Direct original/current real-L8 comparison

Re-ran the identical readiness-enabled 900-frame fixture probe against original
render source at 60840f0d, then restored current render files byte-for-byte in a
finally block and verified a clean worktree. Repeated against restored current
source. Both traces have 839 adjacent drawn samples per cat. Pelvis maxima:
lion 95.686 cm -> 0.833 cm; lioness 100.802 cm -> 0.557 cm. Actor-coordinate paw
maxima: lion 61.801 cm -> 8.775 cm; lioness 55.207 cm -> 9.203 cm. Root translation
and yaw maxima are unchanged (lion 0.745 cm/0.075 rad, lioness 1.664 cm/0.100 rad).
This directly attributes the removed whole-body discontinuity to presentation,
with unchanged simulation movement. Raw `original-l8/` and
`current-l8-comparison/` replace intermediate-candidate figures for final L8
before/after reporting. Current typecheck/lint also passed before these runs.

## Post-timing-fix full unit validation

Required remote `npm test` completed exit 0 on current contact-time source:
27 files passed; 106 tests passed, 1 skipped; 220.42 s test duration and 223.5 s
wrapper time within 240 s. Collection remains 150/150 repository cases. Log:
`post-time-unit.log`. This supersedes the earlier full-unit result for the
elapsed-time and declared-sole classification changes. Post-change 62-row scene
gate and the final consolidated acceptance audit are still outstanding.

## Post-timing-fix full scene gate

Required `SCENE_PORT=4952 E2E_UNITS=1 npm run scene:gate` completed exit 0 on
current render source: **62/62 pass, 0 known, 0 not run**, 10.9 minutes. All seven
batches passed, including courier/companion and zoo rows. Log:
`post-time-scene-gate.log`; durable receipt: [scene-gate-summary.md](scene-gate-summary.md).
This supersedes the pre-timing-fix gate. No source changes were made during the
run. Full remote unit suite also passes after the timing changes.

Remaining acceptance audit must explicitly reconcile the controlled 10 s walk /
5 s run captures with the natural 15 s L8 fixture (which does not force a run),
and ensure pose-index receipts exist for both environments. These measurement
scope details cannot be inferred from green regression gates alone.

## Real-fixture pose indices and explicit route mode

The natural L8 fixture trace now records active fractional atlas frame indices
and actual backend. Completed `l8-pose-index/`: 840 frames contain cat atlas
receipts; natural maximum speeds were 0.447/0.999 m/s, so this sample cannot be
called a run segment. Added explicit `MOTION_FIXTURE_ROUTE=1` mode: the loaded
real L8 scene follows a test-only straight route, 10 s at 1 m/s then 5 s at
3.2 m/s, overriding fixture transforms/motion after simulation without changing
source gameplay stats. Config receipts clearly distinguish this from natural
AI. Completed current-source route run `l8-controlled-current/`. Original-source
route comparison and final measurement audit remain to be completed.

## Flat interior real-fixture route

Inspection located the synthetic route's 12 cm steps at real paving edges; its
post-grounding transform override also delayed sim support height by one tick.
The test route now samples support at the overridden destination and uses the
interior enclosure lane Z=-42, with camera following that lane. No gameplay
source/stat change. Completed 900 frames (`l8-interior-route/`): root maximum
5.333 cm, exactly 3.2 m/s / 60, yaw zero, root-relative pelvis maximum zero for
both cats; local paw maxima 6.652/5.583 cm. Natural-AI/curb observations remain
separate and are not erased by this flat-route isolation. Original-source run
of this identical interior route remains needed for its before/after comparison.
