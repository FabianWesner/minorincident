# Final review — npc.civilian-elderly

Reviewed after five bounded build/render rounds against reference-upscaled.png, reference.png and the original civilian concept sheet. Final hero, front, side, back, three-quarter and pose-test images inspected.

Identity preserved: elderly adult, broad chibi head, white swept hair, moustache and brows, round dark spectacles, brown flat cap, burgundy argyle sweater vest, cream plaid rolled-sleeve shirt, brown cuffed trousers and chunky leather shoes, right-hand curved cane. Fine fabric weave is represented by palette surfaces and raised tailoring rather than textures. Joint seams are inherent to the requested rigid-part animation model.

Asset height 1.399 m; forward +X, Blender Z up, anatomical right -Y; soles and cane ferrule reach z=0. All requested joint and socket nodes exist, and exported elbow/hand and knee/foot child chains were asserted. Applied smooth surfaces export without live subdivision modifiers, image textures, cameras or lights. The pose test rotates armL, foreArmL and legR (plus shinR) and confirms their hierarchy visually.

Final GLB: 58,742 triangles, 56 meshes. Same-material geometry merged within each rigid joint. Material names use pal_* tokens and Principled scalar inputs. Tailoring detail has positive separation from the cloth; no coplanar decals.

WebGPU and WebGL2 captures completed through capture_glb.mjs against the existing port-3300 viewer. Both report 58,742 triangles, 56 meshes and no console warnings, errors or page errors. Gameplay captures show the complete silhouette. Raw results are in browser-check.log.

Deliverables verified: self-contained build.py, model.glb, hero.png (1600×900, 96 samples), turnaround.png (four 960×540 / 24-sample views), pose-test.png, both browser capture sets, report.json. Source cleanup removed temporary assembly files and unused palette entries.
