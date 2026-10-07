Build the production 3D model of `wpn.nail-gun` (Yellow nail gun) as a Blender `bpy` build script and export a game-ready GLB.

Tier: **Side** (see `specs/03-asset-pipeline.md` §7 detail tiers). Side object: middle detail; 6–12k triangles (weapons ≤ 6k), ≤ 30 draw calls.

Source of truth:
- Reference: `assets/wpn.nail-gun/reference-upscaled.png` (and `reference.png`). Match shape, proportions, colours, markings.
- Conventions: `specs/03-asset-pipeline.md` §4.1 (frame +X forward, +Z up, metres, on z = 0), §4.4b (lights/physics extras where
  relevant), §7 (required nodes for category `weapon`, tier budgets, draw-call caps). Palette tokens: `specs/01-art-direction.md` §3;
  name materials `pal_<token>` / `emi_<token>`. No real brands; the town is "Sunset Grove" (`specs/99-open-questions.md` R2).
- Quality bar: "round 3" — `experiment/police-car/mid/renders/hero.png`: chunky but detailed (insets, frames, multi-part parts, glowing strips), not micro detail.

Requirements:
- **No coplanar surfaces:** stripes, decals, lettering, posters, badges stand ≥ 3 mm proud of (or are inset into) the surface below.
  The previous ambulance stripe and bus-stop poster flickered (z-fighting) — check the game-camera capture for flicker.
- Animatable parts separate and named with pivots at their joints (wheels, doors, light bar/sirens, lamps) per §7; join the
  remaining static geometry by material to respect the draw-call cap.
- glTF-friendly materials (Principled BSDF scalars + emission), no image textures.

Tools: build/render ONLY via `python3 experiment/tools/blender_run.py ../assets/wpn.nail-gun assets/wpn.nail-gun/build.py -- [--render <png>] [--view ref|game|front|side|rear] [--samples N] [--width W --height H] [--glb <glb>]`
(review renders 960×540 at 24 samples). Three.js check (dev server on 127.0.0.1:3300 already running):
`node experiment/tools/capture_glb.mjs /assets/wpn.nail-gun/model.glb assets/wpn.nail-gun/renders/three` (study + game views, WebGPU + WebGL2).
Work only inside `assets/wpn.nail-gun/` (never modify the reference images).

Process: build → render ref + game views → compare with the reference → fix; 3–5 rounds. Stop when it matches the reference
at the quality bar and reads clearly in the game view.

Done means: `assets/wpn.nail-gun/build.py`, `model.glb`, `renders/hero.png` (1600×900, 96 samples), `renders/game.png`, Three.js captures
without console errors on WebGPU and WebGL2, and `report.json` = {"id","tier","triangles","draw_calls","materials":[...],
"nodes_ok":bool,"within_budget":bool,"rounds","webgpu_ok","webgl2_ok","gaps":[...]}. Before finishing, simplify build.py where it is
more complex than needed. Final message = the report JSON.
