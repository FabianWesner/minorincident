# Asset review · bld.cafe-corner

Reviewer: Codex, 2026-10-06. Source: `initial-drafts/l1v2-key-locations.png`, panel `bld.cafe-corner`. Comparison: `renders/comparison.png`.

The model preserves the low brick café, pale flat-roof parapet, scalloped Sunset Grove Coffee sign and cup, paired striped awnings, central entrance, warm storefront panes, two umbrella patios, flower boxes/ivy, lanterns, chalkboard, bicycle hoops, right-corner Main St/Pine Ave signs, hydrant and bin. The original crop and cleaned image remain alongside the reproducible source.

Checklist C:

- **PASS — recognizable at gameplay distance.** The roof sign, awnings, twin orange umbrellas and planted curb remain readable in `renders/game.png`.
- **PASS — main part layout.** The central hinged entrance sits between two storefront windows; chalkboard/ivy are on the left and street signs/hydrant/bin on the right, as on the sheet.
- **PASS — material separation.** Red brick, pale parapet/paving, timber furniture/planters, dark metal frames and warm emissive glazing/sign borders use separate shared palette materials.
- **PASS — hidden sides.** Brick end walls, rear service door, louvered vent/downpipe, tar roof seams, HVAC and exhaust pipes plausibly complete the otherwise unseen building.
- **PASS — triangle budget/faceting.** The exported hero is below 100k triangles and 40 draws. Lower tiers retain the silhouette and control nodes; their triangle counts are 13.2% and 3.3% of LOD0. Intentional small faceted leaf volumes read as stylized foliage.
- **PASS — fictional branding.** Only Sunset Grove Coffee and invented street names appear; no real brands or logos.

Review passes / corrections:

1. Initial preview found cached pane origin changes displacing the second window over the sign. Made source meshes unique before joining/origin operations. Corrected sidewalk prop sides and reference camera elevation.
2. Full source measurement found excessive flower/bevel tessellation. Reduced tiny detail tessellation, bounded geometry by tier, retained small pane meshes, and replaced distant paving detail with a continuous slab. Final hero rebuild produced the same canonical topology hash.
3. Inspected the final Eevee hero, front/side/rear, game, roof-off/open-door pose and night views with backface culling ON. Canopy undersides are explicit geometry. Roof visibility removes its sign/parapet/HVAC together; the door rotates outward about its jamb, with the independent furnished interior behind it. Corrected distant shrub ground penetration and widened the side review framing.
4. Delivery cleanup removed unused UVs and Blender's inactive extra color channel. Quantized meshopt-compressed exports retain AO and all interaction/visibility/light/collider nodes; no textures or degenerate faces remain.

Review images retained: `hero.png` (1600×900, Eevee, 96 samples), `turnaround.png`, `game.png`, `pose-test.png`, `night.png`, `comparison.png`, plus final WebGL2 delivery captures. The studio point lights in night.png are preview lights; exported runtime lighting is represented by `light:*` extras.

Known simplifications: shallow opaque warm display panes replace the concept's complex transparent interior view; handwritten neon contours, café clutter, flower shapes and pavement wear are simplified. Eevee renders show the emissive surfaces directly; runtime bloom is owned by the game's lighting/postprocessing. These do not change the café's identifying layout or silhouette.

WebGPU is a manual check under repository policy and has not been claimed as tested. No manifest/registry registration and no commits were made. Detailed measured delivery/browser evidence is in `report.json`.

Verdict: **PASS for the modeled asset and reference layout**, with the stated display/lighting simplifications; headless WebGL2 verification passed for all three delivery tiers with zero console warnings/errors.

Final delivery measurements:

| Tier | Triangles | Draws | Bytes |
| --- | ---: | ---: | ---: |
| LOD0 | 95,455 | 39 | 1,296,940 |
| LOD1 | 12,594 | 39 | 176,940 |
| LOD2 | 3,146 | 29 | 66,420 |

All tiers are centered on X/Z in glTF space to within 1 mm, contact ground within quantization tolerance, and contain zero textures/degenerate triangles. Vertex AO and named control/interaction/light/collider nodes survive compression. Both independent hero rebuilds matched the exported canonical source geometry hash.

The existing study viewer lacks a Meshopt decoder, so its WebGL2 captures use a temporary NodeIO-decoded copy of each delivered GLB; temporary copies were removed. These captures show the delivered single-sided geometry and material parameters, with the supplied game-camera preset. WebGPU and runtime PaletteMaterial/postprocessing integration remain manual/central reconciliation steps.

Reproduce from the repository root (paths remain separate argv entries):

```sh
python3 experiment/tools/blender_run.py ../assets/bld.cafe-corner assets/bld.cafe-corner/build.py -- --glb assets/bld.cafe-corner/model.glb --render assets/bld.cafe-corner/renders/hero.png --turntable --width 1600 --height 900 --samples 96
npx tsx assets/bld.cafe-corner/delivery.ts
sh tools/e2e-lock.sh node assets/bld.cafe-corner/check-viewer.mjs
```
