# bld.house-b.w2

Base-owned standing twin for L3 Oak Avenue. Build with `npm run assets:build -- bld.house-b --decay w2`; pack/validate the base. This directory supplies the per-ID source wrapper, not a second runtime registration.

Uses the integrated base's authored native LOD1 forms for near tiers and its native LOD2 forms for distance. No decimation or AABB fitting. Far foliage uses explicit octahedral crowns; lantern fittings become closed caps. Shared palette colors are folded into vertex colors per rigid owner; emissive fixtures stay in `lightsFront`. Root, doors, roof, interior, original light anchors and colliders retain base world matrices.

W2: large diagonal boards, broken glazing voids and two entrance belongings boxes.

| Tier | Runtime triangles | Draws | Materials | Bytes | Footprint IoU |
| --- | ---: | ---: | ---: | ---: | ---: |
| LOD0 | 7098 | 8 | 2 | 94064 | 0.989864 |
| LOD1 | 5588 | 8 | 2 | 76232 | 0.989864 |
| LOD2 | 3900 | 8 | 2 | 56388 | 0.971195 |

Interface: roofs/interiors remain independently addressable; door hinges, light groups and collider anchors remain base-compatible. District placement, navigation, doors state changes and electrical switching belong to runtime lanes.

QA sheets: `test-results/l3-oak-houses-abc/bld.house-b.w2/lod-contact.png`, `comparison.png`, `game-camera.png`, `footprint.png`; detailed measurements are in `delivery.json`. The near mesh intentionally uses the simpler integrated native forms: individual shingles/flowers are omitted. Far trim and foliage are visibly simplified. No runtime/gameplay behavior changes.
