# Courier figure: what to improve next

Research and proposal only. No game code, spec or asset changed. PO request: *"Also check how to improve the figure even further, maybe a better skeleton, ..."*. Constraint: the courier mesh and identity stay. A full Mesh2Motion avatar replacement was rejected.

Base: `main` at `f4050eb6`, which includes the skinned courier with Astra's retargeted clips and Fable's `CourierGroundContacts` footwork. Every number below was measured on the files in this tree unless a source is cited. Measurement scripts ran in the session scratchpad; the method for each is given so a lane can port it into `tools/skinpilot/`.

## TL;DR

The weakest part of the figure is now the rig and weights underneath the footwork, not the footwork itself. The courier has **16 deforming bones**. It has a single spine joint, no neck, no clavicles, no twist bones and no toes. Its weights come from bone heat on a voxel remesh that has no joint edge loops. Our pinned CC0 Mesh2Motion source already contains a **53-bone** humanoid with spine_01–03, neck, clavicles, ball joints and fingers, plus **178 human clips**. We use 11 of them, and the retarget throws away everything our rig cannot hold.

Extra bones cost almost nothing (about 0.24 µs per bone per frame on the CPU, and nothing measurable on the GPU). The order of work is therefore:

1. A better skeleton and weights.
2. A "living layer": springs, look-at, blink, breathing and lean.
3. More clips from the source we already license.

---

## 1. Current state (measured)

### 1.1 Skeleton

Source: `public/assets/models/char.courier-{female,male}.skin.glb`. Rebuilt by `assets/char.courier-female-skin/build.py`.

```
root                               (non-deforming)
└─ hip            0.62 m above root
   ├─ legL/R      → shinL/R → footL/R          (thigh 0.22/0.24 m, shin 0.18/0.26 m F/M)
   └─ torso       0.052 m above hip  ← the only spine joint, at the waist
      ├─ armL/R   → foreArmL/R → handL/R → weaponSocketL/R (non-deforming)
      ├─ backpackSocket  (deforms: the whole bag, 704 verts, rigid)
      └─ head     0.29/0.32 m above torso  ← no neck joint
```

- There are 19 joints. 16 deform. There is no spine chain, neck, clavicle, twist bone, toe/ball, finger, eyelid, jaw, hair or strap bone.
- Arms hang straight off `torso`. The clavicle and shoulder motion of the source clips is folded into the upper-arm direction (`tools/skinpilot/retarget.ts` `dirMap`).
- `torso` gets the world delta of `spine_03`. All chest bend and twist therefore pivots 5 cm above the hip. In bat and run frames the chest turns as one block (see `test-results/player-anim-fable/compare-female-bat.jpg` in the main checkout).
- The head bone owns **12.1k of 24.5k vertices** (female) and 11.9k of 27.3k (male). Cap, face, hair and ponytail are all rigid on it.
- The retarget maps limbs by **direction only** (`setFromUnitVectors`), so upper-arm and forearm roll is discarded. The hand gets its own world delta. All forearm roll therefore lands in the wrist.

### 1.2 Mesh and weights

| | Female | Male |
| --- | --- | --- |
| Vertices / triangles (one primitive, one material) | 24,522 / 44,620 | 27,327 / 51,124 |
| Head-dominated vertices | 12,134 | 11,916 |
| Vertices with 1 / 2 / 3 / 4 influences > 1 % | 18,411 / 4,987 / 802 / 322 | 20,818 / 3,999 / 1,649 / 861 |
| Unique vertex colors (AO present?) | **18 (flat palette, no AO)** | same pipeline |

The body is a voxel remesh (5.5 mm) decimated to 14k triangles, then weighted by bone heat with hand, foot and head reach clamped. That gives uniform triangle soup with no edge loops at the elbows, knees or shoulders. The rigid courier (`skin=0`) bakes Cycles AO into `COLOR_0` (`tools/blender/sslib/ao.py`). The skin build paints flat palette colors instead, **so the skinned courier lost its baked AO**. This is a free visual regression to recover.

