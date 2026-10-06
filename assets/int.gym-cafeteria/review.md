# Visual review — int.gym-cafeteria

Asset geometry and readability: PASS, with the viewer camera issue below.

Reference: `reference-upscaled.png`. Final studio review: `renders/hero.png` (1600 × 900, 96 samples), `renders/game.png` (960 × 540, 24 samples). Five authored modeling rounds; shared render-pool queuing caused intermediate output filenames to complete out of order.

- Silhouette/proportions: roofless two-wall school interior on a 16 × 14 m slab; +X forward, ground at z=0. Central hardwood court, left-wall serving station/bleachers, foreground folding dining furniture and eight evacuation cots follow the reference layout.
- Purposeful details: three framed backboards with hoops/nets, red court perimeter and center circle, blue community banners, school paw emblem, scoreboard, hinged exit doors, protective wall padding, chair stacks, basketball rack, meal trays/cups, cot pillows/blankets/bags, relief boxes, wheeled tray trolley and warm sconces.
- Color/materials: palette names only, scalar Principled materials and emission, no image textures. Slightly lighter banner blue than the reference; clean readable game silhouette.
- Surface separation: court perimeter is 5 mm above the boards, straight lines and arcs use distinct elevations at intersections, blanket seam strips float above blankets, lettering stands above backing panels, banners stand ahead of wall columns. No visible mesh z-fighting in the precision-safe game captures.
- Motion: two door hinge nodes and four trolley caster nodes remain independent. Export validation confirms mesh origins within 1 mm of their pivots.
- Geometry: LOD0 94,978 triangles / 29 draw calls; LOD1 11,866 / 29 (12.5%); LOD2 3,093 / 20 (3.3%, 10 static draws plus 10 animated material draws). Main shell retained in both LODs. All bounds remain 16 × 14 m, contact at z=0; no nonfinite or degenerate triangles; AO COLOR_0 on all primitives. Five light anchors and four collider empties.
- Renderer checks: official `capture_glb.mjs` produced study/reverse/game captures on WebGPU and WebGL2 with no errors or warnings, saved under `renders/three-*` and `three-check.jsonl`.

## Viewer depth precision

The unmodified generic viewer uses a 0.01 m near plane and puts this large building roughly 90 m away in game mode. Its WebGL2 game capture exhibits depth artifacts despite physically separated surfaces. `depth_check.mjs` changes only the served camera constructor for a diagnostic browser session, to near=0.5 m; it does not edit preview files. Both renderer captures then show clean surfaces, and two frames a second apart differ by zero pixels (threshold 8/255). Evidence: `depth-check.json`, `renders/three-WebGPU-game-depth-safe.png`, `renders/three-WebGL2-game-depth-safe.png`. The default viewer camera issue remains a follow-up outside this asset's permitted write scope.

Small clock, bins and condiment details are simplified/omitted. The reference images were not modified.
