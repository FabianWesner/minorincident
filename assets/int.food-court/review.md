# Production review — int.food-court

Verdict: PASS. Five visual rounds, including the final hero and runtime/LOD QA pass.

## Reference and gameplay review (checklist C)

- PASS — Recognizable at gameplay distance: the L-shaped food counters, colored four-seat tables, planters and two tray islands read clearly on WebGPU and WebGL2.
- PASS — Main layout: generic burger and Asian kitchen stalls span the rear wall; tacos and the Sunset Grove mural occupy the return wall; five seating groups and chamfered front corners follow the reference.
- PASS — Material separation: warm timber counters/planters, pale ceramic floors/tabletops, steel appliances, colored seat cushions and purple structural trim stay distinct.
- PASS — Hidden sides: the cutaway retains thick perimeter walls, a substantial foundation and consistent cornice/column backs.
- PASS — Budget and game faceting: 99,328 triangles and 40 total draw calls; purposeful bevels and separate lamp assemblies remain readable.
- PASS — Branding: only generic food categories and Sunset Grove appear; no real brands or marks.

## Technical and surface QA

- root, interior and separately hideable roof assemblies are present in every LOD.
- Wall sconces retain attachment pivots; suspended lanterns retain top suspension pivots.
- Static meshes join by palette material. No textures are exported. Emissive sconces have valid ss_light anchors; menu illumination is flagged decorative.
- Collider empties describe the floor and perimeter in Blender metres.
- Raised lettering, signs, menu rows, controls and panel plates have at least 3 mm of visible surface separation. Roof strip heights differ; planter/bin rims have no overlapping top faces.
- Baked vertex AO is deterministic and remapped to .55–1 to keep large wall panels readable.
- Three stationary game-camera frames are identical on each backend. Close views at 34.7°/35.3° were inspected: no flickering or broken lettering/panels.
- All GLBs contain finite positions/normals/colors, zero degenerate triangles, valid building nodes and light references, and no image textures.
- LOD1: 11,459 triangles (11.5%); intact coarse structure with simplified detail.
- LOD2: 2,700 triangles (2.7%); intact coarse room/furniture/foliage/menu panels, 25 total calls with 14 separate lamp calls, hence 11 static calls.
- Hero render: 1600 × 900, 96 Cycles samples. Game review: 960 × 540, 24 samples.

## Build maintenance

Primitive creation uses direct BMesh construction. Repeated parts use small focused helpers. LODs reuse captured un-bevelled structural templates rather than fragile slab decimation; LOD2 omits fine ornaments and combines static palette colors.
