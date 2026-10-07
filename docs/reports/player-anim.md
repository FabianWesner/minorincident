# Courier animation quality

Lane: `player-anim`. No simulation modules or specifications changed. No new dependencies or third-party assets were introduced. The male skin and its reproducible fitting script come from `skin-rollout` commit `2e151578`; only courier files were imported. Corgi and crowd changes remain in their owning lanes.

## Decisions

- Retain the fitted named-joint skeleton, Mesh2Motion CC0 upper-body clips, AnimationMixer and two-bone bicycle IK. The defects were in proportion handling and contact trajectories; another rig or a motion-matching runtime is unnecessary for this change.
- Remove the skin's offline planted-gait bake. It lowered the pelvis for the entire cycle, then the runtime lowered it again. Attenuate adult pelvis sway/twist on the short courier legs, while retaining the source shoulder, arm and head motion.
- Keep world-space stance contacts and distance-driven phase. Swing velocity matches stance at its endpoints. A smooth prescribed knee arc determines ankle clearance from actual bone lengths, avoiding both the straight-leg singularity and the previous sign-changing ankle extension.
- Fit walk/run cadence to the two bodies, capped at 2.5/3.2 cycles per second. Running has a shorter support interval, knee compression, and an independent pelvis path during flight. A constrained pelvis filter preserves reachable support and bounded knee flexion.
- Release stale plants during turns, bound their horizontal radius, and settle feet with short alternating steps on stops. Idle/move hysteresis and a 0.006-radian heading deadband reject small arrival noise. Presentation does not change navigation or collision outcomes.
- Ground punches, bat swings and hit reactions; preserve the authored kick/knee/spinning actions. Attack fades finish before the supplied simulation contact tick. Repeated hurt actions restart, and every procedural layer restores the original mixer input before the next sample, including frozen frames and bicycle contacts.
- Repair the authored kick/knee/backfist anticipation export: its held guard jumped into a chamber in one source frame. A spherical quadratic uses that chamber as its control pose and retains the exact original 20% contact and recovery. This is computed while building clips, with no extra per-frame solver.
- Both courier variants use their own fitted skin and cached limb solvers. `skin=0` remains the rigid fallback. Skins are now enabled by default following the side/game-angle review; explicit skin=0 and skin=1 overrides remain.

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

Measured straight locomotion, at 2.0 / 4.5 m/s (every frame, ticks 91–289):

| Measure | Female before → after | Male before → after |
| --- | --- | --- |
| Walk peak knee flexion | 103.0° → 26.1° | 89.2° → 25.3° |
| Run peak knee flexion | 135.5° → 45.0° | 108.0° → 45.0° |
| Walk stance ankle drift | <0.01 → <0.01 cm | 6.93 → <0.01 cm |
| Run stance ankle drift | <0.01 → <0.01 cm | 26.38 → <0.01 cm |
| Walk pelvis range per cycle | 6.20 → 5.00 cm | 2.82 → 4.58 cm |
| Run pelvis range per cycle | 5.18 → 0.75 cm | 4.48 → 1.00 cm |
| Walk leg angular speed p95 | 1080 → 585°/s | 878 → 482°/s |
| Run leg angular speed p95 | 1462 → 893°/s | 1306 → 726°/s |

The female walk exceeds a literal 25° cap by 1.1° at its peak; the requested limit was approximate. Male walking has more cyclic pelvis travel than the rigid baseline, because the revised gait preserves leg extension and planted feet. The range is periodic, not arrival vibration. The old pilot's planted-foot accuracy was already good; the improvement is posture, reach and continuity while retaining that accuracy.

The fixed settled-stop window (ticks 240–300, one second after braking) stays in `idle` for both variants. Maximum ankle frame displacement is below 0.000001 cm; pelvis range is 0.0566 cm female / 0.0558 cm male. `settled-stop.json` records this presentation-only measurement; it does not claim to validate navigation arrival.

The isolated CPU probe covers 28 variant/skin/pose cases. The highest skinned p95 is **0.161 ms female riding / 0.119 ms male riding**, including matrix propagation and both loaded skeleton palettes, under the requested ~0.5 ms budget. Median riding values are 0.105 / 0.043 ms. An earlier probe measured 0.310 / 0.183 ms p95; both runs remained below budget. These are wall-clock measurements on the shared Apple M4, not an OS scheduling bound.

