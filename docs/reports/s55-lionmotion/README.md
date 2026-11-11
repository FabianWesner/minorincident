# s55-lionmotion: investigation in progress

Date: 2026-11-11

## Scope

Investigate flicker reported for the L8 lion and lioness. Motion only; model assets
are outside this lane. The cause and before/after render metric are not established
yet. No source files have been changed.

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
