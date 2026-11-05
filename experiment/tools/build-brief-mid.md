# Task: round 3 — rebuild one game asset at a MIDDLE detail level (game-ready GLB)

Timed experiment, round 3 of an iteration to find the right detail level. Work ONLY inside
`/Users/fabianwesner/Workspace/suburban-survivors/experiment/{{SLUG}}/mid/` (read anything, write only there).
Earlier rounds of the same asset (read them, never modify them):
- Round 1 `experiment/{{SLUG}}/sol/` — realistic, ~85k triangles, 300+ draw calls. Verdict: too detailed, too heavy.
- Round 2 `experiment/{{SLUG}}/stylized/` — chunky low-poly, ~3–4k triangles, ~15 draw calls. Verdict: **too simplified**;
  reads as a plain toy block, loses the charm and identity of the reference up close.
**Start by copying round 2's `build.py` into `mid/` and add detail to it**, borrowing ideas from round 1 where they pay off.

## Goal
Turn `experiment/{{SLUG}}/reference-upscaled.png` ({{DESC}}) into a game-ready GLB for
"Suburban Survivors", a Diablo-like isometric action RPG seen from a high, distant camera.
**Stylized, chunky and readable — NOT realistic, NOT highly detailed.** Recognisable at a glance
from the game camera; charming up close like a toy.

## Look (read these before modelling)
- Style target: `experiment/tools/style-bruno.png`. Look closely at the jeep there: still chunky low-poly and flat
  coloured, but with **mid-scale detail** — panel insets, a hood scoop, roof rack, glowing light strips, chunky bumpers,
  wheel arches, recessed windows with frames. That is the level we want: stunning, but not finely detailed.
- North-star game frame: `initial-drafts/sunset-grove-combat-gameplay-mockup.png`.
- Art direction + palette: `specs/01-art-direction.md` (§1 look, §3 palette). Asset contract: `specs/03-asset-pipeline.md`.

What to ADD compared with round 2 (only what reads at 2–5 m distance):
- Softer, more finished forms: bevels (2–3 segments) on all main body edges; slightly tapered/curved hood, roof and
  cabin instead of plain boxes; wheel arches cut or flared around the wheels.
- Recessed or framed windows (separate dark glass inset with a body-colour or black frame), door seams as shallow
  insets, simple door handles and mirrors.
- Wheels: tyre + rim + hub cap (3 parts, 12–16 sides), not a single cylinder.
- Lights that glow: headlights, tail lights, indicator strips, light bar with separate lamp segments (`emi_*`).
- Identity graphics as geometry: livery stripes/panels, the big word (POLICE / SCHOOL BUS) as thick extruded text,
  badge/stop-sign shapes, grille with a few slats, bumpers with depth.
- Keep everything else from round 2: flat palette materials (`pal_*`, `emi_*`, metallic 0, roughness 0.6–0.9,
  no clearcoat/transmission/textures), toy proportions, oversized wheels.

What NOT to add back: bolts, lug nuts, wipers, tread blocks, tiny lettering, gauges, hinges, fine trim lines.

- **Budget (hard):** police car 6,000–10,000 triangles; school bus 8,000–12,000. Aim for ≤ 30 draw calls after joining
  static parts by material (animatable parts stay separate and named: wheels, doors, lights).
- Blender frame: +X front, +Z up, -Y = side visible in the reference, metres, sits on z = 0.

You may read `assets/fire-engine-blender/build_fire_engine.py` for helper patterns (bmesh boxes,
prisms, lathe, booleans, GLB export, `stage()` camera/Cycles setup), but its realistic detail level
and materials are exactly what we do NOT want here.

## Tools
- Build/render ALWAYS via the GPU slot wrapper:
  `python3 experiment/tools/blender_run.py {{SLUG}}/mid experiment/{{SLUG}}/mid/build.py -- [--render <png>] [--view ref|game|...] [--samples N] [--width W --height H] [--glb <glb>] [--blend <blend>]`
  Your script must implement a `game` view: camera azimuth 45° from the front-left (-Y) side, elevation ~36°,
  25° FOV, distance so the object fills ~1/4 of the frame width (vehicles) — this is how players see it.
- Review renders: `--width 960 --height 540 --samples 16`. Final: `--width 1600 --height 900 --samples 64`
  to `renders/hero.png` (ref view) and `renders/game.png` (game view).
- Three.js check (server already running on 127.0.0.1:3300, do not start another):
  `node experiment/tools/capture_glb.mjs /experiment/{{SLUG}}/mid/model.glb experiment/{{SLUG}}/mid/renders/three`
  (writes study views and a `game` view, for WebGPU and WebGL2, and prints triangle/mesh counts and errors).

## Process
1. Look at the reference and the style images. Write the 3–6 identity features and the simplified
   part list as a comment block at the top of build.py.
2. Build → render ref + game views → compare with the reference → fix. 2–4 rounds; compare against the reference AND both earlier rounds' renders.
   Stop when it looks clearly richer than round 2 up close and still reads cleanly in the game view. Aim to finish
   within 30 minutes.
3. Export `model.glb` + `model.blend`, run the Three.js check, confirm budget.

## Deliverables in experiment/{{SLUG}}/mid/
`build.py`, `model.glb`, `model.blend`, `renders/` (hero.png, game.png, three-*), `report.json`.

Final message = exactly one JSON object (also saved as report.json):
{"slug": "{{SLUG}}", "iterations": <n>, "triangles": <n>, "meshes": <n>, "materials": ["pal_..."],
 "glb_bytes": <n>, "within_budget": <bool>, "webgpu_ok": <bool>, "webgl2_ok": <bool>,
 "identity_features": ["..."], "dropped_details": ["..."], "notes": "<one sentence>"}
