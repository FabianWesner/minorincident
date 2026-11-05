# veh.police-sedan.burned

L5 cold burned dressing, delivered as `veh.police-sedan`'s `burned` decay variant.
No second canonical runtime entry. Build via `npm run assets:build -- veh.police-sedan --decay burned`, then `npm run assets:pack -- veh.police-sedan` (without regeneration).
The per-ID build wrapper also honors `--glb` and `--distance-tier 1|2`.

Derived from the existing base's native authored LOD1 (near/mid) and LOD2 (far), with their metres, body/livery proportions, root transform and non-rendering door, axle/wheel, seat and exit anchors. No AABB fitting, decimation, textures or dependency additions. Near/mid use different local fold subdivisions; far retains its native closed panels and simplified cylinders. Every tier removes glazing, ruptures a large roof section, buckles the roof/hood, collapses tyres and includes exposed seat backs and fallen panels. Broad charcoal/rust palette faces survive runtime material substitution; vertex colors carry baked AO and additional soot tint.

Physics: heavy, non-pushable/non-kickable cold wreck, metal-heavy sound interface, collider proxy. No active flames, emissive materials or ss_light records. Preserved lights/siren owners are dark non-rendering anchors. Placement, fires/smoke, sound playback and survivor cues belong to runtime/level lanes; ten placements are a level population requirement.

Measured production tiers (after packing):

| Tier | Triangles | Draws | Materials | Bytes | Dimensions X/Y/Z m |
| --- | ---: | ---: | ---: | ---: | --- |
| LOD0 | 4040 | 7 | 4 | 93068 | 5.049 / 1.822 / 2.423 |
| LOD1 | 3934 | 7 | 4 | 91044 | 5.049 / 1.822 / 2.423 |
| LOD2 | 1820 | 7 | 4 | 46932 | 5.042 / 1.771 / 2.433 |

Hard caps: 15,000 / 6,000 / 2,000 triangles; eight total draws including wheels, at every tier. Base dimensions/tolerance and contracts are inherited unchanged. `delivery.json` audits anchors against the corresponding integrated native tier.

The older shipped police wreck has 20 draws; the burned-specific `decayBudgets.burned` entry enforces eight without altering that existing variant or widening the base.
