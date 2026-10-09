# npc.civilian-woman-b.aftermath

Derived from `npc.civilian-woman-b` at main `930b24a0`. The native civilian sculpt is evaluated before legacy decimation/batching, using explicit radial, ring, curve and decoration recipes for all three tiers. No mesh collapse or generic LOD regeneration.

The original named rigid owners, sockets, parent relationships and standing joint frames are retained. Static attachments are merged per material within their owner. Eight shared palette materials; non-emissive healthy eyes. Broad dusty clothing fields use vertex color and pale wraps are closed limb volumes. Character physics/animation extras are inherited; no prop physics.

`sourceScale=1` keeps the already measured metre export. The native root scale is retained with owner-local geometry; the pipeline adds no second scale. Bounds are measured over all tiers; the manifest uses a representative size and tolerance to cover omitted near trim.

Runtime interface: `root.ss_standingPose` is JSON containing glTF Y-up local translation, quaternion `[x,y,z,w]` and scale per original joint. Restore it before retreat/walk clips, and hide/remove any `root.restOnlyNodes` (lying variant: `restCushion`). Reset tests verify standing joint positions against the shipped base and existing grounded locomotion tests sample the reset rig. Shelter placement, routine transitions, NPC behavior and weapon assignment belong to the runtime lane. `weaponSocketR` remains an empty for Marcus's handgun.

| Tier | Source triangles | Draws | Materials | Source bytes | Measured X/Y/Z (m) |
| --- | ---: | ---: | ---: | ---: | --- |
| lod0 | 10068 | 36 | 8 | 495288 | 0.5400 / 1.8344 / 0.8255 |
| lod1 | 5932 | 31 | 8 | 315460 | 0.5403 / 1.8308 / 0.8225 |
| lod2 | 1992 | 28 | 8 | 124168 | 0.4674 / 1.7788 / 0.8016 |

Visual evidence: `test-results/l6-shelter-adults-and-injuries/npc.civilian-woman-b.aftermath/` (turntable, authored LOD contact, and reference/peer game-camera sheets). Independent orchestrator acceptance remains required.
