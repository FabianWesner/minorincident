# Flashbang production notes

Reference: upright faceted pale canister, two rows of dark circular vent recesses, blue end bands, warm metal rims, dark stepped fuse, long dog-leg safety spoon, and a gold pull ring. No text or brands appear in the reference.

Physical scale: approximately 0.15 m diameter and 0.35 m height; grounded at Z=0, lever faces +X. The manifest's 1 m dimensions are placeholder values. Real vent openings are built directly into the sleeve with chamfered wells and a dark inner cylinder. Eight vents per row give the visible three-column pattern in the reference view. Palette sidewalk provides the pale metal with a cool lavender tint (#b9a4c0); cool fill lighting reinforces the reference cast. Blue uses policeBlue without emission because the bands are painted metal.

Static geometry joins by palette material. safetyLever (including its warm edge) and pullRing remain separate, with origins at the fuse hinge and retaining pin. grip and front are named empty anchors. Root physics extras and a cylinder collider describe the throwable. Vertex AO is baked deterministically. No textures or coplanar decals.

Four review rounds: initial boolean vents (7635 triangles); simpler boolean vents and reference corrections (6299); direct vent topology (5552); matching bridge edges to remove the sleeve seam (4988). Final direct construction is simpler and more predictable than sequential booleans.
