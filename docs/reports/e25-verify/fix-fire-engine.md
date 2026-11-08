# Fire-engine light metadata

The strengthened asset validator exposed 36 unreferenced emissive meshes across the three fire-engine tiers. The source built the lenses, beacons and illuminated markers but never authored their `ss_light` anchors.

Added nine semantic anchors per tier in the Blender source, including the native distance path. References come from each tier's actual meshes. The runtime table adds nine anchors for `veh.fire-engine`; the other entries are unchanged. The validator now resolves light references against the matching authored LOD, while retaining the hero document for geometric contracts.

The checked-in GLBs were repaired using Blender 5.2.2's imported scene metadata and `tools/assets/fire-engine-light-metadata.ts`. Existing nodes, geometry, materials, animations and binary payloads remain identical: [six-file proof](evidence/fire-engine-glb-identity.json). The metadata input is archived alongside this report for reproduction.

Accepted native L1/L2/L5 views have 0 changed pixels out of 921,600 each. L4 initially showed 271 NPC pose pixels; a fresh context with 120 simulation ticks to settle pose blending produced 0 changed pixels: [initial comparison](evidence/fire-engine-accepted-identity.json), [settled L4 comparison](evidence/fire-engine-l4-settled-identity.json). Node time and tie ordering were held fixed in both captures. No rendering parameters changed.

`assets:lights --check`: 370 anchors, 95 assets, zero semantic errors and zero uncovered base-asset emissive meshes. The full gate then exposed four separate school-bus LOD coverage errors; these are tracked in the final audit, rather than hidden with decorative exemptions.
