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