**Blend-band width** (5–95 % span along the bone of vertices weighted more than 10 % to both parent and child; female / male):

| Joint | Band | Verts in band |
| --- | --- | --- |
| elbow | −3.0…+3.3 cm / −4.2…+3.5 cm | 93 / 88 |
| wrist | −2.4…+2.2 cm / −2.5…+3.2 cm | 217 / 95 |
| knee | −4.3…+5.3 cm / −5.2…+1.8 cm | 99 / 566 |
| shoulder | −5.9…+7.7 cm / −8.6…+6.4 cm | 358 / 421 |
| waist (hip→torso) | −1.3…+4.5 cm / −0.8…+2.4 cm | 169 / **27** |
| neck (torso→head) | **+0.9…+2.0 cm** / −3.9…+3.2 cm | 109 / 306 |

The female neck is effectively a hinge, and so is the male waist.

**Deformation probe.** Each joint was posed alone with rest equal to bind, and the bind-pose mesh was skinned with linear blend skinning (LBS, what three.js does) and with dual-quaternion skinning (DQS) for comparison. The "volume" column is the ratio of the joint-centred fan volume of the triangles in the band; 1.0 means preserved. The "stretch" column is the worst edge length relative to rest. Values are female / male.

| Pose | LBS volume | DQS volume | LBS max stretch |
| --- | --- | --- | --- |
| elbow flex 120° | **0.71 / 0.69** | 1.01 / 0.97 | 1.9 / 2.2 |
| wrist twist 90° | **0.80 / 0.89** | 0.99 / 0.99 | 1.8 / 2.0 |
| knee flex 90° | **0.79 / 0.81** | 0.96 / 0.99 | 1.8 / 1.9 |
| hip flex 80° | 0.86 / 0.78 | 1.07 / 1.05 | 1.8 / 2.0 |
| shoulder forward 90° | 0.89 / 0.97 | 1.10 / **1.46** | 2.4 / 2.2 |
| shoulder abduct 80° | 1.00 / 1.05 | 1.20 / **1.36** | 2.0 / 2.3 |
| torso twist 45° | 0.88 / 0.89 | 1.00 / 1.00 | 1.5 / 1.5 |
| head turn 60° | 0.95 / 0.86 | 1.00 / 1.00 | 1.3 / 1.7 |

