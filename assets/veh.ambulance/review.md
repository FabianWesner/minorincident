# Production review — veh.ambulance

Three comparison rounds completed. Final hero: 1600×900, Cycles 96 samples.
Final game: 960×540, 24 samples. Three.js study azimuths 35°/215° and game
camera reviewed on both WebGPU and WebGL2. Both report 75,596 triangles,
39 mesh draws and zero console warnings/errors (`three-check.jsonl`).

Round 1 established corrected geometry and overlay spacing; exceeded the
budget (87,892 triangles, 41 calls). Round 2 merged door finishes and reduced
trim density (73,207 / 39), and restored readable LED grids. Round 3 preserved
medical emblem faces to remove faceting, refined windshield appearance,
added vertex AO and the LOD chain, attached static meshes under `body`, and
increased the cab emblem clearance. Final LOD0: 75,596 / 39; LOD1: 10,119;
LOD2: 2,258. No image textures. All palette names use established tokens.

Checklist C passes: white box/cab silhouette, broad red stripe, blue star of
life and AMBULANCE identification, five-module lightbar, axle placement and
compartment arrangement match the reference. The game view remains readable.
Purposeful hardware, softened edges, treads, rims, wipers, mirrors, trim and
lighting assemblies meet the detailed vehicle quality bar. No real brands;
Sunset Grove is the only place name. Cab side glass and lamp optics are
simplified; rear/opposite details are inferred from the one reference view.

Stripes have >=5 mm clearance, intersecting wheel/door regions are cut away,
and emblems/lettering stand proud. Six stationary gameplay frames on each
backend have **zero changed pixels** at a >3/255 threshold. Adjacent 44.8° and
45.2° game views were visually checked: no stripe/decal flicker or interference
(`frame-check.json`, `renders/flicker-*`). This checks observed camera views,
not every possible distance/angle.

Required vehicle nodes and separately named wheel/door/light joints exist.
Wheels pivot at axle centres, doors at hinges; light anchors and collider
extras survive export. Geometry validation is in `validation.json`.

The running Vite server has missing optimized dependency files and originally
returned HTTP 504 “Outdated Optimize Dep”. No shared server or viewer files
were edited. `viewer-preload.mjs` bundles the unchanged `preview/glb.ts` and
intercepts just that module during the prescribed capture command:

```
node --import ./assets/veh.ambulance/viewer-preload.mjs experiment/tools/capture_glb.mjs /assets/veh.ambulance/model.glb assets/veh.ambulance/renders/three
node assets/veh.ambulance/check-frames.mjs
```

The bundle is regenerated on demand; captures and logs are retained. Build
helpers were simplified by removing the unused material set, coordinate
conversion, shutter helper and anisotropy handling. No shared code, specs or
reference images were changed.
