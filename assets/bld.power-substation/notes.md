# Power substation

Reference proportions: square fenced diorama, approximately 6.1 × 6.5 m curb footprint, 2.6 m fence finials and 4.6 m timber gantries. Entry and raised signs face +X. Two large pale transformer tanks with ribbed porcelain bushings, a central disconnect/control cabinet, four timber power poles, sagging overhead conductors, chain-link perimeter and a narrow hinged service gate.

Static geometry joins by palette material. Gate batches retain a hinge parent at the lower entry-side pivot. Outdoor building roof/interior are semantic empties. All sign faces, lettering, symbols and fasteners stand at least 3 mm proud. No textures or brands. AO baked as vertex color on export. LOD1/2 generated from the completed LOD0 with deterministic Blender decimation.

Orchestrator revised LOD0 budget: 30,000 triangles. Fence diamonds use four-sided rods; curb stones and leaves remain simple. Seed 241 fixes dressing placement. This is an outdoor static fenced utility compound; collider anchor describes the perimeter envelope.

Final simplification: curb stones use one bevel segment; main equipment retains soft two-segment bevels. Text uses Blender's built-in font with a small outline offset (no external font dependency). Leaf and lightning-symbol normals face their viewing surfaces. Collider extras are compound perimeter/equipment cuboids with a separate hinge-parented gate collider.

Final measured density: 25,621 / 2,863 / 816 triangles (LOD0 / LOD1 / LOD2). Five repeated game-camera frames have matching PNG hashes on each renderer: no observed flicker. WebGPU and WebGL2 study/rear/game captures have no console warnings or errors. See validation.json, browser-capture.jsonl and flicker-check.json for machine-readable checks.
