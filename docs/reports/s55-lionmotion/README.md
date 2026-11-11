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
