# Skinned courier pilot

Branch: `lane/skin-pilot`. Main bike/S-02 fix merged at `cc8b9ffc` (main `ae40800d`). Default remains off; use `?skin=1` for the female L1 courier and `?skin=0` for the rigid baseline.

## Delivered

- One welded skinned courier, existing three.js AnimationMixer and offline retargeted Mesh2Motion CC0 human clips. Idle, walk, run, punches, kick, three bat combos, hit reaction, carry, ride and mount/dismount use the existing combat/presentation clock.
- Locomotion phase follows actual displacement, blends smoothly with speed and retains main's 2 / 2.7 cycles/s cadence caps. World-space stance heel locks remove foot sliding. Restoring mixer offsets avoids cumulative kick drift and frozen-frame vibration.
- Cached two-bone IK places palms at `grip_l`/`grip_r` and soles at `pedal_l`/`pedal_r`. Pelvis reads `seat`; steering, lean and crank are sampled after the bicycle update. Seated chest lean and compensated gaze remain stable while stopped. Mount/dismount contacts ease over 0.4 seconds.
- Animation/IK only affect presentation; no simulation module changed. Captures compare the final world snapshot, including combat, entities and RNG; renderer state and district layout summaries are excluded.
- Five targeted tests cover opt-in flags, walk/run support foot movement, capped cadence, frozen pose, kick recovery and real GLB bike contacts (within 6 mm across heading, steering, lean and crank).
- Repeatable headless A/B capture and isolated CPU profiling, with no new dependencies. Main's saddle unit test and bike asset were not edited in this lane.

## Review and artifacts

`test-results/skin-pilot/skin0.webm` and `skin1.webm` are each 12.80 seconds (192 frames at 15 fps). Full-resolution PNG stills cover idle, walk, run, stopping, jab, kick, bat swing, hit reaction, mount, ride, dismount and rest. The video follows the courier in a 640 × 480 crop. Scripted inputs and seed are identical.

The skin improves continuous shoulder/elbow/knee deformation and seated foot contact while preserving the courier silhouette and outfit. The revised main baseline also fixes palms/saddle, so the difference in a ride still is smaller than in the original baseline. The compact proportions and existing authored kick/mount motions still limit realism. Keep the pilot available for product-owner motion review; the default switch is ready.

To change the default, set `DEFAULT_SKIN = true` in `src/render/characters/RiderContacts.ts`. Explicit `skin=0` remains the rollback override. Male courier and later survivors retain their existing assets.

## Performance

Hardware: Apple M4, macOS, Node v26.0.0; browser is headless Chromium WebGL2 with ANGLE Metal, serialized by `tools/e2e-lock.sh`. CPU probe warms 300 frames then measures 2,000 frames per idle/walk/run/jab/kick/bat/ride pose. Timed work includes CharacterView, mixer/contact IK, matrix propagation and Skeleton.update; excludes simulation and rendering. Rigid riding includes main's new palm correction.

The isolated probe’s most expensive skin pose is ride: **0.0503 ms median / 0.0620 ms p95**. All seven skin poses stay below the requested 0.5 ms CPU budget at p95. Final browser measurements have a highest per-scene p95 of **0.20 ms** and a largest captured sample of **0.30 ms**. Skin draws are **30 fewer** in every captured scene (for example ride 294 → 264); the +3 draw-call ceiling is met. Final world/player snapshots match exactly; both captures have zero console/request errors and zero missing clips.

Measurements are in `cpu-profile.json`, `ab-measurements.json` and `ab-summary.json` under the artifact directory. Browser CPU timestamps have approximately 0.1 ms resolution; isolated Node measurements are more precise. These are measurements on this desktop, not a bound on OS scheduling pauses or GPU time. WebGPU visual parity was not measured headlessly on macOS.

## Validation

