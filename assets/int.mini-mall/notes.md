# Mini-mall measurements and parts

Reference: roofless three-bay cutaway, width approximately 3.2 times wall height.
Production footprint 13.4 m along Y × 5.1 m along X, crown height 3.99 m.
Front faces +X; laundry at +Y, pizza in center, phone repair at −Y.

Four fluted wood pilasters with amber lights and chunky caps; inset blue/red/blue
raised shop signs and raised icons; square corridor pavers; sage laundry backdrop;
four hinged washers, stacked dryer, blue chairs, folding cupboard/table with towels,
wire laundry cart and change machine; brick arch oven, tiled/checkered backsplash,
pizza trays with layered toppings, cabinetry and cash register, suspended lamps,
menu and A-board; accessories cards and phones, repair shelves, recessed display
counter, register and stool; three faceted terracotta pots with folded-ridge leaves.
All letters and appliqués stand at least 3 mm clear of their supporting surface.
No real brands, image textures, external meshes or non-palette materials.


Static parts are joined by palette within the interior. Eight washer hinge
nodes and two pendant joint nodes remain separate. All geometry transforms
are baked with positive unit scales, including the source-layout reflection.
Normals use soft bevels and weighted faces; bevel width cannot pinch through
thin plates/cylinders. Deterministic 32-sample Cycles AO is exported as COLOR_0.

LOD1/LOD2 use unbeveled source primitives and closed low-density rims.
Small disconnected detail is culled by size; lettering is limited to the
principal shop names in LOD1 and removed in LOD2. Each LOD has its own vertex AO.
A high render via --view ref also writes a 960×540, 24-sample game view.

## Art registration (2026-10-07)

Measured delivered bounds (X/Y/Z, metres): 5.105, 3.9901, 13.49. Source, named pivots/sockets, palette, front marker and delivered tiers are validated by the production validator. Runtime status is integrated. Five-angle LOD contact evidence: `test-results/art-register/int.mini-mall/lod-contact.png`.
