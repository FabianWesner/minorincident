# Hospital exterior review

Verdict: pass with the limitations recorded in report.json. Five hero render rounds compared with reference-upscaled.png. The white/teal three-storey silhouette, raised cross tower, two-column emergency canopy, hospital name, directory, rooftop mechanical plant and landscaped forecourt are present. Hero render: 1600×900 at 96 samples; game render: 960×540 at 24 samples.

LOD0: 85,300 triangles, 26 draw calls. LOD1: 9,965 triangles (11.7%), 22 draw calls. LOD2: 2,606 triangles (3.1%), 16 total draw calls, 12 static calls. Explicit low-detail architecture replaced collapse decimation because decimation removed faces. Closed building volumes, window rhythm, cross, canopy, columns and rooftop silhouette survive both LODs. Roof, hinged doors, collider and light anchors remain named.

All three GLBs were loaded in WebGPU and WebGL2 with no console warnings, console errors or page errors. Front, rear and game screenshots are in renders/. Nearby 44.95°/45.05° game-camera captures reviewed for depth instability: canopy tiles and window/lettering layers remain stable. Hollow window rims, separate panes, removal of the canopy underlay, wider sign clearance and backface culling address the initial far-camera artifacts.

Materials use palette/emission scalars, no textures. Hero vertex AO baked with deterministic seed 2403. Static meshes merge per material within body/roof/door assemblies. Door pivots are at the outer hinges. Source cleanup consolidated the merging routine and replaced LOD window placement branches with matrix transforms.

Fine weathering and planting density are simplified. Directory text is readable in the hero/study view but loses legibility at the distant game-camera scale. LOD2 deliberately omits text that cannot be read at its intended screen size.