The elbow, knee and wrist lose 20–30 % of their volume, the classic LBS collapse. DQS fixes those joints but makes the shoulders balloon by 10–46 %, the known DQS bulge ([Kavan et al. 2007](https://users.cs.utah.edu/~ladislav/kavan07skinning/kavan07skinning.html)). Edge stretch near 2× inside 3 cm bands is what reads as the "stretched strap" and a pinched elbow in the r1 report.

**What the clips ask of the wrist and neck.** These are peak values in `library.skin.json`, before runtime posture work:

| Clip | Hand twist about forearm L / R | Head vs torso | Torso vs hip |
| --- | --- | --- | --- |
| walk / run | 38° / 12°, 49° / 29° | 26°, 24° | 39°, 56° |
| jab / cross | 81° / 25°, 55° / 90° | 29°, 40° | 38°, 51° |
| bat-1/2/3 | **127–179° / 169–179°** | **99–125°** | 47–52° |

A 170° twist across a rigid hand and a ±2.5 cm wrist band collapses the wrist under LBS. A 100°+ head turn across a 1 cm neck band shears the collar. Both are hidden today mainly because the game camera is high and the motion is fast. They are the first artefacts a closer camera or slower clip will show.

### 1.3 Screen size (what the player can actually see)

The game camera uses fov 25°, radius 19 m and polar 0.30π. At 1080p the courier is about **186 px tall**: about 128 px at maximum zoom-out (1.45×) and about 370 px at zoom-in (0.5×). The head is about **63 px** (the female head is about a third of the figure), each hand about 18 px and each shoe 24–34 px.

The cap visor covers the brows from this pitch (see `test-results/player-anim-r1/game-female-idle-30.png`). Eyes and mouth stay visible, so brow acting has low return.

The sun shadow map is 1024² over a frustum of about 16.4 m radius, so a texel is **about 3.2 cm**. With `normalBias` 0.08, self-shadowing on the figure is essentially absent. The figure is shaded only by N·L and the hemisphere light, plus `ContactShadows`.

### 1.4 CPU cost of more bones

The probe used three r186 in Node with no rendering. Each frame ran AnimationMixer with 2 blended actions, quaternion tracks on every bone plus hip translation, then `updateMatrixWorld` and `Skeleton.update`. It ran 2,000 warm-up frames, then 20 × 500 timed frames on the shared M4.

| Bones | 19 | 30 | 41 | 55 | 65 | 41 + 8 spring bones |
| --- | --- | --- | --- | --- | --- | --- |
| Median µs/frame | 4.0 | 6.6 | 9.3 | 12.7 | 15.6 | 8.1 |

That is roughly **0.24 µs per bone**. Going from 19 to about 45 bones adds about 6 µs, which is 2–8 % of the 0.07–0.3 ms CharacterView budget. The real cost lies in `CourierGroundContacts`, IK and the repeated `updateMatrixWorld(true)` calls in `CharacterView`, not in bone count.

On the GPU, skinning is per vertex with a fixed 4 influences. three's TSL skinning reads `skeleton.boneMatrices` as a mat4 uniform buffer (64 B per bone). That is 4 KB at 65 bones, well inside WebGL2's guaranteed 16 KB UBO (256 bones), and the same code path serves WebGPU. Bone count is free on the GPU. Vertex count matters a little: the mesh is skinned twice per frame (main pass plus shadow pass), about 55k skinned vertices in total, which is negligible for one hero.

---

## 2. Ranked improvements

Gain is judged at the game camera. Effort is in lane-days, including QA. Perf is CPU on top of the current CharacterView, with GPU noted where relevant.

| # | Improvement | Visual gain | Effort | Perf | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | **Skeleton v2**: spine (2 segments plus chest), neck, clavicles, 1 forearm twist bone per arm, toe/ball per foot | **High**: chest turns progressively, shoulders shrug and reach, wrists no longer collapse, heel-to-toe roll bends the shoe | 2–3 | +~6 µs | Joints map 1:1 onto Mesh2Motion bones we already retarget from (`spine_01..03`, `neck_01`, `clavicle_l/r`, `ball_l/r`), so the retarget gets *simpler and more faithful*. Keep `torso`, `head`, `hand*` and the socket names so sockets, gear and tests keep working. |
| 2 | **Re-weight with wider bands and twist distribution, plus re-bake AO** into the skin's vertex colors | **High**: fixes the measured 20–30 % elbow, knee and wrist collapse and the strap stretch, and restores crevice shading (under the visor, armpits, legs, collar) | 1–2 (with #1) | 0 | Keep the voxel weld (it makes the single closed mesh). Smooth weights after bone heat; target bands of ±6 cm at the elbow and knee and ±8 cm at the shoulder. Weight the strap to chest and clavicle, not to the arm. Use LBS with twist bones (the industry default) over DQS, given the shoulder bulge measured above. |
| 3 | **Secondary motion**: ponytail (3-bone verlet chain with a head/back sphere collider), bag (2-DOF pendulum about the strap anchor with a hip collider), cap stays rigid | **High** for appeal; the references give the ponytail big volume | 1–1.5 | +3–8 µs | Upgrades today's 1-DOF bag spring (`KeyframeAnimator` `secondary`). Algorithm: [Jakobsen, Advanced Character Physics](https://www.cs.cmu.edu/afs/cs/academic/class/15462-s13/www/lec_slides/Jakobsen.pdf) or the VRM spring bone model ([spec](https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_springBone-1.0), MIT reference [pixiv/three-vrm](https://github.com/pixiv/three-vrm)). Write about 80 lines ourselves rather than add the VRM dependency. It must step on the sim clock so frozen and paused frames stay bit-stable. |
| 4 | **Head and eye look-at** toward the nearest threat, interactable or move target, spread over chest 20 % / neck 30 % / head 50 % and clamped to ±70° yaw and ±25° pitch | **Medium-high**: the figure appears to notice the world; it also motivates the neck bone | 0.5–1 | +~5 µs | Rate-limited, with the weight eased out during strikes and riding. Works without new art. |
| 5 | **Blink and two face states** (alert/scared, fight/angry) using eyelid shells on 2 lid bones and 2–3 mouth shells swapped by bone scale (0 or 1) | **Medium**: eyes stay readable at a 63 px head; brows are under the visor | 1 (art) + 0.5 | ~0 | Use bones, not morph targets. three's morphs are dense over the whole 24.5k-vertex geometry, while lid and mouth shells are already separate head-owned parts in `char.courier-*/build.py`. Blink every 2–6 s, plus on hit. |
| 6 | **Additive layers**: breathing (chest and clavicles), lean into acceleration and turns (roll ∝ yaw rate × speed), directional additive hit reacts on top of locomotion | **Medium** | 1 | +~3 µs | `AnimationUtils.makeClipAdditive` with `AdditiveAnimationBlendMode` is already imported in `KeyframeAnimator` ([three docs](https://threejs.org/docs/#api/en/animation/AnimationUtils)). Hit_Chest and Hit_Head from Mesh2Motion become additive flinches, so hurt no longer replaces the gait. |
| 7 | **More Mesh2Motion clips** (CC0, already pinned): Fighting Idle, Fighting Left/Right Jab, Kick_Breach (to replace the authored kick), Hit_Head, Hit_Knockback, Idle Hurt, Death_A–D, Dodge_*, Turn_Left/Right_90/180 (mocap), Throw Object, OverhandThrow, PickUp_Table, Interact, Push, Shivering, Tired Hunched, Driving | **Medium-high** in combat and story beats | 1.5–2 | 0 (library size +~40 % JSON) | Only after #1, so spine, neck and clavicle data survive the retarget. Strike retiming to the 20 % contact contract already exists in `retarget.ts`. |
| 8 | **Inertialized transitions** instead of 140 ms crossfades for strike → locomotion and hurt | Medium for snappiness | 1 | ~0 | [Bollo, GDC 2018 "Inertialization"](https://www.gdcvault.com/play/1025165/Inertialization) and [Holden, "Dead Blending"](https://theorangeduck.com/page/dead-blending). Optional; the current fades already meet the contact-tick contract. |
| 9 | **Hand poses**: one "fingers" bone plus a thumb bone per hand, giving open, fist and grip | Low-medium: hands are 18 px and already curled mittens matching the reference fists | 0.5 (with #1) | +1 µs | Worth it for hand-over, receive, idle and talk. Full 15-bone fingers are not worth it at this size. |
| 10 | **Daytime hero rim** (reuse `Lighting.rim` and the hero mask at a low weight, about 0.15–0.25, during the day) | Medium for readability: orange on brown asphalt is low-contrast in the L1 captures | 0.25 | 0 | Night rim exists (specs/06 §2). The references show warm rim and back light on every figure. Needs a PO look call. |
| 11 | **Hero self-shadow**: a 512² hero-only shadow map or screen-space contact shadow on the figure | Low-medium | 1 | +1 shadow pass of 1 mesh | The current 3.2 cm texel cannot self-shadow; baked AO (#2) covers most of the gain for free. |
| 12 | **Outline** (inverted hull on the skinned mesh, or r186 `ToonOutlinePassNode` limited to a layer) | Low or uncertain: art direction is a toy diorama with soft shading, and no reference shows ink lines | 1 | +1 skinned draw (hull) | Not recommended unless the PO asks. Rim (#10) improves silhouette read without changing the style. |
| 13 | Corrective blend shapes or DQS | Low after #1–2 | 1.5 | Morphs are dense: about 300 KB per target and per-vertex work | [Pose Space Deformation, Lewis et al. 2000](https://www.scribblethink.org/Work/PSD/PSD.pdf). Revisit only if a close-up camera appears. A custom TSL DQS node is feasible on both backends but would need the shoulders masked back to LBS. |
| 14 | Retopology with real edge loops (quad body of about 8–12k triangles) | Medium, mostly at the extreme bat and kick poses | 3+ (art) | Lower vertex cost | Highest-quality fix, but it touches the PO-approved look. Prefer #2 first and measure again. |

**Chibi proportions vs animation.** The head is about 0.49 m on a 1.455 m figure, and the arm (shoulder to wrist) is only 0.29 m (female) / 0.38 m (male). Adult-proportioned clips therefore put the hands *inside* the cap during overhead bat wind-ups, and head turns over 60° make the head intersect the shoulder. The retarget already halves head motion. With a neck bone (#1) it should instead clamp head yaw relative to the chest, about ±70°. Each clip should also get an arm-raise clearance check (hand or bat must not enter the head sphere). Strides stay short; that is solved by Fable's cadence fit and should not be fought with longer legs.

---

## 3. Recommended plan (3 lanes)

Each lane keeps `?skin=0` working and keeps the simulation untouched. Each also runs the gates the earlier courier lanes used: `npm run typecheck`, `npm run lint`, `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2`, `E2E_SKIN=0/1 npm run test:smoke` and `E2E_SKIN=1 npm run verify -- E04`.

### Step 1: `lane/courier-rig-v2` (skeleton, weights, AO) · about 3–4 days

Scope:
- Extend `assets/char.courier-female-skin/build.py` (the male reuses it) with these bones: `spine`, `chest` (keep the runtime name `torso` on the chest joint so sockets and gear don't move), `neck`, `clavicleL/R`, `foreArmTwistL/R`, `toeL/R`, plus *reserved, unanimated* `pony1..3`, `bagSwing`, `lidL/R` and `mouth`. That is about 38 deforming bones.
- Smooth the weights and widen the bands. Twist bones take 50 % of the hand roll. Weight the strap to chest and clavicle. Bake AO into `COLOR_0` with `sslib/ao.py`, multiplied by the palette color.
- Update `tools/skinpilot/retarget.ts` to map the spine segments, neck, clavicles and ball as world deltas, and to split forearm roll between the twist bone and the hand. Keep the 11 existing clips and their contact timing. Update `characterNodes` consumers only where needed; the new bones are optional nodes.
- Port the scratch deformation probe (method in §1.2) into `tools/skinpilot/deform.ts` or `deform.py`, together with the band-width and clip-twist probes.

Acceptance tests:
- Deformation probe, both variants, LBS: elbow 120° and knee 90° volume ≥ 0.85 (from 0.69–0.81); wrist twist 90° ≥ 0.92; maximum band edge stretch ≤ 1.6 (from 1.8–2.4); neck and waist band ≥ ±3 cm.
- No clip frame twists the hand more than 90° relative to its twist bone; head yaw relative to the chest stays within ±75° in every clip frame.
- Existing `skin-pilot.test.ts` contact, turn and stop tests and the melee contact-tick and leg-step bounds pass unchanged. Chest pitch is never backward (r1 metric).
- `tools/skinpilot/profile.ts --both`: skinned p95 ≤ 0.3 ms, and the median rises by at most 0.015 ms over `main`.
- Game-camera capture (`tools/playeranim/game-capture.ts`): rest-pose silhouette pixel IoU ≥ 0.97 against the current skin (identity preserved). Paired bat, run and idle strips are reviewed for chest twist, shoulder shrug and the wrist.
- Both GLBs stay within +15 % of current bytes after meshopt (`tools/skinpilot/compress.ts`).

### Step 2: `lane/courier-alive` (springs, look-at, blink, additive) · about 3 days

Scope:
- A `CourierSecondary` module after ground contacts: a 3-segment verlet ponytail with sphere colliders (head and upper back) and a 2-DOF bag pendulum about the strap anchor with a hip collider. It steps on the sim clock with a fixed substep, and frozen and paused frames restore state like the other procedural layers.
- `CourierLookAt`: chest, neck and head distribution, with targets supplied by presentation (nearest infected within 6 m, interactable, or click target), clamped and rate-limited, faded out in strikes and riding.
- Blink (random 2–6 s, deterministic seed per actor, plus on hurt). Face state `calm | alert | fight` from existing sim state (threat nearby, attacking), driving the lid and mouth bones from Step 1. This needs lid and mouth shells in the head build.
- Additive breathing and lean (yaw-rate × speed roll ≤ 8°). Day hero rim at a low weight behind a look uniform for PO tuning.

Acceptance tests:
- After a run-to-stop, ponytail and bag tip velocities fall below 2 cm/s within 0.8 s. No ponytail particle enters a collider sphere (distance ≥ radius − 2 mm) across all recorded `test-results/player-anim-*` sequences.
- A frozen frame (same tick evaluated twice) gives a bit-identical pose. Paused stepping is deterministic across two runs.
- Look-at: head yaw relative to the chest ≤ 70°, angular speed ≤ 360°/s, weight 0 during strike contact ticks.
- Blink: mean interval within 2–6 s over 60 s, with the lids closed for 80–150 ms.
- CPU p95 rises by at most 0.03 ms. The smoke and E04 browser suites stay green with skins on and off.

### Step 3: `lane/courier-clips-v2` (Mesh2Motion clip expansion and hit reacts) · about 2–3 days

Scope:
- Retarget, with the Step 1 mapping: Fighting Idle (combat stance when armed or near a threat), Turn_Left/Right_90/180 (mocap) as upper-body turn anticipation layered over Fable's step turns, Kick_Breach (to replace the authored kick), Hit_Chest and Hit_Head as **additive** directional flinches, Hit_Knockback, Death_A–D, Throw Object or OverhandThrow, PickUp_Table, Interact and Idle Hurt (low HP).
- Keep the 20 % contact retime and the planted-strike pelvis attenuation. Add an arm-clearance check (hand or bat outside the head sphere) to the retarget.
- Update `THIRD_PARTY_NOTICES.md` with every new source clip name at the pinned commit.

Acceptance tests:
- Every new clip: zero missing clips; the leg-joint step per 60 Hz frame stays < 46° (the existing bound); loops close exactly; strike contact lands on the existing sim contact tick.
- Additive hit react during a walk: stance-foot slide stays < 0.1 cm (the Fable metric), and the chest returns to its pre-hit pose within 0.4 s.
- Kick_Breach: feet stay locked except the kicking foot, which removes the "only visible foot slide in combat" noted in `player-anim-fable.md`.
- Clearance: in 0 frames does a hand or bat enter the head sphere.
- PO review on the game-camera strips: fight idle, kick, hurt, death and throw.

---

## 4. Licensing

| Source | License | Use here |
| --- | --- | --- |
| [Mesh2Motion](https://github.com/Mesh2Motion/mesh2motion-app) human base, addon and mocap GLBs (178 clips, 66-joint skeleton) | Code MIT, art/rigs/animations **CC0** | **Recommended.** Already pinned (`79f3f61a`) and attributed. |
| [Quaternius Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) 1 and [2](https://opengameart.org/content/universal-animation-library-2) | **CC0** (the free Standard tier is about 45 clips; Pro/Source tiers are paid but still CC0) | Fine. UAL2 adds melee combos and zombie locomotion, mainly useful for infected. Similar UE-style rig, so the retarget can reuse the Mesh2Motion mapping. |
| [CMU Graphics Lab Mocap](http://mocap.cs.cmu.edu/faqs.php) | Custom permissive terms: free use, including in commercially sold products, **but no reselling of the data, even converted**; acknowledgement requested ([4TU FBX mirror notice](https://data.4tu.nl/datasets/0448aab2-3332-449f-a8e2-d208cb58c7df/1)) | Allowed, but raw BVH needs cleanup (foot skate, noise) and is not CC0. Committing retargeted JSON to a public repo is arguably "redistributing converted data", so get a legal read before use. Low priority, since Mesh2Motion covers our needs. |
| [Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) | Royalty-free inside a finished product, but **no distribution of raw character or animation files**; Adobe account terms ([Adobe community FAQ](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400)) | **Avoid.** Our clips live as editable JSON in `src/` and the GLBs are fetchable, which is close to raw redistribution. It is also not a permissive license under AGENTS.md. |
| [100STYLE](https://zenodo.org/record/8127870) | CC BY 4.0 (attribution) | Allowed with attribution. Stylized locomotion mocap; heavy and needs retargeting. Optional reference for "scared" and "tired" walk styles. |
| [LAFAN1](https://github.com/ubisoft/ubisoft-laforge-animation-dataset) (CC BY-NC-ND), [Bandai Namco motion dataset](https://github.com/BandaiNamcoResearchInc/Bandai-Namco-Research-Motiondataset) (CC BY-NC), [AMASS](https://amass.is.tue.mpg.de/license.html) (non-commercial) | Non-commercial | **Excluded.** |
| [pixiv/three-vrm](https://github.com/pixiv/three-vrm) spring bone | MIT | Fine as a reference or dependency; recommended as a reference only (we need ~80 lines, not VRM loading). |

## 5. Sources for techniques

- Dual-quaternion skinning and its shoulder bulge: Kavan, Collins, Žára, O'Sullivan 2007, <https://users.cs.utah.edu/~ladislav/kavan07skinning/kavan07skinning.html>
- Pose space deformation (corrective shapes): Lewis, Cordner, Fong 2000, <https://www.scribblethink.org/Work/PSD/PSD.pdf>
- Verlet chains with constraints: Jakobsen, "Advanced Character Physics", GDC 2001, <https://www.cs.cmu.edu/afs/cs/academic/class/15462-s13/www/lec_slides/Jakobsen.pdf>
- VRM spring bone model: <https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_springBone-1.0>
- Inertialization: Bollo, GDC 2018, <https://www.gdcvault.com/play/1025165/Inertialization>; Holden, Dead Blending, <https://theorangeduck.com/page/dead-blending>
- three.js additive clips: <https://threejs.org/docs/#api/en/animation/AnimationUtils>; TSL skinning reads `skeleton.boneMatrices` as a mat4 uniform buffer (`node_modules/three/build/three.webgpu.js`, r186).
- Rim and illustrative character lighting: Mitchell, Francke, Eng, "Illustrative Rendering in Team Fortress 2", NPAR 2007, <https://www.valvesoftware.com/publications/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf>

## 6. Method notes and limits

- The skeleton, weight, band and twist numbers come from the uncompressed Blender outputs `assets/char.courier-*-skin/model.skin.glb`, which match the shipped meshopt GLBs in joints and vertex counts. The deformation probe uses joint-centred fan volume over band triangles. That is a relative indicator for comparing variants, not an absolute anatomical volume.
- The clip twist numbers are clip-local, before runtime pelvis attenuation, posture guard and IK. Runtime values in bat swings will be somewhat smaller, but they still exceed what a 2–3 cm band can carry.
- The CPU bone probe isolates the mixer, matrices and skeleton palette. Production cost is dominated by CharacterView's contact and IK code, measured at 0.026–0.161 ms p95 in earlier lanes.
- The Mesh2Motion skeleton and clip list were read from the pinned commit's GLBs (66 joints including 13 leaf joints; base 87 + addon 75 + mocap 16 clips).
- WebGPU parity is the repository's manual check, as before. Nothing here was rendered on WebGPU.
- The CMU FAQ page could not be fetched directly (TLS error). Its terms are cited from the 4TU mirror notice and should be re-checked before any import.