Visual review of the fixed-time comparison frames: both revised couriers remain upright in walking and running, retain hip-width foot placement, and no longer reach into the pilot's deep trailing-foot lunge after a 180° turn. Bat follow-through and hit reaction keep a grounded lower body. Bicycle hands/feet maintain the existing socket contacts, now for both bodies. The paired videos retain the full motion for the orchestrator's cadence/transition review. Existing bulky sole and bag-strap geometry is visible in the close crops; this lane does not remesh that art.

The final full-chain audit found a 103.45° leg step in the revised inherited unarmed clips (the old baseline reached 99.68°). `f31df286` reduces it to 54.44° while retaining exact contact poses. This is the four-tick knee windup; fast attacks still have higher joint speeds than locomotion. The regression caps every leg step below 60° across the entire unarmed/bat chain, including action boundaries, and checks contact-pose equality and frozen-frame stability.

The actual L1 A/B run has identical final player and simulation state, zero console/request errors and zero missing clips. Both videos are 12.8 seconds. Skins save 30 draw calls in each captured scene; observed browser player CPU p95 is at most 0.20 ms (0.30 ms maximum sample).

Default enabled in `20d3a85e`. Main's combat-feel and vehicle-feel changes were integrated in `49603096`. Their combat phase timings remain compatible with the contact-time regression tests. The lock-wrapper merge retained main's equivalent single-slot queue fix.

Validation logs and machine-readable results are in `test-results/player-anim/` and its `gates/` directory.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2` | 266 passed, 77 files; 0 failed |
| `npx vitest run tests/unit/render/skin-pilot.test.ts --maxWorkers=2` | 14 passed; 0 failed |
| `E2E_SKIN=0 E2E_PORT=3369 npm run test:smoke` | 5 simulation + 22 browser passed; 0 failed |
| `E2E_SKIN=1 E2E_PORT=3369 npm run test:smoke` | 5 simulation + 22 browser passed; 0 failed |
| `SIM_WAIT=60 E2E_SKIN=1 E2E_PORT=3368 npm run verify -- E04` | 43 unit/simulation + 27 browser passed; 0 failed |

All final runs have zero failures/flakes. The saved validation summary identifies the tested implementation (`f31df286`) and integrated main (`6dee9147`).

The smoke and verify commands use their own browser locks; they were not wrapped in another lock. Headless browser validation uses Chromium/ANGLE Metal, four mobile orientations and WebKit, with at most two workers.

Two initial smoke attempts each had 21 browser passes and one failure from transient 404s while `dist` was replaced: skin-off overlapped the verification build; skin-on overlapped the full unit suite’s existing `tests/unit/static.test.ts`, which invokes another build internally. Subsequent smoke runs were scheduled after the full unit suite finished. Failed attempts remain in `gates/smoke-skin0-build-race.*` and `gates/smoke-skin1-unit-build-race.*`. No request-error allowlist or test assertion was weakened.

## Limits

The references `living-civilians-and-story-npcs.png`, `survivor-gear-tiers-and-action-poses.png` and `survivors-corgi-and-equipment.png` were inspected read-only. Their upright walking silhouettes and clear action poses guide this change; no character art was redesigned.

The small courier legs still require a brisk cadence at 4.5 m/s. Walking retains normal cyclic pelvis rise and fall rather than a perfectly flat pelvis. Turns use procedural contact release, and mount/dismount still use the authored transition clips; these are not newly captured human motion. WebGPU parity requires the repository's manual check.

## Main implementation commits

- `29ef14c4`: reuse male skin/fitting and establish every-frame comparison capture.
- `82c69bc4`: continuous foot arcs, grounded attacks and stable procedural inputs.
- `2d6f6a19`: bounded pelvis across gait speeds/transitions.
- `8b46ff9d`: contact-tick and arrival-heading regressions.
- `20d3a85e`: enable both courier skins by default, retain explicit fallback.
- `f31df286`: repair authored kick/knee anticipation without moving contact.
- `671ac8d8`: review report, durable measurement files and comparison stills.

No specification criteria were edited. Main's later audio-only merge is outside this validated integration base; the orchestrator owns the final main merge and subjective motion review. Arrival/navigation simulation changes remain in their owning lane.
