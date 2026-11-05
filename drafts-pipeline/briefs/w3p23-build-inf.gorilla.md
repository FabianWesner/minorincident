Build the hero-tier 3D model of `inf.gorilla` (Zombie gorilla (escaped from the zoo): huge, knuckle-walking, silverback, glowing red eyes, wounds) as a Blender `bpy` build script and export a game-ready GLB.

Outcome: a stunning, faithful, animation-ready model of this infected for "Minor Incident" (isometric zombie action RPG,
three.js WebGPU/WebGL2). It is a MAIN object, so it gets our highest detail tier.

Source of truth:
- Reference: `assets/inf.gorilla/reference-upscaled.png` (turnaround) and `assets/inf.gorilla/reference.png` (original crop);
  the original sheet in `initial-drafts/` for context. Match outfit, colours, hair, proportions (chibi, head ≈ 1/4 of height,
  survivor ≈ 1.4 m tall; see `specs/01-art-direction.md` §6).
- Character contract: `specs/03-asset-pipeline.md` §4.1 (conventions), §4.4 (rigid-part models, stump caps), §7 required
  nodes for category `infected`. Palette tokens: `specs/01-art-direction.md` §3.
- Quality bar = "round 1": compare `experiment/police-car/sol/renders/hero.png` and `assets/fire-engine-blender/renders/hero-ref.png`
  (rich, finished, soft-bevelled forms, many purposeful parts). Reuse helper patterns from
  `assets/fire-engine-blender/build_fire_engine.py` and `experiment/*/sol/build.py` where useful.

Requirements:
- Proportion reference for infected: `assets/inf.common-worker/renders/hero.png` (accepted): head ≈ 1/3 of height, lunging stance with torso leaned forward, knees bent, arms reaching forward, big clawed hands, chunky limbs and shoes, thick hair volumes.
- Smooth, sculpted-looking stylized forms (subdivision surfaces applied before export, smooth shading), a real face
  (eyes, brows, nose, mouth; glowing red eyes `emi_infectedEye` for infected), hair as volumes, clothing as separate
  shell parts (hood, jacket, straps, shoe soles), accessories from the reference.
- Rigid parts with pivots at the joints and exactly the node names of §7 for `infected`; infected also get hidden stump caps.
  Relaxed stance as in the turnaround.
- Materials: palette colours by token (`pal_*`, `emi_*`), glTF-friendly Principled BSDF scalars, no image textures.
- Soft budget: ≤ 60k triangles for survivors/corgi, ≤ 40k for infected (crowd LODs come later). Report the count.
- Blender frame: +X forward, +Z up, -Y = the model's right side as seen in the reference's 3/4 view; feet on z = 0.

Tools: build/render ONLY through `python3 experiment/tools/blender_run.py ../assets/inf.gorilla assets/inf.gorilla/build.py -- [--render <png>] [--view <name>] [--samples N] [--width W --height H] [--glb <glb>]`
(caps concurrent GPU renders; review renders 960×540 at 24 samples). Three.js check (dev server already on 127.0.0.1:3300):
`node experiment/tools/capture_glb.mjs /assets/inf.gorilla/model.glb assets/inf.gorilla/renders/three`.
Work only inside `assets/inf.gorilla/` (do not touch the reference images).

No coplanar decals (≥ 3 mm offset). Characters must match the chibi proportions of the accepted survivors/zombies.

Process: study the turnaround → build → render front, side, back and 3/4 → compare with the reference → fix. 3–5 rounds.
Then a pose test: rotate `armL`/`foreArmL`/`legR` (and for infected toggle `stump_armL`) and render it, to prove the pivots
and hierarchy are right.

Done means: `assets/inf.gorilla/build.py`, `model.glb`, `renders/hero.png` (3/4 view, 1600×900, 96 samples), `renders/turnaround.png`
(front/side/back/3-4), `renders/pose-test.png`, Three.js captures without console errors on WebGPU and WebGL2, and
`report.json` = {"id","triangles","meshes","nodes_ok":bool,"missing_nodes":[],"rounds","webgpu_ok","webgl2_ok","gaps":[..]}.
Before finishing, compare your final renders with the reference once more and simplify anything in build.py that is
more complex than needed. Final message = the report JSON.
