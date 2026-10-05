# prop.jukebox production

Reference proportions: 2.10 m tall, 1.12 m wide including collars. +X is the decorated face; Blender +Z is up, feet touch z=0. The back is a solid rounded walnut cabinet, with a separate rear service door hinged along its right vertical edge.

Three visual passes retained the double amber/red arch, red shoulder capsules, stacked nickel foot collars, record-changer fan, 32 raised song cards, six selection buttons, coin dashboard, U neon surround, diamond speaker lattice, scrollwork and ruby crest. Pass 1 established the silhouette; pass 2 reduced redundant curved/bevel geometry to the Side budget and added deterministic 32-ray vertex AO; pass 3 warmed the neon and reduced red emission. Microscopic lettering, patina and translucent cover were omitted to keep the Side object clean and portable.

Static geometry joins by material. The service door remains three material meshes under `door_service`, whose origin is its hinge. All materials use Principled scalar inputs and optional emission; no textures or external resources. `ao` exports as COLOR_0. Lamp meshes are referenced by `light:neon` extras. Root carries heavy-prop physics (180 kg) and a collider sized to the visual bounds.

Final Blender previews: `renders/hero.png` 1600×900, 96 samples; `renders/game.png` 960×540, 24 samples. Three.js captures cover front/rear study and gameplay on WebGPU and WebGL2. `renders/renderer-check.json` records zero console warnings/errors and zero changed pixels across three successive fixed-game-camera frames on each backend.

The shared Vite server initially returned Outdated Optimize Dep responses. After its cache recovered, final captures and temporal checks passed directly with the original viewer and tool, without a bypass or preview changes. Reproduce with:

```
node experiment/tools/capture_glb.mjs /assets/prop.jukebox/model.glb assets/prop.jukebox/renders/three
node assets/prop.jukebox/check-viewer.mjs
```
