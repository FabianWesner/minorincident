# Courier animation quality

Lane: `player-anim`. No simulation modules or specifications changed. No new dependencies or third-party assets were introduced. The male skin and its reproducible fitting script come from `skin-rollout` commit `2e151578`; only courier files were imported. Corgi and crowd changes remain in their owning lanes.

## Decisions

- Retain the fitted named-joint skeleton, Mesh2Motion CC0 upper-body clips, AnimationMixer and two-bone bicycle IK. The defects were in proportion handling and contact trajectories; another rig or a motion-matching runtime is unnecessary for this change.
- Remove the skin's offline planted-gait bake. It lowered the pelvis for the entire cycle, then the runtime lowered it again. Attenuate adult pelvis sway/twist on the short courier legs, while retaining the source shoulder, arm and head motion.
- Keep world-space stance contacts and distance-driven phase. Swing velocity matches stance at its endpoints. A smooth prescribed knee arc determines ankle clearance from actual bone lengths, avoiding both the straight-leg singularity and the previous sign-changing ankle extension.
- Fit walk/run cadence to the two bodies, capped at 2.5/3.2 cycles per second. Running has a shorter support interval, knee compression, and an independent pelvis path during flight. A constrained pelvis filter preserves reachable support and bounded knee flexion.
- Release stale plants during turns, bound their horizontal radius, and settle feet with short alternating steps on stops. Idle/move hysteresis and a 0.006-radian heading deadband reject small arrival noise. Presentation does not change navigation or collision outcomes.
- Ground punches, bat swings and hit reactions; preserve the authored kick/knee/spinning actions. Attack fades finish before the supplied simulation contact tick. Repeated hurt actions restart, and every procedural layer restores the original mixer input before the next sample, including frozen frames and bicycle contacts.
- Both courier variants use their own fitted skin and cached limb solvers. `skin=0` remains the rigid fallback. The default decision is recorded with the final visual review below.

## Evidence and reproduction

Artifacts live in the ignored `test-results/player-anim/` directory. `before/` records the untouched pilot at `642f8fe0`; its male courier is rigid because the pilot had no male skin. `after/` records the revised production CharacterView. Each JSON contains every 60 Hz pose, not selected frames.

The review harness renders those recorded poses using the actual GLBs, with identical neutral lighting and side/game-angle close views. This isolates pose changes from world lighting. Videos are 1280 pixels wide, 15 fps, 5 or 7 seconds each. Stills are taken at fixed ticks 60, 120, 180 and 240. Every scenario includes its full start and recovery. Real L1 captures supplement the isolated review.

```sh
npx tsx tools/playeranim/record.ts test-results/player-anim/after after
npx tsx tools/playeranim/metrics.ts
# Start the local preview tool on an isolated port, never 3300:
npx vite --host 127.0.0.1 --port 3367 --strictPort --configLoader runner
E2E_PORT=3367 sh tools/e2e-lock.sh npx tsx tools/playeranim/capture.ts test-results/player-anim after
npx tsx tools/skinpilot/profile.ts test-results/player-anim --both
```

The before JSON must be retained to reproduce the historical comparison. Re-running `record.ts` on the revised code cannot regenerate the old pilot.

`metrics.json` documents the measurement window and includes raw knee, pelvis, cadence and angular-speed statistics. Stance slide is displacement from the first sampled stance position, not merely displacement between adjacent frames. Only straight, steady walk/run windows qualify for that measurement; turn releases and stopping steps are reported visually. The measured point is the ankle joint, not a shoe contact patch.

`cpu-profile.json` measures 300 warm-up and 2,000 timed frames for each variant/skin/pose combination. It includes CharacterView, world matrices and skeleton palettes; simulation and drawing are excluded. Browser capture timings are lower-resolution wall-clock observations, not the CPU budget gate.

## Validation and review

Final counts, measurements, default decision and visual findings are filled from the completed artifacts before lane handoff.

## Limits

The references `living-civilians-and-story-npcs.png`, `survivor-gear-tiers-and-action-poses.png` and `survivors-corgi-and-equipment.png` were inspected read-only. Their upright walking silhouettes and clear action poses guide this change; no character art was redesigned.

The small courier legs still require a brisk cadence at 4.5 m/s. Walking retains normal cyclic pelvis rise and fall rather than a perfectly flat pelvis. Turns use procedural contact release, and mount/dismount still use the authored transition clips; these are not newly captured human motion. WebGPU parity requires the repository's manual check.