| Command | Final result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run build` | Pass |
| `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2` | 241 tests across 76 files passed; zero failures |
| `E2E_SKIN=0 E2E_PORT=3355 npm run test:smoke` | 5 sim/unit + 22 browser passed; zero failures |
| `E2E_SKIN=1 E2E_PORT=3355 npm run test:smoke` | 5 sim/unit + 22 browser passed; zero failures |
| `E2E_SKIN=1 E2E_PORT=3356 sh tools/sim-lock.sh npm run verify -- E04` | 34 sim/unit + 27 browser passed; zero failures |
| `E2E_PORT=3354 sh tools/e2e-lock.sh npx tsx tools/skinpilot/l1-ab.ts test-results/skin-pilot` | Pass: matching snapshots, 2 × 12.80 s videos, 24 stills, no errors |
| `npx tsx tools/skinpilot/profile.ts test-results/skin-pilot` | Pass: 14 poses × 2,000 timed frames |

Browser suites use at most two workers. Full unit/epic Vitest runs use the shared simulation lock; unit workers are capped at two. Requested artifacts remain under the ignored pilot directory; unrelated generated epic snapshots are restored.

## Deviations and remaining scope

- The inherited courier skin uses its fitted joint contract (19 skin bones), with Mesh2Motion CC0 clips retargeted onto it. It is an adapted rig, not the untouched full Mesh2Motion skeleton. This preserves existing sockets, outfits and authored action compatibility. Sources are pinned to upstream commit `79f3f61a9852ef70234a5a4a7c13ed87f7a71833`; attribution is in `THIRD_PARTY_NOTICES.md`.
- The pinned human library has no kick or bicycle mount clips. Those actions use our authored clips; the three bat swings use retimed CC0 sword swings with the existing contact timing. Ride uses a stable upper body with solved contacts.
- The requested living-civilians reference image is absent from the checked-out repository. The orchestrator authorized the existing courier as baseline. No specification files changed.
- Only the female courier is skinned in this pilot. Mesh fitting is tailored to her proportions; other bodies need bind-pose/weight calibration. No default flip, merge into main, push or deployment was performed.

## Applying the approach

Estimates are engineering person-days including fit/animation QA; they are planning ranges, not measured delivery times.

| Target | Reuse and required work | Estimate |
| --- | --- | --- |
| Male courier | Same humanoid joint/socket contract and clips; weld/weight the existing mesh, calibrate stance and contacts. | 0.5–1 day |
| Civilians | Same human rig and walk/run/carry clips; fit outfit/body variants and preserve role props. Crowd rendering should share baked bone palettes and existing instancing rather than create a mixer for every NPC. | 2–3 days for shared crowd skinning, then 1–2 days for initial variants; 0.25–0.5 day per additional mesh |
| Infected | Reuse the human crowd backend; fit each tier, hunch/stride and bite/death poses, infection materials, plus weighted gore cut seams/caps. | 3–5 additional days after the shared crowd backend |
| Corgi | Separate quadruped rig, fitting a CC0 quadruped source to the short legs/long body; four paw contacts, head/tail, walk/trot/gallop blends and authored whine/bark/story actions. Reuse the existing quadruped presentation clock and distance phase. | 2–3 days for a pilot; crowd quadrupeds would need separate batching work |

Crowd estimates retain current instancing and animation budgets. The single-courier CPU result does not justify one AnimationMixer per actor in a dense infected wave.

## Commits

- `c3f50d03`: integrate the initial main bike model/cadence changes.
- `bb706efd`: courier blend, planted feet and socket IK.
- `87170f4c`: deterministic capture, CPU probe and targeted tests.
- `1782bd1f`: restore kick offsets before mixer sampling.
- `2993620b`: stable seated gaze and capture hit-stop clock.
- `cc8b9ffc`: integrate main's final saddle/palm/S-02 fix while retaining both render paths.
- `5bcc58f2`, `ea83fb5b`: updated baseline profiling and worst captured CPU sample.
- `7c5d18ec`: derive video duration from actual captured frame counts.
