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
