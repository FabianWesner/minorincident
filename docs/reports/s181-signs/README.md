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

The gas-station asset already has a physical Sunset Fuel facade sign. A close L9 inspection showed a new board at the shop fascia would be hidden by the existing raised branding, so the duplicate generated board is omitted for that asset. The L9 highway-stop label remains in layout data. Other fallback placements remain unresolved.

The supermarket board now uses its local +X entrance header, rotated with the placement. A close HIGH L9 view shows the Roadside Shop sign above the middle doorway; LOD0–2 ray samples at the board area hit the header at x=4.24 m, with the board at x=4.25 m. Game-camera readability and full clearance remain to be checked.

Zoo ticket and staff/lodge boards now follow the local +X gate lintel and porch fascia. Close HIGH captures show both on their supports; the first staff placement was hidden by the roof and was moved to its front edge. The long staff text is compressed to fit the shallow fascia, so game-camera readability and full clearance remain open.

L3 police uses its existing entrance sign as support; a close HIGH capture with the courier nearby shows the board on the canopy. A capture with the courier far away showed the sign while the building was not rendered: sign visibility must follow building streaming/LOD before this can pass the no-floating requirement.

Sign quads now follow the supporting placement’s drawn, non-placeholder LOD and are omitted when that placement is a see-through occluder. The L3 diagnostic repro no longer shows a board while the building is cut away; nearby L3, L8 and L10 views retain their signs. This uses a dynamic index buffer within the existing district mesh. Wider transition and backend coverage remains open.

The L1 fire-station asset has a prominent physical Sunset Grove Fire Dept sign at its entrance, confirmed in a close HIGH view. Its LOD2 removes the lettering, so it cannot by itself satisfy low-tier readability. An overlay trial was suppressed by the current cutaway visibility logic in that view; its supporting placement and transition behavior still need correction.

The fire-station mismatch was a baked marker ID mismatch (`853` in layout versus `inst:...:854` in the marker), not a cutaway. Sign visibility now matches the selected supporting asset and local placement position within its district. The L1 HIGH close view shows Fire Station 3 on the entrance board; the L3 cutaway repro still suppresses its floating sign. LOW and transition coverage remain open.

A LOW close view confirms Fire Station 3 lettering on its entrance support. The LOW follow-camera near → away → return probe (`tools/qa/s181-signs-transition.ts`) reported visibility 1 → 0 → 1; this does not cover every camera or LOD transition.

Maple Hardware already has large physical facade lettering; its authored LOW recipe retains that lettering. A trial overlay conflicted with the existing sign, so the duplicate generated board is omitted for this asset. The earlier fallback distance in the audit no longer applies to that sign.

The legacy Grove Police asset is a scaled version of the L3 station; its board now follows the scaled entrance canopy. LOD0 and LOD2 centre-grid rays hit the supporting surface at local x 3.469–3.475 m, with the board at 3.492 m. A close capture was obscured by foliage, so visual readability remains unverified.

Pharmacy and gym boards now use the local +X entrance headers with placement scale and rotation. LOD0 and LOD2 mesh samples at the chosen board areas hit x=3.165 m (pharmacy) and x=8.04 m (gym); boards are 0.005 m and 0.01 m ahead respectively. Close diagnostic views were blocked by foreground geometry, so appearance and game-camera readability remain unverified.
