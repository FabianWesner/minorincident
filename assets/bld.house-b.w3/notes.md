# bld.house-b.w3

Base-owned standing twin for L3 Oak Avenue. Build with `npm run assets:build -- bld.house-b --decay w3`; pack/validate the base. This directory supplies the per-ID source wrapper, not a second runtime registration.

Uses the integrated base's authored native LOD1 forms for near tiers and its native LOD2 forms for distance. No decimation or AABB fitting. Far foliage uses explicit octahedral crowns; lantern fittings become closed caps. Shared palette colors are folded into vertex colors per rigid owner; emissive fixtures stay in `lightsFront`. Root, doors, roof, interior, original light anchors and colliders retain base world matrices.

W3: jagged dark glazing voids, local soot patches and angled damaged sill trim. Fully standing; no collapse or rubble.

| Tier | Runtime triangles | Draws | Materials | Bytes | Footprint IoU |
| --- | ---: | ---: | ---: | ---: | ---: |
| LOD0 | 5830 | 8 | 2 | 79156 | 0.989864 |
| LOD1 | 5622 | 8 | 2 | 76260 | 0.989864 |
| LOD2 | 3894 | 8 | 2 | 56172 | 0.971195 |

Interface: roofs/interiors remain independently addressable; door hinges, light groups and collider anchors remain base-compatible. District placement, navigation, doors state changes and electrical switching belong to runtime lanes.

QA sheets: `test-results/l3-oak-houses-abc/bld.house-b.w3/lod-contact.png`, `comparison.png`, `game-camera.png`, `footprint.png`; detailed measurements are in `delivery.json`. The near mesh intentionally uses the simpler integrated native forms: individual shingles/flowers are omitted. Far trim and foliage are visibly simplified. No runtime/gameplay behavior changes.
