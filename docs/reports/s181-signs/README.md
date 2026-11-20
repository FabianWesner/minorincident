# S181 facade signs

The requested review captures are available locally under these names (the tracked contact sheet is `capture-sheet.jpg`):

- `L10-research-laboratory-high-z1.jpg`
- `L10-research-laboratory-high-z1.5.jpg`
- `L10-research-laboratory-low-z1.jpg`
- `L10-research-laboratory-low-z1.5.jpg`
- `L8-primate-house-high-z1.jpg`
- `L8-primate-house-high-z1.5.jpg`

Earlier placement trials crossed side windows; the later follow-camera captures below show the revised entrance placements. The laboratory board still extends beyond the thin canopy fascia, and its mounting remains open for review.

The runtime mesh uses one texture atlas and one mesh per district. Facade-specific placements have replaced the initial AABB fallback for the observed named building types; comprehensive scene clearance and visual review remain open.

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

The elementary-school asset already has a physical Sunset Grove Elementary inscription on its entrance pediment. Its native LOW recipe does not omit the lettering, so the extra AABB-positioned board is omitted. The hospital LOW recipe does omit its name lettering; its fallback remains unresolved.

The power-substation asset already carries a physical Sunset Grove Power sign, so its duplicate fallback board is omitted; LOW readability remains unverified. The hospital overlay is limited to the LOD2 model, whose name panel has no lettering. Nine LOD2 samples across the intended panel hit x=3.825 m; the board is at x=3.835 m before placement scaling. The diagnostic camera was obstructed and did not establish rendered appearance or transition correctness.

The LOW hospital follow-camera transition probe selected LOD1 → LOD2 → culled → LOD1 and reported overlay visibility 0 → 1 → 0 → 0, matching the intended name-panel replacement. This is a state probe; the obstructed visual view still does not establish readability.

The Maple Mini Mall board now sits between the second-floor windows. A close HIGH capture shows its frame clear of the nearby raised trim, with foliage obscuring part of the surrounding facade. Sparse LOD0 and LOD2 ray samples found wall behind the chosen area; full clearance and game-camera readability remain unverified.

A further LOD0 laboratory mesh probe sampled five points across the board at each of several heights: the canopy front was at local x=16.20 m at y=3.85 m, while the board is at x=16.23 m. At y=3.70 m and y=4.00 m the first hit was the set-back wall at x=13.70 m. The board therefore spans the narrow canopy edge rather than being fully backed by a facade; the visual captures show the overhang. This probe does not verify other LODs or collision clearance.

The laboratory board was moved to local x=16.205 m, 5 mm ahead of the sampled canopy front at x=16.20 m in LOD0, LOD1 and LOD2. Fresh HIGH/LOW follow-camera views at both zooms remain readable; the board still overhangs the narrow edge and complete clearance is not established. The contact sheet was refreshed.

The existing nightly `placement vs solids` and `decoration surfaces and road ground cover` invariants both passed on 2026-11-20 (`npx vitest run --project nightly tests/nightly/content-invariants.test.ts -t 'decoration surfaces and road ground cover|placement vs solids' --maxWorkers=1`). As noted above, they inspect authored world content, not these generated sign meshes, so this is not a sign-clearance pass.

The mesh audit in `mesh-audit.json` samples 35 points on each board against its supporting asset in each authored LOD. The sampled L1, L2, L3, L8, L9, L10 and standalone CIVIC, MAIN, PARK, SCHOOL and SHOP boards had no front protrusion greater than 1 cm while displayed; the hospital overlay intersects LOD0/1 lettering but is suppressed at those LODs. The Primate House board initially sat 10–33 cm from its panel to clear the raised letters. Two dark brackets now bridge this gap at sampled clear points, within the same batch; refreshed HIGH views at both zooms remain readable. This audit does not sample the brackets or other nearby objects, and is not a substitute for complete clearance or visual review.

For each Primate House bracket, a separate 3-by-3 sample across its wall end hit the entrance panel at local x=4.75 m in LOD0, LOD1 and LOD2; the bracket starts at x=4.755 m. This establishes the sampled attachment surface, not clearance from unrelated nearby objects.

Additional LOW L8 follow-camera captures at zoom 1 and 1.5 were inspected: the Primate House lettering remains readable and its brackets are visible. A broad-phase check of the sign rectangle against other placement `visualAabb`s flagged tree bounds near Grove Police, Joe’s Diner (D-MAIN), Creekside Lodge, Sunset Grove Gym, Grove Market, Grove Pharmacy, Food Court and Maple Mini Mall. Bounding-box overlap alone does not establish mesh intersection; these candidates still need narrow-phase or visual clearance review.

The eight tree candidates were tested against static authored LOD0 triangles. The gym and mall initially had three and four triangle intersections respectively; moving the gym board down and the mall board up cleared those sampled intersections. The other six had none. `neighbor-audit.json` records the final static check; wind deformation, other tree LODs and bracket geometry are not covered. All 35 surface samples for both adjusted boards hit their supporting facade within 8 cm in all three building LODs. A close HIGH mall view shows readable text between windows; the gym diagnostic view remains obscured by the tree.

The full remote unit suite passed on a later retry: 27 files, 105 tests passed, one skipped, 223.0 s against the 240 s budget. This run overlapped subsequent sign-placement edits, so it is not a final-source validation.

A LOW L8 follow-camera near → away → return probe reported zoo visibility `010 → 000 → 010` and index counts `54 → 0 → 54`: the Primate House face and its brackets disappear and return together with their building.

A HIGH gym follow-camera probe did not establish readability: close to the entrance, the existing cutaway hides the building and its sign; a farther tested pose put the sign outside the frame. A useful unobstructed gameplay approach still needs review.

After the gym and mall adjustment was committed, the unchanged remote unit suite passed again: 27 files, 105 passed, one skipped, 235.0 s. Additional trial positions at either end of the gym facade did not produce a readable follow-camera view and were reverted. The gym readability limitation remains open.

The earlier gym and hospital audit entries used layout scales and were invalid: their baked render instances use scale 1, while layout records specify 0.571 and 0.350 respectively. Sign placement and the audit now use the matching rendered instance transform. The gym sign moved to the camera-facing +Z entrance header; all 35 samples are supported in each LOD and no other placement bounds overlap the board. HIGH follow-camera views at zoom 1 and 1.5 are readable (`gym-sheet.jpg`). The hospital LOD2 panel samples are supported, and its LOW LOD transition remains 0 → 1 → 0 → 0; its final rendered view is still unverified. The earlier unit-suite pass predates this correction.

The first remote unit run after the rendered-transform correction reached the 240-second suite budget (241.2 s, exit 124). It reported a save-progression test failure after 36.3 s before the suite was terminated, without printing its detailed failure; the unchanged suite had passed before the correction. An unchanged retry is required.

The unchanged retry after the transform correction also timed out at 241.1 s; the previously reported save-progression test passed on that attempt, and no failure was reported among completed files. A further unchanged retry was started.

At the three-hour time box, the further unchanged retry was cancelled while still queued: both remote slots were occupied and local fallback lacked available memory. No test was running when it was cancelled. The corrected-source suite therefore has no complete pass; its two attempts timed out as described above. Remaining review: the hospital LOW overlay's rendered appearance and gameplay readability, and comprehensive sign clearance beyond the sampled supporting meshes and static neighboring-tree checks.

A LOW inspection-camera view selected the actual LOD2 model and showed the Grove Hospital board on its name panel, with readable lettering (`hospital-sheet.jpg`). This establishes its rendered appearance at that inspection pose; sampled follow-camera poses still did not put the overlay in frame.
