# s213 motorbike with sidecar

## Implemented

- Added a reusable L10 motorbike ride state on the L1 bicycle controller and contact path. The L1 bicycle keeps its original tuning; the motorbike uses 1.25× top speed and acceleration and a slightly wider turn radius. L10 has a trial motorbike on the authored evac road at x≈2800.
- Mounted riding pins weapon selection to the handgun when carried, allows handgun fire within a forward 200° arc, blocks melee and other weapons, dims unavailable rack entries, and restores the previous selection on dismount.
- The corgi attaches to the sidecar while riding, uses its sit pose, and returns to following on dismount. Hard infected contact knocks the rider off without damage and permits remounting after the existing lockout.
- Added a procedural motorbike/sidecar rendering fallback, rider contact points, an animated sidecar wheel, night headlight and exhaust puff. Existing speed-responsive vehicle engine cues are reused.

## Verification

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npx vitest run tests/engine/vehicles.test.ts` — pass (2 tests), including >100 m travel, handgun hit, blocked second weapon, corgi seating, infected knock-off and remount.
- `npm test` — pass locally (27 files, 106 tests).
- Full `qa:threat` stage set, executed as two native shards and merged — 0 flags across L1–L10. L10 skilled and passive routes loaded from the evac-road trial placement.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test` — unavailable: no healthy remote runner is provisioned. The local suite passed.
- `E2E_PORT=5193 SCENE_PORT=5194 npm run qa:vehicle-motion` — unable to start the browser pool; bind failed with `EPERM 127.0.0.1:4329`. Scene Lab captures and visual review could not run in this environment.

## Open

- The vehicle build script and manifest row are present, but Blender 5.2 crashes during Metal capability detection here. The motorbike asset is therefore marked `scripted`; its canonical and LOD GLBs have not been exported or validated against budgets. Runtime uses the procedural fallback.
- The headlight, exhaust and sidecar presentation are code fallbacks pending the authored asset. The corgi moves directly into/out of the seat; no hop animation has been authored.
- Scene Lab HIGH zoom 1 (3 frames), LOW capture/review, and `qa:vehicle-motion` pass remain outstanding because the browser pool cannot bind its local listener.
- The remote npm test remains outstanding because no remote runner is provisioned.

This report records the completed simulation work and the outstanding asset/browser/remote gates; the brief's full Done list is not complete.
