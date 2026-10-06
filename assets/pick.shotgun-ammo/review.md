# Lightweight pickup review

Performance revision passes the requested geometry budget: LOD0 1,249 triangles, LOD1 624, LOD2 356; each has six draw calls. GLB JSON independently checked for triangle counts and all seven original node names. No manifest registration or reference edits.

Reviewed the regenerated 1600×900 96-sample hero and 960×540 game renders. Open carton silhouette, red/gold shell cue, cream/red packaging and chunky `12 GA / AMMO` label remain readable. Three broad eight-sided shapes replace five individual detailed cartridges; small primers, stepped shell bases, fine wear and extra bevel segments are intentionally removed. Palette batches and raised label clearances remain intact. Vertex AO is rebaked for the simplified geometry.

Browser validation results are recorded in renders/three-validation.jsonl and report.json.

Fresh WebGPU and WebGL2 study/game captures pass with no console warnings, console errors or page errors. Both report 1,249 triangles and six meshes; no visible z-fighting in the reviewed game views.
