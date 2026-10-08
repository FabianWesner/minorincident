# bld.metro-entrance (L4 paired landmark, L5 shelter destination)

Source: `tools/blender/sslib/fh_metro.py` via `sslib/fairhaven.py`; reference `assets/bld.metro-entrance/reference-upscaled.png`.
Stone platform with a real 8-tread stair shaft (descends to -X, bottom at z=0.15), four green posts, standing-seam gabled canopy, lit
FAIRHAVEN METRO sign + roundel, thick green rails and baluster runs, roll-down `shutter` under the sign. Authored LODs.
Materials (7): foliageDark, tealDark, khakiLight, khaki, picketWhite, uiDark, emissive windowGlow; shutter owner adds one draw (8 total).

Interface anchors: `shutter` joint (child slats + bottom bar; `ss_door` kind slide, axis Z; joint translation z=1.2 is the exported
half-open pose, closedOffset 0 = fully closed on the platform, openOffset 1.9 = rolled into the housing), `stairTopSocket`,
`stairBottomSocket`, `entranceSocket` (street side), `shutterSocket`, `front`; colliders: walls, platform, two entrance steps
(stairs and shaft floor are walkable by the level's own metro collision); lights `light:canopyFront`, `light:stairWell` (powerGroup `metro-main`),
`light:signLamp` (powerGroup `metro-entrance`). The shaft is open (no hidden door): underground content belongs to the metro level.
