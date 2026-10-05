# House A — four-round review

1. **Blockout and full detail:** exported 83,442 triangles / 32 material primitives. WebGPU and WebGL2 loaded without errors. Review found reversed reference presentation, tight framing, and seemingly flat siding.
2. **Presentation and siding profile:** mirrored the authoring Y axis to put the porch on the reference's right; added tapered lap profiles. The game render revealed the inward structural-wall offset was incorrectly forced outward by `copysign`.
3. **Wall placement and footprint:** fixed signed wall depths, centered the footprint, and corrected framing. Profiled siding now reads clearly. Close Three.js review revealed gable infill did not reach the roof underside.
4. **Finish:** closed both main gables and the porch gable, clipped the main gable courses, warmed the window emission, added lightly transparent panes and small interior plant/console/lamp forms. Final source contains only reusable shape helpers and direct part assembly; modifier evaluation is batched before material joins.

## Checks

- LOD0: 84,618 triangles, 33 material primitives, 9 named palette/emission materials.
- LOD1: 12,662 triangles; LOD2: 2,129 triangles. Both preserve required visibility and articulation groups.
- Root at origin; full mesh footprint centered on XY; ground contact Z = 0; facade faces +X.
- Required building root, hideable roof, interior, door, window groups present. Door hinge is on the jamb; lantern pivot is at its wall bracket. Static meshes join by material within these groups.
- No image textures. Vertex-color AO uses deterministic 32-ray geometric visibility. No real brands or added markings.
- Trim, curtain folds, mullions, door panels and glazing layers have positive depth separation. Roof tiles and ridge caps are separate raised solids; clipped valley tiles do not sit on the porch skin.
- Exported light-anchor references resolve to emissive nodes; collider and entry-socket empties export as extras.
- Actual GLB validation checks float finiteness, texture absence, material names, node names, AO colors, lighting references, triangle and primitive budgets.
- Final WebGPU/WebGL2 study and game captures contain no warnings/errors. A second independent game-camera capture is pixel-identical on each backend (1,440,000 pixels, maximum difference 0).

Minor visual limitation: shallow interior silhouettes are simpler and subtler than the reference. No blocking visual or renderer gaps observed. No specs, shared tools, or reference files were modified.
