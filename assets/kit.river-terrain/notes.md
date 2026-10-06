# River terrain kit

Reference layout preserved as four reusable module roots: `waterSurface`, `slopedBank`, `rocks`, `reeds`, below the required `root`. Each root is planted on Z=0. Scene units are metres and the front axis is +X. The exploded display arrangement is intentional, matching the reference sheet.

- Water tile: 4 × 3.6 m, geometric rolling wave surface, cyan wave ridges, raised cream foam, three shoreline stones and grasses.
- Bank: 4.7 × 2.6 m, irregular earth slope rising from 0.22 to 1.27 m, shallow water apron, rounded shoreline rocks, scattered pebbles and grass tufts.
- Four spare moss-faced boulders, varied silhouette and aspect ratio.
- Three spare reed clusters, five cattails with rounded orange seed heads and a companion boulder.

Palette material identities use specification tokens; scalar PBR colors are tuned to the reference's teal water, lavender rocks, warm ochre soil and yellow-green leaves. No image textures, dynamic lights or movable physics are needed for this static terrain. Static parts are joined by material within each module so the modules can be placed independently. Reeds are static terrain dressing rather than articulated objects.

Foam is 10 mm above the cyan ridge, which is itself 28 mm above the analytic wave surface. Both ribbons conform across their width, preserving separation from the triangulated tile. Ambient occlusion is baked to the `ao` corner color attribute. Seed 260 fixes all geometry variation. LOD1 and LOD2 are regenerated from source geometry on every GLB export.

Final GLB counts: LOD0 18,347 triangles / 27 draws; LOD1 2,154 triangles (11.7%); LOD2 517 triangles (2.8%). All finite, zero collapsed triangles, no textures.
