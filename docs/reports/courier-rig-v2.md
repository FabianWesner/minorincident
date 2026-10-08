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

**CPU** (`tools/skinpilot/profile.ts --both`; CharacterView update + ride contacts + living layer + matrices + `Skeleton.update`; 2,000 frames; with a glance target). Skinned p95 rose from 0.014–0.044 ms (main) to 0.037–0.131 ms, worst female kick p95 0.131 ms, typically 0.05–0.09 ms. That is under the 0.3 ms budget. Per frame inside the living layer: secondary motion ≈ 9.5 µs (bag + ponytail, 2 substeps, apply), helpers 1 µs, look-at 1.6 µs. The rest is the extra bones (mixer tracks, matrices, skeleton palette) and one extra world-matrix pass.

## Evidence

In `test-results/courier-rig-v2/` (git-ignored, small). See the Evidence section at the end, which is filled after capture.

## Validation

See the end of this file.
