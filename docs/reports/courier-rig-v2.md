# Courier skeleton v2 and living layer

Lane `courier-rig-v2`, plus the cheap parts of `courier-alive` (plan: `docs/research/figure-improvements.md` §3). Player courier, female and male, fitted skin (`?skin=1`, the default). `?skin=0` (the rigid figure), the simulation, the footwork solver and the bike contacts are unchanged. No push, merge or deploy.

## What changed

**Skeleton v2** (`assets/char.courier-female-skin/build.py`, shared by the male build). All 19 runtime joint names stay where they were (root, hip, torso, head, limbs, `weaponSocket*`, `backpackSocket`), so sockets, gear, `CourierGroundContacts`, rider IK and the tests keep their contract. v2 adds:

| Bone(s) | Mesh2Motion source | Driven by |
| --- | --- | --- |
| `torso` (waist, unchanged position) = spine_01, new `spine` = spine_02, `chest` = spine_03 | 1:1 | retargeted clips |
| `neck` = neck_01 (parent of `head`) | 45 % of the head turn relative to the chest | retargeted clips |
| `clavicleL/R` = clavicle_l/r (parents of the arms) | half the source clavicle, ≤ 20° | retargeted clips |
| `toeL/R` = ball_l/r | — | runtime: the toe stays on the floor when the heel lifts |
| `foreArmTwistL/R` | — | runtime: half the hand's roll about the forearm |
| `elbowL/R`, `kneeL/R` | — | runtime: half the joint angle plus a small crease bulge |
| `eyeL/R`, `irisL/R` | — | runtime: blink (lid squash), gaze shift |
| `pony1..3` (female) | — | runtime: verlet ponytail |

36 deforming bones female, 33 male (39 / 36 joints). Mesh, voxel remesh and triangle count are unchanged (44,620 / 51,124), so the silhouette is the approved one.

**Weights.** Bone heat on the old 16 joints now only decides which limb a vertex belongs to. Each limb is re-weighted with wide eased blends along its chain (upper arm ↔ elbow helper ↔ forearm ↔ twist ↔ hand; thigh ↔ knee helper ↔ shin ↔ foot), the torso by height over hip/torso/spine/chest/neck/head, with neck/head influence limited to the neck column and shoulder tops on the clavicles. The messenger strap loses 80 % of the arm's pull (it rides chest and clavicle). Shoes bend at the ball (`toe*`). Cycles AO (128 samples, 12 cm, relaxed along the surface, 45 %) is baked per vertex into the vertex colours.

**Clips.** `tools/skinpilot/retarget.ts` maps the chain 1:1 and regenerates `library.skin.json` (rotations now 4 decimals). Chest, head, arm and hand world orientations are identical to the previous library in every frame of all 11 clips (max difference 0.002°); only joint positions follow the new spine curvature and shoulders. The authored clips (kicks, roundhouse, knee, mount/dismount) hold the new chain joints at rest, so their poses are exactly as before. `fitCourierLocomotion` and the runtime backward-lean guard work on the whole chain above the waist.

**Living layer** (`src/render/characters/CourierRig.ts`, called by `CharacterView` after the ride contacts as the last pose layer):
- Ponytail: 3-particle verlet chain with head and upper-back sphere colliders. Bag: 2-DOF pendulum about the strap anchor (`backpackSocket`), driven by the anchor's acceleration, with a hip-side limit (3° in, 35° out). Fixed 1/120 s substeps on the presentation clock. A repeated tick restores the captured base pose and re-applies the same state, so paused and hit-stop frames are bit-identical. This replaces the old 1-DOF bag spring for v2 skins.
- Look-at: the locked attack target within 8 m, else the nearest live infected within 6 m (`GameView.threat`). Yaw is spread chest 20 % / neck 30 % / head 50 %, pitch neck 40 % / head 60 %, clamped to ±70° / ±25° and ≤ 360°/s. Targets behind the courier fade out. The weight is 0 while striking, hurt, in scripted actions or riding. The irises shift up to 4 mm toward the target.
- Blink: every 2–6 s (seeded per variant), lids closed about 0.1 s, and immediately on a hurt reaction.

**Assets.** The meshopt GLBs store colours and weights as normalized 16-bit. Size: female 576 → 643 KB (+12 %), male 648 → 711 KB (+10 %).

## Measurements

