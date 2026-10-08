# bld.house-c.w2

Base-owned standing twin for L3 Oak Avenue. Build with `npm run assets:build -- bld.house-c --decay w2`; pack/validate the base. This directory supplies the per-ID source wrapper, not a second runtime registration.

Uses the integrated base's authored native LOD1 forms for near tiers and its native LOD2 forms for distance. No decimation or AABB fitting. Far foliage uses explicit octahedral crowns; lantern fittings become closed caps. Shared palette colors are folded into vertex colors per rigid owner; emissive fixtures stay in `lightsFront`. Root, doors, roof, interior, original light anchors and colliders retain base world matrices.

W2: large diagonal boards, broken glazing voids and two entrance belongings boxes.

| Tier | Runtime triangles | Draws | Materials | Bytes | Footprint IoU |
| --- | ---: | ---: | ---: | ---: | ---: |
| LOD0 | 12488 | 7 | 2 | 167568 | 0.976463 |
| LOD1 | 11460 | 7 | 2 | 155936 | 0.976463 |
| LOD2 | 3308 | 7 | 2 | 54040 | 0.977633 |

Interface: roofs/interiors remain independently addressable; door hinges, light groups and collider anchors remain base-compatible. District placement, navigation, doors state changes and electrical switching belong to runtime lanes.

QA sheets: `test-results/l3-oak-houses-abc/bld.house-c.w2/lod-contact.png`, `comparison.png`, `game-camera.png`, `footprint.png`; detailed measurements are in `delivery.json`. The near mesh intentionally uses the simpler integrated native forms: individual shingles/flowers are omitted. Far trim and foliage are visibly simplified. No runtime/gameplay behavior changes.
