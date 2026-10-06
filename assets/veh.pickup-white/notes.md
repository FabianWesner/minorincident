# White single-cab pickup

Reference: reference-upscaled.png, upper three-quarter and lower front/side/rear views.

Square short cab, sloped windshield, gently crowned warm-white roof; long empty cargo
bed with inset ribs and wheel tubs. Thick squat off-road tires, six-lug pressed steel
rims, square grille, paired rectangular lamps, metal bumpers, black mirrors and handles.
Small dents at door midsections and scattered geometric rust at lower seams and edges.
No brands or text appear in the reference; the grille bears a blank fictional oval.

Production bounds are 4.4 × 1.8 × 1.9 m (manifest), Blender +X forward, Z-up;
tire contact is exactly Z=0. Each wheel node is at its axle centre; door nodes are at
front hinges; tailgate node sits on the lower hinge axis. All remaining geometry
is grouped by palette material under body. Light meshes retain separate groups.
Raised wear chips clear the underlying panels by at least 3 mm after scaling.
Opaque dark teal glass avoids alpha sorting; detailed seat/dashboard geometry exists
behind it and is visible when doors open. AO is Cycles-baked into corner colours.
LOD1 targets 12.5% of the full mesh. LOD2 omits microscopic embellishments and
uses 4.5% collapse on the remaining geometry to land near 3% of LOD0. LOD
vertices stay inside the measured hull; wheel/door pivots remain unchanged.
Collapsed bevel triangles are removed before export, and unused UVs are omitted.
