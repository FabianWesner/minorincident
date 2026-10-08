# int.basement-cellar (L4 hiding ending, L5 starting room)

Source: `tools/blender/sslib/fh_cellar.py` via `sslib/fairhaven.py` (interior caps 40k/15k/4k); reference `assets/int.basement-cellar/reference-upscaled.png`.
Cutaway cellar open to +X: stone block walls with stepped tops, 15-step stair along the -Y wall with wooden handrail, steel shelving with crates/jars
on +Y, barrels, flagstone floor, one beam with a hanging warm bulb, heavy planked/iron-banded door in the back (-X) wall.
Materials (6 in the body): khaki, khakiLight, sidewalk, woodWarm, uiDark, emissive windowGlow; the door joint adds planks (woodWarm) + bands (uiDark) = 8 draws.

Interface anchors: `door_cellar` joint (hinge at back wall y=-0.4, `ss_door` axis Z, openAngle -95 = swings into the room, initialState closed),
`cellarDoorSocket` (same name as bld.kessler-hardware), `braceSocket` + two iron `braceBracket` slots and a leaning `braceBar` (bar slot anchor),
`stairTopSocket`, `stairBottomSocket`, `bulbSocket`; clear player aisle y in [-1.3, 1.6] (barrels/crates stay at y >= 1.8, shelves y >= 1.6);
colliders: floor, back/left/right walls, shelves, 15 per-step stair cuboids; light `light:bulb` (powerGroup `cellar`, emissive node body_emi_windowGlow).
