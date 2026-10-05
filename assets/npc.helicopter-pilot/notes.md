# Rescue helicopter pilot

Reference: supplied four-view turnaround and original living-civilians sheet.
Target height: 1.40 m; helmet/head occupies approximately one quarter of total height.
Frame: +X forward, +Z up, -Y character right. Feet sit at zero.

Purposeful parts: ivory flight helmet with dark center strap and ear defenders,
curved smoky goggles, complete face beneath goggles, brown nape hair, chin straps,
articulated microphone, olive flight suit with separate collar/cuffs/pockets,
shoulder rescue stars, dark webbing harness with metal adjustment buckles and
retention rings, belt pouches, thigh holsters, cargo pockets, reinforced knees,
curved glove fingers, rescue boots with welt/laces/tread, compact rear rescue pack
with wing insignia and zipper pulls.

The suit uses existing apronOlive/apronSage tokens; no palette additions needed.
Every detail follows its appropriate rigid parent. All subdivision and bevel
modifiers are applied before export; static geometry is joined per rigid part.
The visor is opaque glossy smoky polycarbonate, matching the reference's lowered
visor while retaining a modeled face underneath. The star patches are raised
geometry. No image textures, logos, skinning, or infected stump caps.

Delivery: --view deliver --render <hero.png> --glb <model.glb> generates four
review views, the 1600×900/96-sample hero, 960×540/24-sample pose test and
turnaround sheet. --pose supports an independent articulation render. Vertex AO
is baked with the shared 32-sample Cycles baker during export. Native mesh
resolutions and fixed triangulation replace unstable collapse decimation.
