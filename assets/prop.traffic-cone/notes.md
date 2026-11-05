# Traffic cone

Dimensions: 0.48 × 0.48 m footprint, 0.646 m tall. Twelve flat tapered panels, closed beveled top, molded twelve-sided foot and a thick chamfered square base. One broad reflective ivory sleeve follows the reference, sitting at least 4 mm proud of the cone panels. No lettering or invented accessories.

Two static meshes, each using one material. No animated parts. Root includes light-class kickable/pushable physics (3.5 kg); two collider empties cover the base and cone. Coordinates are metres, Z up, ground at zero; radial silhouette has no directional features. Cycles AO is baked into corner vertex colors named ao with 32 samples and fixed seed.

Palette deviation: §3 contains no orange token. pal_schoolBusYellow uses the reference orange #ff6614 as a scalar color variant; pal_picketWhite uses the prescribed #f2e6dc. Runtime material replacement needs to preserve this orange variant or add a cone-orange palette token during integration. No textures.

Review rounds: 1 established proportions, raised sleeve and closed cap; 2 reduced panel tessellation to the Side budget, corrected render saturation and framing; 3 sharpened the molded base bevel and improved the ivory band's fill light. All static orange parts are joined by material.
