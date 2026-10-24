# Heroine rebind: the TRELLIS.2 heroine on the game's courier rig

Lane `lane/heroine-rebind`, 2026-10-24. PO 10-24: "you can just replace them directly". The heroine is now the
female courier's skinned body under the existing asset ID `char.courier-female`
(`public/assets/models/char.courier-female.skin.glb` and `.skin.low.glb`). There is no switch and no new ID.
The male courier and the rigid `?skin=0` fallback (`char.courier-female.glb` + LODs) are unchanged.
Baselines ("main") are the palette courier from `main`, in the same scenes.

## What was built
- **Source:** the PO's look target, `minorincident_3dpipeline/experiments/heroine-garment-preview-1k-v2/heroine/raw.glb`
  (6,002 tris, 1K map, arm patches, shorts fix).
  - Inspected textured and clay from front, back, side and below (`source-textured-clay.jpg`): clean, no holes.
    The 6k body is faceted under flat shading.
  - The original 30k/2K still has the two arm recesses, so it was not used.
  - No TRELLIS inference was run. The orchestrator's TRELLIS notes (100k export floor, decimate stall, emission bake)
    did not apply: there was no reconstruction, reduction or bake.
- **Build:**
  - `assets/char.courier-female-skin/build.py` (Blender) produces `model.skin.glb`;
  - `tools/assets/courier-tex-compress.ts` encodes the map as WebP q90 and applies meshopt with KHR quantization
    (positions stay float, as in the skin pilot);
  - the old palette build is kept as `build-palette.py`. Its output `rig-source.skin.glb` is the armature input.
- **Skeleton:** the courier's own 39-bone v2 armature: same names, hierarchy and bind convention (alignSkeleton),
  the same elbow/knee/twist/toe helpers, the same sockets with hand-relative offsets, anatomical left = +Y.
- **Deviation from the brief (on purpose):** the joints sit on the heroine's anatomy, not at the female courier's joint
  positions.
  - The courier is chibi. Squeezing the heroine onto its joints would shorten her arms ~25 % and her legs ~15 %,
    raise her ankles 7 cm and break the approved look.
  - The male courier already runs the same clips on his own joints. Stride scale, ground contacts, LimbIK and sockets
    read joints at runtime.
- **Ownership:** computed on the position-welded surface, so UV duplicates share one weight row.
  - Arms come from a flood fill from the hands along mesh edges inside a 5 cm capsule, so the arm–torso gap is never
    crossed. Hands beside the thighs are always hand.
  - The shorts belong to the hip at the waistband and to the thighs below. Arm share: 0.0 (report.json).
  - Shoes are foot, with the toe at the ball. Straps follow the chest/clavicle.
  - The bag bends with the back. Only its outer body takes 35 % of the socket sway.
  - The courier's eased limb partition is used, with a wider knee band for her longer legs.
- **Rest pose and shading:**
  - the legs are posed into the courier stance (16° → 4°, soles flat) and that pose becomes the rest;
  - normals are smoothed on the welded surface (no UV-island seams);
  - the arm-repair caps are re-tinted from the nearest skin texture: they read as light patches before (QA note 2).
- **Game path:**
  - `Materials.fromTexture` / `releaseTexture` is a shared, ref-counted textured route for the crowd and zebra lanes.
    It makes one PaletteMaterial per map with the full game graph (shadow, fill/rim, fog, weather, blood);
  - `CharacterView` and `VehicleOccupant` map `tex_baseColor` to it; `tex_vertexColor` (caps) uses the body's
    vertex material. `tex_` is a valid material prefix;
  - materials are created during level load, before the loading-card prewarm;
  - 6 vertex streams (≤ 8 WebGPU / ≤ 16 WebGL).
  - Tier gear (`acc.courier-gear`) is skipped on the textured body: it is skinned to the old surface and would float.

## Numbers (same scenes, main vs heroine)
| | main (palette courier) | heroine |
|---|---:|---:|
| download, female skin (high / low) | 642 / 641 KB, + 42 KB tier gear | 406 / 406 KB, no tier gear |
| body triangles | 44,620 | 6,002 |
| body draw calls | 1 (+1 tier gear) | 2 (texture + repair caps) |
| decoded texture memory | 0 | 1024² RGBA8 + mips ≈ 5.6 MB |
| look scene, last frame, low (WebGPU = WebGL2) | 21 draws, 40,782 tris, 28,986 shadow tris | 22 draws, 19,438 tris, 7,642 shadow tris |
| look scene, last frame, high | 21 draws, 62,796 tris | 22 draws, 24,178 tris |
| stretch audit, max over 31 clips | 32.4× | 23.6× |
| edge samples > 4× (24 samples per clip) | 2,770 | 1,403 |

