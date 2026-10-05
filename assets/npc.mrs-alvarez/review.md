# Mrs. Alvarez — final asset review

Compared `reference-upscaled.png` and the original crop with `renders/hero.png`, the front/side/back/three-quarter panels in `renders/turnaround.png`, `renders/pose-test.png`, and both Three.js renderer captures. Five build/render rounds completed; final hero is 1600×900 at 96 Cycles samples, review and pose views are 960×540 at 24 samples.

Character checklist:

- PASS — Silhouette: swept silver hair and bun, round glasses, cardigan, apron, gloves and chunky gardening shoes identify the elderly neighbor from all four views.
- PASS — Identity colors: lavender cardigan, violet trousers, sage/olive apron with cream trim, mismatched pink/green pockets, khaki gloves and tan shoes follow the turnaround.
- PASS — Proportions: approximately 1.45 m tall; facial head volume about 0.36 m, with enlarged adult chibi hands and shoes. Feet contact the ground within 0.01 mm.
- PASS — Accessories: geometric daisies and red flower clusters, pocket seams, brass fasteners, shoulder straps, rear apron bow, hair clasp, spectacle bridge/temples, rolled cuffs and raised shoe laces are present.
- PASS — Readability: glasses, eye contrast, silver hair and floral apron remain visible in the gameplay-camera capture.

Asset checklist:

- PASS — Required layout: all 19 character nodes exist, with proximal-to-distal limb parenting and hand weapon sockets; joints use unit scale and local pivot coordinates.
- PASS — Material separation: all materials use Principled BSDF scalars and named pal_* identities; no image textures, skins, lights or cameras are exported.
- PASS — Hidden sides: back cardigan seam, swept rear hair, bun clasp, apron wrap and tied bow complete the rear silhouette.
- PASS — Budget: under the requested 60,000 triangles; subdivision/bevels are applied before export and smooth normals retain rounded forms.
- PASS — Pose: left shoulder and elbow rotate independently, right leg swings forward, and attached sleeves, gloves, shoes and sockets follow the correct rigid parent.
- PASS — Browser: WebGPU and WebGL2 both load the final GLB with no console warnings/errors or page errors; see browser-check.jsonl.
- PASS — Adult identity and brands: silver bun, gardening outfit and elderly facial design read as an adult; no logos or real-world brands.

Source cleanup: removed intersecting fine fringe ridges and unused UVs, replaced the tubular apron band with a simpler cloth shell, joined static decoration within rigid parents, and consolidated triangle reduction in one helper. The richer reference's fine flyaway hairs and textile weave are interpreted as smooth geometric volumes and raised embroidery.

Integration limitation: the global palette has no lavender, silver, warm skin or sage wardrobe shades. Reference-specific pal_* extensions are declared in materials.json and must be registered in the runtime palette during integration. Only this asset directory was edited.

Rebuild check: FAIL for exact determinism. A second Blender build produces the same 56,986 triangles and bounds but a different GLB/geometry hash despite deterministic inputs and the edge-cost tie-break. See rebuild-check.json. This remains a production-pipeline limitation and is included in report.json; visual/browser validation passes.

Mesh accounting: 15 exported rigid mesh groups become 58 material primitives in Three.js. Report meshes counts the exported glTF meshes.
