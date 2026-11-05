# Dugout construction and QA optimization

Front +X; metres; pad 3.7 × 6.6 m at z = 0. Roof 2.8 × 6.05 m,
approximately 3.23 m high. Rear and end masonry shelter the long timber bench.
The front fence leaves an open entrance. Sunset Grove signs, baseball emblem,
wall motto, bats, bag, bin, crate, curbs, weeds and flowers retain the reference.

Small-structure budget: LOD0 ≤20,000 triangles. Single-segment bevels and
low-segment posts/round parts replace dense geometry. Chain-link appearance
uses one diamond ribbon-grid mesh, with the crossing families separated by
8 mm to prevent coplanarity. Rear vegetation uses 18 low-poly clumps. Flat
geometric lettering sits 7–11 mm proud of its backing; there are no textures.

LOD0: 19,708 triangles / 19 calls. LOD1: 2,216 / 11 calls (11.24%).
LOD2: 520 / 9 calls (2.64%). Both lower LODs are authored solid geometry;
LOD1 keeps actual sign lettering, LOD2 uses distant graphic bands. All preserve
root, roof, interior, front and collider names, with actual roof/interior
children. Static geometry joins by palette material within those groups.
LOD0 uses shared 32-sample baked byte AO; lower tiers use neutral vertex AO.
