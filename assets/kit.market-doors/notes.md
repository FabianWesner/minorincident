# kit.market-doors

One glazed double door with frame (PO 10-15 "L2: FFs open the doors, but there is no visible door"). Placed twice by the L2 layout: Grove Market's front door (east wall, x -51.35, z -42.2, facing +X) and loading door (south wall, z -37.65, x -55.6, facing +Z). Clear opening 2.6 m wide x 2.9 m high, wall plane at the asset's x=0, outside is +X.

Nodes: `marketLeafL` (hinge at Blender y +1.2) and `marketLeafR` (y -1.2) are separate static-batch owners (`splitDoors`). `DistrictView.marketDoors(open)` swings them about the hinge +Y: left +yaw, right -yaw, 100 degrees outward, driven each frame from the L2 mission state (`doorsOpenAt`), so the open state survives the checkpoint and a restore. No collider: the sim's door walls open and close the doorway.

LODs: LOD0/1 two glass lights, mid rail, push bar and stand-offs; LOD2 one tall pane. Palette: picketWhite frame, denimLight glass, uiDark threshold. Metres, +X outside.