**Deformation** (`npx tsx tools/skinpilot/deform.ts`; one joint posed from the bind pose; LBS as on the GPU; joint-centred fan-volume ratio of a geometric band, 1.0 = preserved; max edge stretch over edges ≥ 5 mm). v2 is posed the way the runtime does it: torso twist spread over the chain, head turn over neck and head, helpers from `driveHelpers`. Values are female / male. Before = main's v1 skins.

| Pose | Volume before | Volume after | Stretch before → after |
| --- | --- | --- | --- |
| elbow flex 120° | 0.45 / 0.43 | **0.94 / 1.08** | 1.9→2.1 / 2.2→2.3 |
| wrist twist 90° | 0.73 / 0.89 | **0.96 / 0.98** | 1.8→1.6 / 2.0→1.5 |
| knee flex 90° | 0.56 / 0.59 | **0.90 / 0.98** | 1.8→1.9 / 1.9→2.0 |
| hip flex 80° | 0.77 / 0.78 | 0.75 / 0.77 | 1.7→2.3 / 2.0→2.6 |
| shoulder forward 90° | 0.94 / 0.94 | 0.85 / 0.89 | 2.1→4.4 / 2.2→2.9 |
| shoulder abduct 80° | 0.94 / 0.86 | 0.89 / 0.83 | 1.7→2.5 / 2.0→2.6 |
| torso twist 45° | 0.90 / 0.90 | 0.97 / 0.95 | 1.5→1.5 / 1.4→1.6 |
| head turn 60° | 0.94 / 0.72 | 0.93 / 0.81 | 1.3→3.0 / 1.5→2.1 |

The elbow, knee and wrist reach the ≥ 0.9 target. The shoulder loses some volume and stretches more at the strap edge: that is the price of the strap no longer following the arm. Without the strap rule, the shoulder matches v1 (0.94). The head-turn stretch sits on one small sliver at the collar.

**Clips.** The hand never twists more than 90° relative to its twist bone in the bat chain (unit test). Bat clips turn the head up to 97–121° relative to the chest, the same as the approved library. It is not clamped (PO-approved attack pose); v2 spreads it over neck and head instead of a 1 cm hinge. A one-line 75° clamp in `retarget.ts` is available if the PO wants it.

**CPU** (`tools/skinpilot/profile.ts --both`; CharacterView update + ride contacts + living layer + matrices + `Skeleton.update`; 2,000 frames; with a glance target). Skinned p95 went from 0.014–0.044 ms on main to **0.030–0.075 ms** (worst: female ride 0.075 ms). That is well under the 0.3 ms budget. Raw data: `test-results/courier-rig-v2/profile-{before,after}/cpu-profile.json`. Per frame inside the living layer: secondary motion ≈ 9.5 µs (bag + ponytail, 2 substeps, apply), helpers 1 µs, look-at 1.6 µs. The rest is the extra bones (mixer tracks, matrices, skeleton palette) and one extra world-matrix pass.

## Evidence

Everything is in `test-results/courier-rig-v2/` (git-ignored, about 16 MB). The captures use the actual L1 renderer, the game FOV and pitch at an 8 m review radius, 60 Hz sim poses and 20 fps WebM, through `tools/playeranim/fable-capture.ts`. Before = main `333192ba`; after = this branch.

- `compare-{female,male}-{idle,walk,run,turn,bat,ride}.jpg`: six-frame strips at the same video times. The top row is before and the bottom row is after.
- `close-{female,male}-idle.jpg`: zoomed idle pair (AO crevice shading, unchanged silhouette).
- `before/`, `after/`: per variant `*-idle-walk-stop.webm` (5 s), `*-click-turns.webm` (4.75 s), `*-run-turns.webm` (4.5 s), `*-fight.webm` (fists + bat, 7.5 s), `*-bike.webm` (mount, ride, dismount, 4.25 s), plus game-camera stills (idle, walk, run, turn, unarmed, bat, ride).
- `deform-{before,after}.json` and `profile-{before,after}/`: the numbers above. `gates/`: validation logs.

The L1 sim drifts slightly between the two capture runs (the corgi and the exact combo frame differ), so the bat strips match in time but are not tick-identical. Pose orientations are identical by construction (see Clips).

Review: footwork, stops, turns and bike contacts look the same as before. Locked feet, step turns and the grips hold, and the unit footwork/turn/stop/bike tests pass unchanged. The chest no longer hinges at the waist. Shoulders carry the strap without the stretched strap tail visible in the old bat frames. Wrists stay round in bat swings. The bag swings and settles. The ponytail trails in runs and turns. AO darkens under the visor, the armpits and between the legs without making the figure dirty. Glances were not captured because no infected came within range during the capture; unit tests cover them.