- **Stretch audit:** `tools/assets/courier-stretch-audit.ts` (production evaluation: alignSkeleton, retargetClip with
  skin overrides and rigid fallback, driveHelpers; no IK or contacts).
  - Neither body meets the pipeline's 4× bar under raw clips.
  - Worst on the heroine: front shoulder top in the bat swings (23.6×; main 27–32× in the same region).
  - Run is 6.6× vs 2.6× on main (shirt front, spine).
  - Before the bag and hand fixes the heroine had 4,396 flagged samples at 24 steps: an 8× bag seam in the walk and
    10× finger–thigh edges.
  - Files: `stretch-tex.json`, `stretch-base.json`.
- **L1 low p95 frame time: not measured.** It needs the exclusive quiet-run window (another lane held a browser).
  The heroine draws 21–39k fewer triangles per frame and one more draw call.

## Clip coverage (unchanged game clips)
| action | status |
|---|---|
| idle, walk 2 m/s, run 4.5 m/s, turns | works (skin clips, helper drive, contacts). Turn in place: foot slide 6.4 cm vs 0.3 on main, a real regression |
| fists (jab/cross), kick, bat, axe, handgun, MG, carry, hurt | works in the qa-courier-* scenes, 0 console errors, 0 body overlap, 0 new clipping |
| bike mount / ride / dismount | works (qa-courier-bike, LimbIK adapts to her limbs) |
| throw, interact, hand-over, equip, rack-grab | rigid-library clips, audited (above); no dedicated Scene Lab spec run |
| handover depot | runs. Its gate failure (recipient forearm 1.3 cm from the depot) is identical on main |
| gaps | no blink and no ponytail sim: eyes and hair are texture/rigid with the head. No tier gear (gear tiers 1–4 are invisible). Headlamp (L6) and cure canister (L10) offsets were tuned for the cap courier and were not checked |

## Scene Lab
- **Main and heroine, both:** qa-courier-attack-{fists,kick,bat,axe}, handgun-tracer, long-gun-army-mg, bike, hitreact
  and carry-front all pass.
- **Long-gun MG:** gunBodyHits 1 (torso 11.7 cm) on both.
- **qa-courier-locomotion-f:** passes on main and fails on the heroine (footSlideMaxCm 6.4 > 6, frame 666, turn in place).
  This is the only new red gate.
- **New specs:** `qa-courier-tex-gait` (close camera, walk/run) and `qa-courier-tex-look-z{05,1,15}`.
  The look specs ran at WebGPU and WebGL2 × high and low × zoom 0.5/1/1.5, for both bodies: 24 runs, all pass,
  0 console errors.

## Sheets (every one looked at)
- `source-textured-clay.jpg`: source front/back/side/top, textured and clay. Clean silhouette, no holes, bag and
  ponytail intact. Flat-shaded faceting (game normals are smoothed).
- `final-webgpu-low.jpg`: top row heroine, bottom row main; WebGPU low, zoom 0.5 idle/walk/run/bat, zoom 1, zoom 1.5.
  - Heroine: face, shirt logo, denim and sneakers read at 0.5; the bat sits in the hand; no floating parts.
  - The heroine's head is smaller than the chibi courier's, so at zoom 1.5 she reads smaller.
- `final-webgl2-high-z05.jpg`: the same on WebGL2 high. Colour and shading match WebGPU, with no darkening.
- `gait-ab-final.jpg`: close camera, main and heroine pairs, walk then run.
  - The walk reads natural.
  - At run extremes (0765–0775) her knees knock inward and the trailing shin looks thin and kinked. Main's chunky legs
    hide this. This is the main "not stunning yet" point (QA note 1).
  - The shorts follow the thighs without flaring at these extremes (QA note 3).
- `ab-attacks.jpg`, main and heroine pairs:
  - fists, kick, axe, bat, MG and hit react hold the same poses; the heroine's weapons sit in the hand;
  - the backpack stays on the back in the close MG shot;
  - the handgun scene frame shows a survivor-outfit figure in both runs (not the courier).
- `ab-bike-handover.jpg`: riding and dismount look correct, hands on the bars. The handover frame shows the depot
  (no courier in frame).

## Visual verdict
- **As good as the 9/10 look?** Standing and walking: yes. It is the PO's viewer body, lit by the game, detailed at
  zoom 0.5, and clearly richer than the palette courier.
- **Motion:** not stunning yet. Running shows knock-knees and thin, kinked shins. The bat swings stretch the front
  shoulder (as on main).
- **Glitches:**
  - no holes, floating weapons or light cap patches after the re-tint;
  - turn-in-place foot slide 6.4 cm;
  - no blink or ponytail motion;
  - gear tiers invisible.

## Gates
GATES

## Recommendation
One more round before PROD:
1. the run knees/shins: lower the knee helper bulge, or tune the stance rotation and knee band in the run;
2. the turn-in-place slide;
3. weight the ponytail onto pony1..3 and add blink-free eyes;
4. tier gear refit for the new surface;
5. the L1 low p95 in a quiet window.
Shipping now trades the visible gear tiers and a slightly worse run for a much better look.
