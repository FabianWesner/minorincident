# Final review — npc.helicopter-pilot

Five visual rounds: initial sculpt; continuous garments; helmet webbing and cloth
refinement; final strap fit and rear tailoring; native mesh density and deterministic
tessellation. Final hero, turnaround and pose renders were compared again with the
supplied references after the last rebuild.

- Height 1.414 m, approximately quarter-height helmet/head, ground contact z=0.
- Ivory helmet, smoky goggles, boom microphone, ear defenders, olive flight suit,
  shoulder stars, buckled harness, utility belt/holsters, gloves, boots and wing pack.
- Complete modeled face underneath the lowered visor; layered brown nape hair.
- Required 19 named joint/socket nodes, correct proximal-to-distal hierarchy.
- Pose test moves armL, foreArmL and legR together with dependent geometry/sockets.
- Subdivision and bevels applied; 15 rigid GLB meshes, 62 material primitives.
- 54,388 triangles; finite positions, valid indices, no zero-area triangles.
- Existing palette tokens, scalar Principled materials, baked vertex AO, no textures.
- Identical canonical geometry hash from two builds. No collapse decimation remains.
- WebGPU and WebGL2 final GLB captures have no console errors or warnings.
- All work is confined to this asset directory; supplied reference images untouched.

The visor uses opaque smoky polycarbonate for stable cross-backend rendering.
Curved geometry and a low-roughness scalar material represent its reflective lens.
The face includes eyes, eyebrows, nose, cheeks, mouth and chin below/behind the visor.
