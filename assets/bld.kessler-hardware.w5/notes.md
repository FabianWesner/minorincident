# bld.kessler-hardware.w5

Derived from the existing integrated base GLB independently at each authored distance tier. The import preserves original transforms; no fitting or AABB scaling is performed.

## Delivery

| Tier | Triangles | Asset draws | Materials | Runtime bytes |
| --- | ---: | ---: | ---: | ---: |
| LOD0 | 18930 | 5 | 4 | 295752 |
| LOD1 | 7033 | 5 | 4 | 109020 |
| LOD2 | 2217 | 5 | 4 | 40768 |

Static solids are merged per palette material. LODs inherit the reviewed base authored recipes and use explicit smaller glass, impact and rubble recipes; no decimation. Deterministic seeds: rubble 523, impact 731, AO 17. Physics stays fixed. All rendering/capture is headless.

W5 files are owned by the base: `assets/bld.kessler-hardware/model.w5[.lod1/.lod2].glb`, runtime `public/assets/models/bld.kessler-hardware.w5[.lod1/.lod2].glb`. The requested dotted ID has a source wrapper, with no conflicting canonical manifest mesh. Existing base scripts and runtime GLBs remain the intact peer.

## Interfaces

Root, body, front, all base sockets and animated-owner transforms are unchanged at each tier. Damage remains inside the original envelope. Original door/nav sockets are protected from rubble. Dark fixtures retain light anchors with intensity zero and no emissive node references; level lanes own lights switching, fire/smoke dressing and placement.

`door_cellar`, `cellarDoorSocket`, `shopDoorSocket` and their base positions are retained. Collapse is above the front-left shop corner; neither cellar nor shop doorway receives rubble. The original sign, chimney and surviving hip roof are the identity landmarks.
