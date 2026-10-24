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
  - the body stands 1.455 m (manifest height). The forearms get a 7° soft bend and the head pivot sits over the
    skull base; the existing skin tests (elbow ≥ 10°, run lean ≥ 8°) caught both;
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
| stretch audit, max over 31 clips | 32.4× | 24.0× |
| edge samples > 4× (24 samples per clip) | 2,770 | 1,375 |

- **Stretch audit:** `tools/assets/courier-stretch-audit.ts` (production evaluation: alignSkeleton, retargetClip with
  skin overrides and rigid fallback, driveHelpers; no IK or contacts).
  - Neither body meets the pipeline's 4× bar under raw clips.
  - Worst on the heroine: front shoulder top in the bat swings (24×; main 27–32× in the same region).
  - Run: 4.9× vs 2.6× on main, at the front hip crease. Round 1 was 6.7×: smoothing had carried thigh weight onto
    the belly; the upper 40 % of the shorts now rides the hip only.
  - Before the bag and hand fixes the heroine had 4,396 flagged samples at 24 steps: an 8× bag seam in the walk and
    10× finger–thigh edges.
  - Files: `stretch-tex.json`, `stretch-base.json`.
- **L1 low p95 frame time and qa:invariants:** left to the orchestrator's quiet window, as agreed.
  The heroine draws 21–39k fewer triangles per frame and one more draw call.

## Round 2 (orchestrator review)
1. **Run (knees, trailing shin):**
   - shorter knee blend (8.5 → 5 cm). The long blend half-rotated the upper shin, which read as a thin, kinked shin;
   - 6° rest stance instead of 4°;
   - the upper shorts no longer carry thigh weight.
   - A Node probe of the skeleton shows the knees are not valgus on either body (max 0 cm inward of the hip–ankle line,
     mean 0.5 cm outward). The X look from behind is the forward knee bend.
2. **Turn-in-place slide 6.4 → 0 cm (gate unchanged):**
   - cause: Scene Lab calibrated the sole from the raw frame-0 idle clip. On her longer legs that clip lifts the feet
     1.3 cm before the contacts blend in, so every planted foot read 8 mm under the floor and the low turn-step counted
     as sliding;
   - fix: Scene Lab now uses the skinned courier's rest ankle height (`CharacterView.restSole`, which is what the
     contacts plant);
   - main female and male locomotion and courier-turns still pass;
   - `qa-courier-locomotion-f`: slide 0, sink 0, yaw drift 0.2°.
3. **Tier gear 1–4:**
   - refit by the existing ray-fit build (`assets/acc.courier-gear/build.py`) on her body. Male gear is untouched;
   - changes for the textured body: the vest and gloves cast outside-in (her loose shirt has inner shells, and one
     glove ray missed into a floating shard); the vest starts at her spine joint, above the high-waisted shorts; the
     pack test uses her bag's socket share;
   - tier gear is drawn again, and `character-loading.test.ts` is back to main's expectations.
4. **Ponytail and blink:**
   - the ponytail is flood-filled from the red hair tie and rides pony1..3 (CourierLiving verlet spring);
   - the colliders shrink to her rest clearance, so the tail is not pushed out of its own bind pose;
   - the courier unit test "ponytail and bag settle … outside their colliders" passes;
   - no blink: her eyes are texture only (no lid geometry), so there is nothing cheap to close.

## Sheets (round 2 build, every one looked at)
- `source-textured-clay.jpg`: the source, textured and clay; clean.
- `r2-gear.jpg`: tiers 0–4 standing (top) and running (bottom; the last one is WebGPU low).
  - Tier 1: gloves and knee pads. Tier 2: olive vest band over the shirt. Tier 3: shoulder and elbow pads.
    Tier 4: forearm guards and goggles on the hair.
  - All hug the body, with no boxes and no floating parts. The round-1 glove shard is gone.
  - The goggles sit high on the hair (her head has no cap), which reads as goggles pushed up.
- `r2-gait-ab.jpg`: main and heroine pairs, walk and run at a close camera. Her run strides are clean: knees bend
  forward, shins full, shorts follow the thighs. She reads slimmer than the chibi courier.
- `r2-look-webgpu-low.jpg`: heroine (top) vs main (bottom), WebGPU low, zoom 0.5 idle/walk/run/bat, zoom 1, zoom 1.5.
  The bat sits in the hand; face, logo and denim read at 0.5.
- `r2-look-webgl2-high.jpg`: WebGL2 high (and one WebGPU high) at zooms 0.5/1/1.5. Shading matches across backends.
- `r2-actions.jpg`: fists, kick, axe, bat, MG (close), hit react, carry and bike. Weapons are in hand, the bag stays
  on the back, the hands are on the bars.

## Scene Lab (round 2 build)
- 24/24 look-matrix runs pass with 0 console errors.
- These pass: qa-courier-locomotion-f (now green), qa-courier-tex-gait, qa-courier-gear-t0..t4 (+ t4 WebGPU low),
  qa-courier-attack-{fists,kick,bat,axe}, long-gun-army-mg, bike, hitreact, carry-front.
- Low look scene, last frame: 22 draws, 19,438 tris (main: 21 draws, 40,782).

## Gates (round 2)
- typecheck and lint pass; the courier unit files pass 46/46 locally.
- Remote `tests/unit tests/levels` on the final build: 465 files passed, 3 skipped, 0 failed (exit 0).
- Smoke (round 1 build): Playwright 31/31, Vitest 6/6.
- qa:invariants and the L1 p95 are left to the orchestrator's quiet window.

## Recommendation
Ship after the orchestrator's quiet-window gates (L1 low p95, qa:invariants). Open items are small:
- no blink (needs lid geometry);
- headlamp (L6) and cure-canister (L10) offsets are not re-checked on her head and bag;
- the bat-swing shoulder stretch, which main has too.