## Validation

Headless Chromium (ANGLE Metal), at most 2 Playwright workers, Vitest 2 workers under the sim lock, lane ports 3391 (capture) and 3392 (gates), never 3300. Logs are in `test-results/courier-rig-v2/gates/`.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, 0 warnings |
| `sh tools/sim-lock.sh npx vitest run tests/unit --maxWorkers=2` | **320 passed**, 0 failed, 92 files |
| `E2E_PORT=3392 SIM_WAIT=1 E2E_SKIN=1 npm run verify -- E04` | **61 unit/sim + 32 browser passed** |
| `E2E_SKIN=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/bicycle.spec.ts tests/e2e/bicycle-stability.spec.ts tests/e2e/arrival-stability.spec.ts tests/e2e/combat-wiring.spec.ts --project=chromium --workers=2` | **10 passed** |
| `E2E_SKIN=0 npm run test:smoke` | **6 sim + 25 browser passed** |
| `E2E_SKIN=1 npm run test:smoke` | **6 sim + 25 browser passed** |

New tests are in `tests/unit/render/courier-rig-v2.test.ts`, 11 in total. They cover:
- the chain contract and 1:1 clip tracks;
- frozen-frame bit-identity and run-to-run determinism of the whole pose, including hair, bag and eyes;
- glance clamp ±70°, ≤ 360°/s and fade-out before strike contact;
- ponytail and bag settling below 2 cm/s (relative to their carrier) 1 s after a run-stop, with the ponytail outside both colliders;
- blink cadence (mean 2–6 s, lids closed ≤ 0.15 s);
- hand within 90° of its twist bone through the bat chain.

`skin-pilot.test.ts` changed in two places only. The torso-twist bound now reads the chest (spine_03), because the waist joint alone no longer carries the twist. The authored-kick contact test now expects the new chain joints at rest. Verify regenerates tracked `test-results/epics/*` evidence; those files were restored, not committed.

## Deviations and open points

- **Shoulder volume.** The strap now rides chest and clavicle as requested, which costs shoulder volume and stretch at the strap edge: 0.85–0.89 vs 0.94 forward and abduct, max stretch up to 4.4 on the female. `--strap 0` in the build restores v1 shoulder numbers if the PO prefers the old strap. Hip flex is unchanged (≈ 0.75).
- **Head turn in bat clips.** It is kept at the approved 97–121° relative to the chest (not clamped to the plan's ±75°); v2 only spreads it over the neck.
- **Neck share.** The neck follows the source neck_01 only through the 45 % share of the head turn, not its raw track. This is more robust on the chibi proportions.
- **Bag settle window.** It is 1 s after the stop instead of the plan's 0.8 s: the courier's settle step about 0.4 s after a stop re-excites the bag.
- **GLB size** is +10–12 % (AO colours); the plan allowed +15 %.
- **Not done** (later `courier-alive` / `clips-v2` scope): face states and mouth bones, additive breathing/lean layers, day rim, new Mesh2Motion clips, and the arm-clearance check.
- **Kicks, knee and spinning backfist** (authored clips) still hold the new chain at rest. They keep the approved pose but do not gain spine curvature.
- **WebGPU** parity remains the repository's manual check. The skinning path is shared; the quantized COLOR_0/WEIGHTS_0 use KHR_mesh_quantization normalized attributes.

Reproduce:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python assets/char.courier-female-skin/build.py -- --glb assets/char.courier-female-skin/model.skin.glb
/Applications/Blender.app/Contents/MacOS/Blender -b --python assets/char.courier-male-skin/build.py -- --glb assets/char.courier-male-skin/model.skin.glb
npx tsx tools/skinpilot/compress.ts assets/char.courier-female-skin/model.skin.glb public/assets/models/char.courier-female.skin.glb
npx tsx tools/skinpilot/compress.ts assets/char.courier-male-skin/model.skin.glb public/assets/models/char.courier-male.skin.glb
MESH2MOTION_SOURCE=/path/to/pinned/mesh2motion-app npx tsx tools/skinpilot/retarget.ts
npx tsx tools/skinpilot/deform.ts test-results/courier-rig-v2/deform-after.json
sh tools/sim-lock.sh npx tsx tools/skinpilot/profile.ts test-results/courier-rig-v2/profile-after --both
```
