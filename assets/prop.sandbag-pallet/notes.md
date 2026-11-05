# Sandbag pallet

1.40 × 1.19 m wooden pallet; total height 1.145 m. Four tiers of four khaki sacks, alternating small deterministic offsets. +X forward, Z up, feet at zero. No moving parts, lamps, brands or text appear in the reference.

Round 1 established the open skid/block/deck pallet and faceted stuffed sacks. Round 2 reduced timber bevel and seam density to the Side budget and corrected shell normals. Round 3 increased sack fullness and layer spacing and corrected the studio background. Round 4 widened final camera framing to keep the entire silhouette visible. All static meshes are joined by material. Shared palette materials, deterministic vertex AO and one cuboid collision empty are exported.

Reference painterly fabric mottling and timber wear are simplified into cloth tonal panels and raised timber grain. Seams are actual perimeter tubes; stitches sit above the seam. No image textures or planar decals are used. Three.js study/reverse/game captures passed on WebGPU and WebGL2 without console errors. The game views show no visible z-fighting.

## E26 repetition budget revision

LOD0 is now 2,440 triangles and five draws (79% fewer triangles). Sack shells use single-segment bevelled boxes and eight-segment, three-sided seam tubes. Timber has one bevel segment; all nails, raised grain and individual stitches were removed. The original root, body, collider and palette detail node names remain in every LOD, with removed detail nodes retained as empties. Material palette and four-tier layout are unchanged. The build script accepts --lod: LOD1 is 968 triangles/four draws; LOD2 is 456 triangles/four draws. Exports are model.glb, model.lod1.glb and model.lod2.glb. The revised budget is ≤3,000 triangles.

## Art registration (2026-10-07)

Measured delivered bounds (X/Y/Z, metres): 1.4, 1.1455, 1.19. Source, named pivots/sockets, palette, front marker and delivered tiers are validated by the production validator. Runtime status is integrated. Five-angle LOD contact evidence: `test-results/art-register/prop.sandbag-pallet/lod-contact.png`.
