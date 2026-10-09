Lakeshore station: 30 × 20 m concourse, connected 60 × 10 m platform and 6 m track bed. Blender Z up; exported Y up, +X forward. Floor ground is zero, walking surfaces are 0.6 m. Explicit LOD recipes reduce bevels, sleepers, stair treads and small trim without decimation. Permanent near-side cutaway; `roof` owns overhead beams and can be hidden independently. Two hinged maintenance leaves remain separate material owners in all tiers. All fixed structures have collider proxies; door colliders follow their hinges and carry `enabledWhen=closed`.

Runtime interface (no mission logic in this lane):
- `maintenanceDoorASocket`, `maintenanceDoorBSocket`: two independent service entries; `maintenanceDoorA/B` leaves and brace sockets.
- `sealedStreetStairSocket`: sealed above-ground arrival; `stairsArrivalSocket` is the stair foot.
- `concoursePlatformSocket`: hall/platform connection.
- `tunnelStartSocket`, `tunnelEndSocket`: platform-end routing ports.
- `shelterCampSocket`: reserved dressing area; place the separate `kit.shelter-camp` asset here.
- Eight cool strip anchors use `metro-main`. Two emergency fixture mounting sockets reserve `prop.emergency-light` on `metro-emergency`. Shelter warmth comes from the separate kit's independent group.

The model's full AABB is wider than the reference thumbnail to honor the requested full platform length. Reference paths are resolved through the main checkout; no reference file was copied or changed.
