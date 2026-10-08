# veh.pickup-red.burned

L5 cold burned dressing, delivered as `veh.pickup-red`'s `burned` decay variant.
No second canonical runtime entry. Build via `npm run assets:build -- veh.pickup-red --decay burned`, then `npm run assets:pack -- veh.pickup-red` (without regeneration).
The per-ID build wrapper also honors `--glb` and `--distance-tier 1|2`.

Derived from the existing base's native authored LOD1 (near/mid) and LOD2 (far), with their metres, body/livery proportions, root transform and non-rendering door, axle/wheel, seat and exit anchors. No AABB fitting, decimation, textures or dependency additions. Near/mid use different local fold subdivisions; far retains its native closed panels and simplified cylinders. Every tier removes glazing, ruptures a large roof section, buckles the roof/hood, collapses tyres and includes exposed seat backs and fallen panels. Broad charcoal/rust palette faces survive runtime material substitution; vertex colors carry baked AO and additional soot tint.

Physics: heavy, non-pushable/non-kickable cold wreck, metal-heavy sound interface, collider proxy. No active flames, emissive materials or ss_light records. Preserved lights/siren owners are dark non-rendering anchors. Placement, fires/smoke, sound playback and survivor cues belong to runtime/level lanes; ten placements are a level population requirement.

Measured production tiers (after packing):

| Tier | Triangles | Draws | Materials | Bytes | Dimensions X/Y/Z m |
| --- | ---: | ---: | ---: | ---: | --- |
| LOD0 | 4206 | 8 | 5 | 99380 | 4.725 / 2.114 / 2.563 |
| LOD1 | 4106 | 8 | 5 | 97504 | 4.725 / 2.114 / 2.563 |
| LOD2 | 1693 | 8 | 5 | 45320 | 4.725 / 2.040 / 2.571 |

Hard caps: 15,000 / 6,000 / 2,000 triangles; eight total draws including wheels, at every tier. Base dimensions/tolerance and contracts are inherited unchanged. `delivery.json` audits anchors against the corresponding integrated native tier.
