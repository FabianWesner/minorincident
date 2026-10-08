Base-owned wreck variant of `veh.suv-dark` for L3/E21. Runtime loads the base ID with decay `wrecked`; the wrapper is source-only, with no duplicate manifest mesh.

Visual target: Tall SUV and roof rack survive; displaced front corner, bowed roof, empty windows and exposed front-left hub.

Explicit recipes reuse the existing closed native LOD1 geometry for near/middle and native LOD2 for far. Near adds one-segment debris bevels; far omits small impact trim. Impact displacement, folded solid hood, torn door, glazing cuts and exposed axle are authored at all distances. No decimation, dimension fitting, active fire or emissive material. Existing source scale is applied once by the pipeline.

All source sockets/pivots survive as empties. Four wheel owners retain independent geometry (the missing tire retains an axle hub). Non-animated door shells batch with static body materials. All light anchors are retained with wreckLightOff metadata and no ss_light emission. Source collider anchors survive. Root physics is heavy, not pushable or kickable; placement, smoke and behavior belong to the level/runtime lane.

Measured delivery and command results: `docs/reports/l3-traffic-and-army-vehicles.json`. Visual evidence: `test-results/l3-traffic-and-army-vehicles/veh.suv-dark.wrecked/`.

Concrete visual limitations: Far roof rack loses fine fittings; dark paint makes the cabin openings lower contrast than on the white sedan.

Revision 2: rebuilt from the intact native LOD1/LOD2 with smooth front crush, torn hood and engine bay, glass shards, ajar door, flat front tyre, rust and soot tint; wheels use one tinted material so total draws <= 8.
