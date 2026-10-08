# decay.collapsed-facade

New closed-solid facade remnant with two open bays, an exposed floor slab, tall jagged middle pier and a broad fallen wall chunk. The explicit tiers retain the same major silhouette.

## Delivery

| Tier | Triangles | Asset draws | Materials | Runtime bytes |
| --- | ---: | ---: | ---: | ---: |
| LOD0 | 1444 | 4 | 4 | 31288 |
| LOD1 | 516 | 4 | 4 | 12948 |
| LOD2 | 196 | 3 | 3 | 6728 |

Static solids are merged per palette material. LODs use explicit pier, jagged crown, floor slab and fallen-wall recipes. LOD1 omits brick tones and dangling joists; LOD2 omits loose rubble, window posts and most rebar. No decimation or random geometry generation. Physics stays fixed. All rendering/capture is headless.

`wallAttachSocket` = Blender (-.4,0,0); `rubbleSocket` = (1.2,1.2,0). Separate fixed dressing: level lanes choose placement outside protected nav routes. Four palette materials at LOD0/1; three at LOD2.
