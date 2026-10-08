# bld.storefront-row.w5

Derived from the existing integrated base GLB independently at each authored distance tier. The import preserves original transforms; no fitting or AABB scaling is performed.

## Delivery

| Tier | Triangles | Asset draws | Materials | Runtime bytes |
| --- | ---: | ---: | ---: | ---: |
| LOD0 | 22403 | 7 | 7 | 333312 |
| LOD1 | 9876 | 7 | 7 | 142516 |
| LOD2 | 3620 | 7 | 7 | 62780 |

Static solids are merged per palette material. LODs inherit the reviewed base authored recipes and use explicit smaller glass, impact and rubble recipes; no decimation. Deterministic seeds: rubble 523, impact 731, AO 17. Physics stays fixed. All rendering/capture is headless.

W5 files are owned by the base: `assets/bld.storefront-row/model.w5[.lod1/.lod2].glb`, runtime `public/assets/models/bld.storefront-row.w5[.lod1/.lod2].glb`. The requested dotted ID has a source wrapper, with no conflicting canonical manifest mesh. Existing base scripts and runtime GLBs remain the intact peer.

## Interfaces

Root, body, front, all base sockets and animated-owner transforms are unchanged at each tier. Damage remains inside the original envelope. Original door/nav sockets are protected from rubble. Dark fixtures retain light anchors with intensity zero and no emissive node references; level lanes own lights switching, fire/smoke dressing and placement.

All six shop/rear door sockets are retained. The bakery corner is broadly collapsed; three shop bays and surviving sign bands/awnings are kept distinct. The water tank and end chimney preserve rooftop identity.
