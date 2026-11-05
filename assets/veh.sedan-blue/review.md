# Production review

Four modeling rounds; final hero and game renders reviewed against reference-upscaled.png.

- Compact, boxy four-door silhouette, short trunk, sloping windshield and flat roof preserved.
- Blue paint, dark glazing seals, gray bumpers, warm rectangular headlamps, amber indicators and red tail lamps retained.
- Softened body edges, actual wheel-arch openings, six-slot hubcaps, grille slats, handles, mirrors, wipers, fuel flap, exhaust and cabin furnishings included.
- Four hinged door assemblies and four axle-centered wheel assemblies remain separate. Front and brake lamps remain separate from the body.
- All static components joined by palette material. No image textures or real-world branding.
- Trim, registration plates, handles, glass and lamp lenses use separated geometry rather than coplanar overlays.
- Final hero: 1600 x 900, 96 samples. Final Blender game view: 960 x 540, 24 samples.

Export and backend verification recorded in report.json and backend-check.jsonl. Distance exports are model.lod1.glb and model.lod2.glb.

Final GLB: 36,796 triangles, 38 draw calls. WebGPU and WebGL2 both report zero console errors/warnings. Repeat game-camera images are pixel-identical on both backends; no visible overlay flicker. Export audit confirms AO, required nodes, separate motion groups, valid lamp-mesh references and no textures. Verdict: passed.
