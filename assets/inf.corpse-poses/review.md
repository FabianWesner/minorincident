# Final review — needs-human

All technical deliverables are complete. The combined four-pose GLB has 36,892 triangles and 88 GLB meshes (256 material primitives in Three.js). All four joint hierarchies, named sockets, proximal stump caps, hidden cap scales, known palette identities, finite coordinates, and nondegenerate triangles pass validation. No image textures. WebGPU and WebGL2 captures at azimuths 35°, 215°, and the game camera contain zero console errors or warnings.

Final images inspected against both reference crops and the full infected-workers sheet: 1600×900 / 96-sample hero, 1920×1080 front/side/back/three-quarter sheet, and canonical pose test. The pose test rotates `armL`, `foreArmL`, and `legR`, shows `stump_armL` on `torso` after detaching the arm, and visibly exercises the corresponding supine joints. Every corpse has ground contact within 1e-6 m of z=0.

The four pose silhouettes, civilian shirt/jacket layers, grey trousers, brown hair, red-brown shoes, rolled cuffs, pockets, buttons, laces, raised sole tread, torn knees, open mouths, teeth, brows, noses, ears and emissive red eyes are present. The final comparison still identifies two fidelity gaps: the prone nape exposes more skin than the reference, and the seated hand is held outward rather than resting convincingly on the lap. These need human visual review after the bounded modeling loop; they are retained in report.json.

Five rounds (initial build plus four refinements):

| Round | Triangles | Refinement |
| --- | ---: | --- |
| 1 | 109,632 | Initial complete four-body assembly |
| 2 | 47,276 | Density, brown hair, blue-grey cloth, camera, prone direction and seated face |
| 3 | 36,892 | Nape volume, curled face, seated hips, supine wrists, broad wear and final density |
| 4 | 36,892 | Prone/supine torso contact, external tread, canonical stump proof |
| 5 | 36,892 | Lowered prone head for the grounded corpse silhouette |

Final source review removed the unused pelvis assembly reference and retained a single reused civilian builder with small geometry helpers. No live subdivision modifiers, armatures, texture dependencies, or speculative runtime abstractions. Static details are merged within their rigid joint; named joints and caps remain separate. Reference images are unchanged.
