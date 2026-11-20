# S181 facade signs

The capture names reserved for the requested review set are:

- `L10-research-laboratory-high-z1.jpg`
- `L10-research-laboratory-high-z1.5.jpg`
- `L10-research-laboratory-low-z1.jpg`
- `L10-research-laboratory-low-z1.5.jpg`
- `L8-primate-house-high-z1.jpg`
- `L8-primate-house-high-z1.5.jpg`

Captures are pending. A first HIGH laboratory capture was inspected: the board crosses a side window, so placement fails review. A second capture shows the board at the +X entrance canopy, but its mounting needs review. The L8 capture showed a board across a side window; the code now targets the existing entrance board and needs a fresh capture.

The runtime mesh uses one texture atlas and one mesh per district. Other candidate signs are positioned just beyond the authored building AABB north (+Z) facade; the scene gate and visual placement review still need to confirm facade fit and clearance.

The L8 entrance board was inspected at a close cinematic pose after moving it in front of the raised emblems: its text is readable. This does not verify game-camera zoom. The remote unit suite timed out twice unchanged at 241.4 s and 241.1 s (240 s budget), with no reported test failure before termination. Typecheck and lint pass.

Follow-camera captures at HIGH and LOW were inspected on 2026-11-20: the laboratory lettering is readable at both zooms, though the board overlaps the canopy edge and its mounting requires review. The enlarged Primate House lettering is readable at both zooms above the door. These individual JPGs are local ignored artifacts; the retained contact sheet is `capture-sheet.jpg`. Other placements and geometry gates remain unverified.

The nightly placement-vs-solids check examines authored prop placements in L1–L9, and the decoration-surface check examines ground cover; neither sees these runtime sign meshes. Passing them alone cannot establish sign clearance or mounting. Generic residential house labels and the private cellar are now omitted; the named zoo houses remain eligible. Other candidate boards still require facade-specific placement and inspection.

A HIGH L8 follow-camera trial with `MeshLambertNodeMaterial` produced very dark, unreadable lettering at zoom 1.5. The readable basic material remains in place; achieving a lit, emissive-free board with adequate night contrast remains open.

The sign now uses the project shaded material with a brighter painted albedo and no emissive input. Fresh game-camera captures show readable lettering at L8 HIGH and L10 HIGH/LOW at both zooms; the L8 night board is dimmer than the prior basic material. Placement and mounting review remains open.

The LOD0 ray audit in `surface-audit.json` shows that the AABB fallback is not a mounting proof: Joe’s Diner is 3.697 m from the first hit, Grove Market 7.807 m (an interior fixture), and Sunset Fuel and Motor Pool have no hit within 20 m. The ray samples only the board centre and may hit trim or windows; it cannot prove a valid mounting even for short distances. Replace the fallback with reviewed entrance placements and check their full extent and clearance.

Diner boards now follow the asset’s local +X front header (x 2.725, height 2.69–3.11 m), including placement yaw and scale. The D-MAIN camera inspection was obscured by foliage, so rendered visibility and the rotated L9 placement remain unverified. The old `surface-audit.json` records the previous fallback, not this diner placement.

A close HIGH L9 view of the rotated diner showed the first header position was hidden inside the model. LOD0 ray samples found the header at local x=2.775; the board was moved to x=2.785, narrowed over the door, and visually checked there. This is a close diagnostic view, not proof of game-camera readability or clearance at all LODs.

Workshop signs now use the local +X gable and rotate with each placement. A close HIGH view of the rotated L9 roadside workshop shows the board above the garage opening; LOD0–2 sampled gable surfaces near the sign were at x=1.494–1.517 m, with the board at x=1.53 m. Full extent, in-game readability and remaining candidates need review.

Security, Motor Pool, and Depot Warehouse boards now sit on the +X entrance fascia, following placement rotation. Close HIGH views in `l10-fascia-sheet.jpg` show each board on its fascia; sampled LOD0 and LOD2 front surfaces support the positions. Full clearance and game-camera readability are still open.
