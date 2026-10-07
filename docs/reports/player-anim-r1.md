# Courier round-one correction

Lane `lane/player-anim-r1`; posture implementation `f8c7f76f` + `9560c3eb` + riding weapon visibility `ca68bf9a`, merged main `745e83f6` in `fd1a3560`. No push, merge into main, or deployment. The original courier meshes, fitted named-joint skeleton and retained CC0 clip data remain. No native Mesh2Motion avatar/skeleton, new asset, dependency, simulation change, or specification edit was introduced.

## Commits

- `fd1a3560`: merge main's bike stability/vehicle behavior, preserving the courier solver and existing crowd callers.
- `f8c7f76f`: posture, relaxed gait, knee anticipation and continuous bike transfer.
- `9560c3eb`: restore the pelvis/spine relationship and bound torso twist.
- `b5b2464a`, `500c9a22`: game-camera recording, measurements and L1 capture harness.
- `ca68bf9a`: stow held weapons through riding/dismount; bicycle regression.
- `51d46995`: curated paired stills, actual L1 videos, measurements and vision review.
- Final documentation commit: this report and the complete validation logs/results.

## Diagnosis and changes

The previous report's claim that round-one walking was upright was wrong. The merged round-one baseline puts the female chest **17.65° behind the hips**, and the male chest **16.58° behind**. This is a world-space anatomical measurement, not a projected screen angle. Idle also dips backward slightly. The game-camera comparison shows the corresponding belly-forward silhouette.

The walk's retargeted spine delta was already backward relative to the idle reference. Round-one attenuated the pelvis without accounting for the spine's parent-relative counter-rotation, worsening pitch and amplifying twist. Pelvis-height bounds and stop foot settling only change translations/leg contacts; they were not the source of that backward spine rotation.

- Fit the actual hip-to-shoulder line for each courier, preserving source roll and fitting forward pitch: relaxed idle, mild walking incline, 9–11° steady running. Restore the source pelvis/spine relationship before reducing torso twist. Steady locomotion twist is regression-tested below 13°; the old run reached roughly 50°.
- Replace the mismatched locomotion arm rest/swing with phase-matched, counter-swinging shoulders and relaxed elbows. The old walking elbows nearly straightened and running elbows folded past 150°. Walking now retains roughly 17–33° flexion; running stays below 80°. Source idle breathing, gentle arm motion, and a lateral pelvis weight shift remain visible.
- Softly limit backward torso pitch during standing action/recovery blends too, including hurt and fast melee chains. Death/floor poses are excluded. Mixer input restoration prevents accumulation and preserves exact frozen evaluations.
- Reduce steady run cadence from 3.2 to **2.7 cycles/s**, retaining distance-driven phase, world-space stance contacts, fitted knee arcs and turn release. Slightly adjust the walking support/clearance bounds for the revised weight shift.
- The four-tick authored knee now travels directly to its contact pose instead of taking a deeper chamber detour. Its peak 60 Hz leg-joint step falls from **54.44° to 43.39°**. Contact pose and contact tick remain unchanged. The full fists/bat-chain regression now caps every leg step below 46° instead of 60°.
- Mount/dismount use the fitted relaxed pose underneath the existing saddle/limb IK rather than the unrelated authored body pose. Capture the last presented root position and orientation across the sim's instantaneous seat/exit move, then blend to/from the bike. Frozen partial mounts remain stable. Fully mounted riders retain main's exact bike-frame orientation and saddle placement, including the repeated-evaluation path.
- Stow held weapon models while mounted and until the skinned dismount blend has released the grips. The L1 review caught a bat crossing the handlebar/head; the bicycle regression now checks stow/re-equip with skins on and off. Loadout and combat rules stay unchanged. `render.actions.attachments[].visible` reports that presentation state.
- Keep main's crowd/escort contact solver unchanged. It gained callers while this lane diverged; the courier-specific round-one solver is now `CourierGroundContacts`, avoiding a change to unrelated figures.

## Measurements

Every pose is evaluated at 60 Hz. Steady gait measurements use ticks 91–289 at 2.0/4.5 m/s; posture minima include the full sequences and transitions. Chest is the midpoint of the shoulders, measured from the hip against actor-forward and world vertical. Head uses its joint position. Positive pitch means forward. `test-results/player-anim-r1/metrics.json` contains the unrounded results and measurement limits.

