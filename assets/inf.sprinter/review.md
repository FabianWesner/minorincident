# inf.sprinter — final visual review

Reference: `reference-upscaled.png`, `reference.png`, and the infected sheet in `initial-drafts/zombies-civilian-characters.png`. Proportion benchmark: accepted `inf.common-worker/renders/hero.png`.

Five render rounds: outfit blockout; brim/head/stride/sneaker correction; rear hood and laces; warm emissive eye centers and cap-visible pose; final source simplification and refreshed renders. Reviewed front, side, back, and three-quarter views against the turnaround.

- Identity retained: purple panelled cap and gold star, thick swept brown hair, torn ivory hoodie and hanging hood, red undershirt, dark ragged athletic shorts, bare legs, pale socks, red high-top sneakers.
- Adult infected chibi proportions: about 1.64 m high; head/cap about a third of height. Bent staggered knees, forward torso lean, enlarged clawed hands and chunky shoes. Grounded sprint-ready rest stance supports procedural animation.
- Sculpted volumes have applied subdivision and smooth shading. Face includes orbital rims, emissive red eyes with hot warm centers, brows, nose/nostrils, a cut mouth opening, individual teeth and tongue. Clothing has separate shells, seams, binding, tears and folds. Hair consists of thick swept locks.
- All required infected nodes present; joint origins and parent hierarchy verified in the exported GLB. Unit-scale, zero-rotation rest nodes. No weapon sockets; backpack socket retained. Seven zero-scale stump meshes carry hidden/stumpFor extras and remain attached to proximal parents.
- `renders/pose-test.png` rotates armL, foreArmL and legR, separates the left-arm chain, and reveals the shoulder cap. The left-side camera shows the cap clearly.
- Palette materials and scalar Principled BSDF only; no image textures. Blood polygons project 4 mm proud of surfaces. No visible z-fighting in browser captures.
- `renders/hero.png`: 1600×900, 96 Cycles samples. `renders/turnaround.png`: four 960×540/24-sample reviews, assembled into 1680×540. Pose test: 960×540/24 samples.
- Export: 38,254 triangles, 70 mesh objects including hidden caps. WebGPU and WebGL2 captures contain no console errors or warnings.

Verdict: requested render/export/rig/backend deliverables pass, with limits recorded in report.json. Cloth folds, fraying and anatomy remain simpler than the painted reference. Rebuilds keep the same triangle count but Blender's reduction does not produce exactly identical indexed geometry on symmetric forms; determinism experiments were removed because they added complexity without resolving that limitation.
