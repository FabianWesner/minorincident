# bld.metro-entrance.w5

Derived from the existing integrated base GLB independently at each authored distance tier. The import preserves original transforms; no fitting or AABB scaling is performed.

## Delivery

| Tier | Triangles | Asset draws | Materials | Runtime bytes |
| --- | ---: | ---: | ---: | ---: |
| LOD0 | 5886 | 6 | 5 | 94240 |
| LOD1 | 3113 | 6 | 5 | 52556 |
| LOD2 | 1325 | 6 | 5 | 28040 |

Static solids are merged per palette material. LODs inherit the reviewed base authored recipes and use explicit smaller glass, impact and rubble recipes; no decimation. Deterministic seeds: rubble 523, impact 731, AO 17. Physics stays fixed. All rendering/capture is headless.

W5 files are owned by the base: `assets/bld.metro-entrance/model.w5[.lod1/.lod2].glb`, runtime `public/assets/models/bld.metro-entrance.w5[.lod1/.lod2].glb`. The requested dotted ID has a source wrapper, with no conflicting canonical manifest mesh. Existing base scripts and runtime GLBs remain the intact peer.

## Interfaces

Root, body, front, all base sockets and animated-owner transforms are unchanged at each tier. Damage remains inside the original envelope. Original door/nav sockets are protected from rubble. Dark fixtures retain light anchors with intensity zero and no emissive node references; level lanes own lights switching, fire/smoke dressing and placement.

`shutter` and its `ss_door` state are retained. `col:shutter` is parented to that moving owner; `braceSlotSocket` at the unchanged shutter anchor is provided for runtime bracing. Stair treads, inner handrails and shaft walls are unchanged. Rubble is restricted to the outer negative-Y ledge; the route remains clear. The intact base does not contain side glazing; the W5 variant preserves that base architecture rather than adding a new enclosure.
