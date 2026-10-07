# Task: rebuild one game asset as a STYLIZED low-poly Blender model (game-ready GLB)

Timed experiment, one of ten parallel jobs. Work ONLY inside
`/Users/fabianwesner/Workspace/suburban-survivors/experiment/vending-machine/stylized/` (read anything, write only there).
Other models' builds of the same asset live in `experiment/vending-machine/` and `experiment/vending-machine/sol/` — do not read, copy or touch them.

## Goal
Turn `experiment/vending-machine/reference-upscaled.png` (red Fizz soda vending machine) into a game-ready GLB for
"Suburban Survivors", a Diablo-like isometric action RPG seen from a high, distant camera.
**Stylized, chunky and readable — NOT realistic, NOT highly detailed.** Recognisable at a glance
from the game camera; charming up close like a toy.

## Look (read these before modelling)
- Style target: `experiment/tools/style-bruno.png` (Bruno Simon's folio: chunky low-poly, flat
  colours, strong silhouettes, glowing accents, very few small parts).
- North-star game frame: `initial-drafts/sunset-grove-combat-gameplay-mockup.png`.
- Art direction + palette: `specs/01-art-direction.md` (§1 look, §3 palette).
- Asset contract (names, materials, budgets): `specs/03-asset-pipeline.md`.

Rules that follow from that:
- **Simplify.** Keep the big masses, the silhouette and the 3–6 identity features (e.g. light bar,
  stripe, big wheels, grille). Drop everything smaller than ~10 cm at real scale: no bolts,
  hinges, wipers, lug nuts, tread blocks, gauges, tiny lettering, fine trim, panel seams.
- **Toy proportions.** Slightly exaggerate what identifies the object (chunkier wheels, thicker
  light bar, rounder cab). Bevels are big and soft on main masses (1–2 segments), none on small parts.
  Cylinders 8–16 sides. Flat or simple smooth shading.
- **Flat palette materials only.** Principled BSDF with metallic 0, roughness 0.6–0.9, no clearcoat,
  no transmission, no textures. Name materials `pal_<token>` using the tokens in `specs/01` §3
  (add a new token only if nothing fits, and list it in the report). Lamps/screens/windows that glow:
  `emi_<token>` with emission strength 2–4. Windows that do not glow: flat dark `pal_glassDark`.
  "Chrome" is just a light grey palette colour.
- **Text:** at most one identity word (e.g. POLICE) as thick, simple extruded geometry, or skip it.
- **Budget (hard):** vehicles ≤ 8,000 triangles; buildings/street furniture ≤ 3,000; small props ≤ 1,500.
- **Draw calls:** before export, join static geometry by material. Keep animatable parts separate
  and named with pivots at their joints (`wheel_front_left`, `door_*`, `light_*`, etc.).
- Blender frame: +X front, +Z up, -Y = side visible in the reference, metres, sits on z = 0.

You may read `assets/fire-engine-blender/build_fire_engine.py` for helper patterns (bmesh boxes,
prisms, lathe, booleans, GLB export, `stage()` camera/Cycles setup), but its realistic detail level
and materials are exactly what we do NOT want here.

## Tools
- Build/render ALWAYS via the GPU slot wrapper:
  `python3 experiment/tools/blender_run.py vending-machine/stylized experiment/vending-machine/stylized/build.py -- [--render <png>] [--view ref|game|...] [--samples N] [--width W --height H] [--glb <glb>] [--blend <blend>]`
  Your script must implement a `game` view: camera azimuth 45° from the front-left (-Y) side, elevation ~36°,
  25° FOV, distance so the object fills ~1/4 of the frame width (vehicles) — this is how players see it.
- Review renders: `--width 960 --height 540 --samples 16`. Final: `--width 1600 --height 900 --samples 64`
  to `renders/hero.png` (ref view) and `renders/game.png` (game view).
- Three.js check (server already running on 127.0.0.1:3300, do not start another):
  `node experiment/tools/capture_glb.mjs /experiment/vending-machine/stylized/model.glb experiment/vending-machine/stylized/renders/three`
  (writes study views and a `game` view, for WebGPU and WebGL2, and prints triangle/mesh counts and errors).

## Process
1. Look at the reference and the style images. Write the 3–6 identity features and the simplified
   part list as a comment block at the top of build.py.
2. Build → render ref + game views → compare with the reference → fix. 2–4 rounds; stop as soon as
   it reads clearly as the asset in the game view and looks charming in the ref view. Aim to finish
   within 30 minutes.
3. Export `model.glb` + `model.blend`, run the Three.js check, confirm budget.

## Deliverables in experiment/vending-machine/stylized/
`build.py`, `model.glb`, `model.blend`, `renders/` (hero.png, game.png, three-*), `report.json`.

Final message = exactly one JSON object (also saved as report.json):
{"slug": "vending-machine", "iterations": <n>, "triangles": <n>, "meshes": <n>, "materials": ["pal_..."],
 "glb_bytes": <n>, "within_budget": <bool>, "webgpu_ok": <bool>, "webgl2_ok": <bool>,
 "identity_features": ["..."], "dropped_details": ["..."], "notes": "<one sentence>"}
