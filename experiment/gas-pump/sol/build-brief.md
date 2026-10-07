# Task: rebuild one game asset as a scripted Blender model and export a GLB

You are one of twenty parallel jobs (another model is building the same asset in experiment/gas-pump/ — do not read or touch its files) in a timed experiment. Work ONLY inside
`/Users/fabianwesner/Workspace/suburban-survivors/experiment/gas-pump/sol/` (read anything, write only there).

## Goal
Turn `experiment/gas-pump/reference-upscaled.png` (red retro gas pump with star globe) into a stunning, faithful,
game-ready 3D model, built entirely by a Python `bpy` script run headless in Blender 5.2, exported
as GLB for a Three.js WebGPU/WebGL2 game. Quality bar: match or beat the worked example below.

## Worked example (read it first, reuse freely)
- Script: `assets/fire-engine-blender/build_fire_engine.py` — a complete fire engine built the same
  way. Copy its helper layer (materials via Principled BSDF, `box` with bevel + weighted normals,
  `prism` side-profile extrusion, `ring`/`frame`, `lathe` surfaces of revolution, `cut` exact
  booleans, `text` with real fonts converted to mesh, array-modifier shutters, `group` empties for
  named assemblies, the `stage()` studio/camera/Cycles setup, GLB export) into your own script.
- Result: `assets/fire-engine-blender/renders/hero-ref.png` (Cycles) and
  `assets/fire-engine-blender/renders/three-az35.png` (Three.js). Reference it was built from:
  `assets/fire-engine/reference-upscaled.png`.
What made it good: rounded bevels on every hard edge, booleans for real cut-outs, separate thin
plates/frames/handles proud of panels, real-font lettering, emissive lamps, clearcoat paint,
chrome/aluminium/rubber/glass materials, both sides + back modelled (mirror the hidden side),
named parts in assembly groups.

## Conventions
- Blender frame: +X = the object's front, +Z up, -Y = the side visible in the reference.
  Real-world-ish metres (a car ≈ 4.5 m long, a door ≈ 2 m). Object sits on z = 0, centred on x/y.
- Glyph fonts: `/System/Library/Fonts/Supplemental/` (e.g. `DIN Condensed Bold.ttf`, `Arial Black.ttf`, `Impact.ttf`).
- Keep materials glTF-friendly (Principled BSDF scalars + emission; no procedural textures).
- Wheels/doors/lights that could animate: separate named objects parented to a group empty
  at their pivot (e.g. `wheel_front_near` at the axle centre).
- Budget: < 150k triangles.

## Tools (use exactly these)
- Build/render ALWAYS through the GPU slot wrapper (it caps concurrent Cycles renders and logs timing):
  `python3 experiment/tools/blender_run.py gas-pump/sol experiment/gas-pump/sol/build.py -- [--render <png>] [--view ref|front|side|rear|far|top] [--samples N] [--width W --height H] [--glb <glb>] [--blend <blend>]`
  Your script must accept these args the same way the example does.
- Review renders while iterating: `--width 960 --height 540 --samples 24`. One final hero render at
  `--width 1600 --height 900 --samples 96`.
- Three.js check (dev server already running on 127.0.0.1:3300, do not start another):
  `node experiment/tools/capture_glb.mjs /experiment/gas-pump/sol/model.glb experiment/gas-pump/sol/renders/three 35 215`
  It prints backend, stats and console errors for WebGPU and WebGL2.

## Process
1. Study the reference closely (view_image). Write down layout/proportions in a comment block at
   the top of build.py: measure positions from the image like the example's `px()` mapping.
2. Build, render the `ref` view, put the render next to the reference (view both), list the
   biggest differences, fix, repeat. Do at least 4 compare/fix rounds; stop when the remaining
   differences are small details or you hit 60 minutes of work.
3. Export `experiment/gas-pump/sol/model.glb` and `model.blend`, run the Three.js check, fix anything
   that looks wrong in real time (washed-out metals, missing parts, black faces).
4. Final hero render: `experiment/gas-pump/sol/renders/hero.png`.

## Deliverables in experiment/gas-pump/sol/
`build.py`, `model.glb`, `model.blend`, `renders/` (review renders, hero.png, three-*.png),
`report.json`.

Finish with exactly one JSON object as your final message (also save it as report.json):
{"slug": "gas-pump", "iterations": <compare/fix rounds>, "triangles": <n>, "meshes": <n>,
 "glb_bytes": <n>, "webgpu_ok": <bool>, "webgl2_ok": <bool>, "self_fidelity_0_1": <float>,
 "matches": ["..."], "gaps": ["..."], "notes": "<one sentence>"}