| Measurement | Female before → after | Male before → after |
| --- | --- | --- |
| Walk minimum chest pitch, including start | −17.65° → +2.91° | −16.58° → +2.91° |
| Steady run chest pitch | 3.57–6.12° → 9.01–11.00° | 3.44–5.86° → 9.01–11.00° |
| Steady run cadence | 3.2 → 2.7 cycles/s | 3.2 → 2.7 cycles/s |
| Maximum steady stance ankle drift, walk/run | <0.01 cm → <0.01 cm | <0.01 cm → <0.01 cm |
| Walk maximum knee flexion | 26.14° → 25.62° | 25.29° → 24.31° |
| Run maximum knee flexion | 45.00° → 45.30° | 45.00° → 45.00° |
| Knee-strike maximum leg-joint step | 54.44° → 43.39° | 54.44° → 43.39° |

In the complete idle/start-stop/turn recordings the minimum chest pitch is +2.40° or greater for both variants. The separate action recordings remain forward too; their minimum is about +0.86°. These bounds cover the specified recordings/tests, not every possible interrupted gameplay history.

The CPU isolation probe uses 300 warm-up and 2,000 measured frames for each of 28 variant/skin/action combinations. Highest skinned p95: **0.132 ms female**, **0.067 ms male**, including CharacterView, contacts, world matrices and skeleton palettes; simulation/drawing are excluded. These are observed timings on the shared Mac, not an OS scheduling guarantee.

## Evidence and reproduction

Evidence is in `test-results/player-anim-r1/`. The paired studio stills replay **recorded production CharacterView poses**, with the game's **25° perspective FOV, polar 0.30π and azimuth π/4**, zoomed onto the courier. Lighting/background are neutral so the exact before/after posture can be compared. The left side is the unmodified merged round-one baseline (`fd1a3560`); the right side is the final body-pose correction (`9560c3eb`; the later held-weapon fix appears in the L1 riding capture). Both variants include idle, walk, run, stop, a 180° turn, bat and riding. Additional transition and hurt samples support the review.

The `game-*.png` and `game-*.webm` evidence uses the **actual L1 renderer**, production lighting, courier materials, camera angle and FOV, at a closer 8 m review radius. Each variant has an idle/walk/stop video (6 s) and a run/turn/fast-click fists-and-bat video (10.75 s). Bike stills cover mount, riding, stopping and dismount; the mounted bike is repositioned from its authored parking space into the clear street between mount and ride capture. Dialogue overlays are hidden in the capture page so they cannot cover the figure. Videos are 800×600 WebM at 20 fps; every intervening simulation pose was evaluated at 60 Hz. Fast attacks use released Shift+LMB clicks every six ticks, exercising the real input queue.

```sh
npx tsx tools/playeranim/record.ts test-results/player-anim-r1/after after
npx tsx tools/playeranim/metrics.ts test-results/player-anim-r1
npx vite --host 127.0.0.1 --port 3377 --strictPort --configLoader runner
E2E_PORT=3377 sh tools/e2e-lock.sh npx tsx tools/playeranim/capture.ts test-results/player-anim-r1 after --game --stills
E2E_PORT=3377 sh tools/e2e-lock.sh npx tsx tools/playeranim/game-capture.ts test-results/player-anim-r1
sh tools/sim-lock.sh npx tsx tools/skinpilot/profile.ts test-results/player-anim-r1 --both
```

Preserve the historical before recordings: regenerating them on revised code would invalidate the comparison. Recording JSON is gzip-compressed after capture; the comparison and metric tools accept it directly. Intermediate image/video frames are not retained.

## Validation

Final command results are recorded in `test-results/player-anim-r1/gates/` and summarized in `validation.json`.

All required gates exited 0 on the final gameplay implementation (`ca68bf9a`). The final harness adjustment (`500c9a22`) only changes evidence setup. No failures or browser flakes. Browser runs were headless, at most two workers, Chromium using ANGLE Metal on macOS. The smoke matrix also exercised mobile Chromium viewports and WebKit. No second server was started on 3300; lane ports were 3377 (capture) and 3378 (validation).

