# Production review — kit.rail-crossing

Five modeling/review rounds:
1. Full crossing blockout and purposeful mechanical detail. Found cropped rear sign, overly deep signal visors, and sparse shoulder dressing.
2. Changed camera side, widened framing, shortened visors and enriched ballast/grass. Export revealed excessive bevel/fastener triangles.
3. Simplified bevels and tiny fasteners. Final geometry: 17,178 triangles, 28 draw calls; initial LOD1 1,887, LOD2 574. Added warm signal cores, continuous centerline and full framing.
4. Three.js review found overly dark metallic poles; reduced metallic response and softened baked contact AO. Regenerated all LODs and final images.

5. Browser inspection of LOD2 found holes from decimating disconnected thin surfaces. Replaced the LOD chain with authored coarse assemblies: LOD1 2,048 triangles (11.9%), LOD2 512 (3.0%). Whole road slabs and low-sided masts/signals retain the crossing silhouette.

Reference cues retained: twin continuous rails and sleepers, inset wheel-flange channels, paved slab crossing with white edge bands/yellow centerline, two lowered red/white arms, articulated hinges, cabinet locks and screws, twin hooded glowing red signals, raised RAIL ROAD/CROSSING crossbucks, red mast beacons, gravel/rocks/grass on warm earth tile.

Required root present. Gate origins are hinge centers; lamps retain independent named groups. Static surfaces joined by material. Closed stripe solids are ≥6 mm proud; raised letters are ≥7 mm clear of board fronts; road markings are ≥4 mm clear of pavement. No textures. Collider empties and ss_light extras retained in every LOD. Every emissive group has an anchor or decorativeEmissive flag. Ground contact at Z=0; +X forward; all geometry deterministic.

Fine reference weathering and extremely dense individual gravel are represented by slab joints and sparse merged ballast, keeping the 20,000-triangle production budget. No unresolved functional gaps.

Final verification: LOD0, LOD1 and LOD2 each load and render in WebGPU and WebGL2 with zero console warnings/errors. Study/game captures inspected; authored LODs have complete surfaces and retain the crossing silhouette. Final Blender hero is 1600×900 at 96 samples; game image is 960×540 at 24 samples. No z-fighting visible in the reviewed game and angled captures.

## Orchestrator QA correction
Railway readability revised after the initial crossing was judged too similar to a plank road. Track now spans 10.68 m with ~3.2 m exposed beyond both road edges, dark timber sleepers, gray ballast, more substantial steel rail profiles and a timber crossing deck. Signals, red lights, crossbucks and hinged barriers retained. Revised LOD0 18,906 triangles; LOD1 2,568 (13.6%); LOD2 620 (3.3%). Review render qa-track-ref.png inspected before final hero/game renders.

Revised Three.js verification: LOD0, LOD1 and LOD2 load on WebGPU and WebGL2 with errors=[]; railway spans 10.68 m in each GLB. Study/game captures show uninterrupted steel rails and exposed sleepers on both approaches.

Revised final hero (1600×900, 96 samples) and game (960×540, 24 samples) inspected: extended railway, ballast, sleepers and timber deck read clearly; signals and gates remain intact.
