# Production review

Four rounds: initial silhouette; saturated lighting and tape bevel/clearance; larger abstract wear marks and tape scuffs; final socket-face clearance correction after close Three.js inspection.

Paired red cylinders, broad blue wraps and diagonal overlap, dark collar, curved fuse and warm spark match the reference's identifying shapes. Wear is simplified into readable palette geometry. The asset is modeled resting on its side with +X toward the fuse; the reference's diagonal presentation is a camera/pose choice. No real-world lettering or brands appear.

Static meshes join by palette; the fuse spark stays separate with a tip pivot. `grip`, `root`, `body`, `col:body` and `light:fuse` export as named nodes. AO is baked into vertex colors, materials are scalar Principled BSDF materials, and no textures are exported. Throwable timing/explosion behavior belongs to the game; this model contains only presentation/light and collision metadata.

Paint patches clear their casing by at least 3 mm, diagonal tape stands above the wide bands, and the socket face clears the collar cap by 4 mm. Final Three.js study and game views are reviewed on both backends for clearance artifacts and readable silhouette.

Final verdict: passes. WebGPU and WebGL2 both report 3,686 triangles / 7 meshes and no console warnings or errors. Corrected socket is clean in the close study view; markings remain stable and legible in game views. Hero: 1600×900, 96 samples. Game: 960×540, 24 samples. Exported positions are finite and all triangles are nondegenerate.