| Exact command | Result |
| --- | --- |
| `npm run typecheck` | PASS, both TypeScript projects; also rerun by verify |
| `npm run lint` | PASS, no warnings; also rerun by verify |
| `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2` | **291 passed**, 0 failed, 86 files |
| `E2E_PORT=3378 SIM_WAIT=1 E2E_SKIN=1 npm run verify -- E04` | **52 unit/sim + 30 browser passed**, 0 failed; 677 nonmatching Vitest tests skipped |
| `E2E_PORT=3378 SIM_WAIT=1 E2E_SKIN=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/bicycle.spec.ts tests/e2e/bicycle-stability.spec.ts tests/e2e/combat-wiring.spec.ts tests/e2e/arrival-stability.spec.ts --project=chromium --workers=2` | **10 passed**, 0 failed (4 bike, 2 arrival, 4 combat); rider/arrival cover skin 0 and 1 |
| `E2E_PORT=3378 SIM_WAIT=1 E2E_SKIN=0 npm run test:smoke` | **6 sim + 23 browser passed**, 0 failed; 723 nonmatching Vitest tests skipped |
| `E2E_PORT=3378 SIM_WAIT=1 E2E_SKIN=1 npm run test:smoke` | **6 sim + 23 browser passed**, 0 failed; 723 nonmatching Vitest tests skipped |
| `sh tools/sim-lock.sh npx tsx tools/skinpilot/profile.ts test-results/player-anim-r1 --both` | 28 profiles of the corrected CharacterView poses at `9560c3eb`; maximum skinned p95 0.132 ms, below 0.5 ms |

Verify and smoke were not wrapped in an extra lock; they own their locks. Shared simulation-slot waits account for the long wall time. Initial ad-hoc capture attempts needed a framing/setup correction (over-tight crop, auto-mount toggle, invalid relocated parking fixture); the final authored-parking capture completed for both variants with zero errors. Those were capture setup failures, not passing test claims. Redundant captures/build output were removed, and unrelated E04/E05/E19 generated artifacts were restored rather than committed over historical evidence.

## Review and limits

Reviewed the paired game-angle renders and frame sequences extracted from all four final L1 videos, plus hurt/mount/ride/exit stills. Both L1 runs visited all seven unarmed beats and all three bat beats under 10 Hz released clicks, with 19 attack events each and zero console errors. The final captures end dismounted with ride weight zero.

- **Idle / walk / start / stop:** the belly-forward silhouette is gone. Idle breath/weight motion is modest; elbows stay bent rather than hanging as straight rods. Walking has a visible opposite arm/leg rhythm and lateral support shift. Stops settle over the feet without leaning back.
- **Run / 90° and 180° turns:** the torso stays over the advancing leg; arms no longer fold up past the face. Reduced cadence improves the rhythm. Turn release avoids dragging a planted leg across the body, though the pivot remains a quick game turn.
- **Unarmed / bat / hurt:** the knee takes a shorter route to contact, punches and bat retain their planted support, and fast clicks cycle through the authored chain. Hurt recovers toward the forward idle. Extreme bat poses still expose the existing stretched strap.
- **Bike:** the rider follows the leaned bike frame, hands settle onto the grips, and root transfer no longer jumps to/from the seat. Held weapons remain hidden until the dismount blend releases. The body transfer is smoother; it is still an IK blend without an authored leg-over-frame step.

Character checklist B is applied as a preservation check against the PO-selected courier rather than claiming the orange courier matches the old red S01/S02 outfit: **PASS** silhouette and proportions retained (no mesh/scale edits); **PASS** courier amber/teal/white identity retained; **PASS** cap, ponytail/hair, bag and wrist details retained; **PASS** eyes/mouth readable in the close game camera. This animation review does not replace the courier asset's existing four-view art review or manual WebGPU sign-off.

No spec criterion was weakened or edited. E04 continues to describe procedural presentation; this lane follows the PO-authorized fitted-skin approach already present in round one. The retained CC0 motion data is the round-one data; the abandoned avatar lane was not imported.

The courier still has short legs and large rigid shoes: 4.5 m/s reads as a brisk stylized run, even at the reduced cadence. Transient cadence during acceleration can exceed the steady rate because phase follows actual travel while gait shape blends. Knee strikes still have only four simulation ticks of windup, so they remain fast. Shoe/toe articulation and natural human stepping over the bicycle frame are not newly authored here; mount/exit is a continuous root/IK blend. The existing messenger-strap/cloth weighting can stretch during extreme bat poses. Those are visible limitations, not claims of motion-capture quality. WebGPU parity remains the repository's manual check.
