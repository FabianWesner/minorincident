# E04 Character vision review

Reviewed 2026-10-05 in the game renderer (Chromium WebGL2, 1600×900, DPR 1).
Reference: the male/female four-view rows of `initial-drafts/survivors-corgi-and-equipment.png`
(read from the main checkout). Evidence: `test-results/epics/E04/character-sheet.png`,
`compare/character-reference.png`, the tier turntables and the gameplay captures.
Female is the top row; male is the bottom row. Columns: front, right, back, left.
Both models actually loaded from the supplied GLBs; no fallback was used.

Checklist B (90-test-concept §7):

- B1 [must] PASS — The female ponytail, shorts and sneakers and the male spiky hair, hood, cargo trousers and high tops are recognizable in all four views; the broad teal backpacks preserve the reference's back silhouette.
- B2 [must] PASS — Male red jacket/cream sleeves, female cream front with red vest side/back panels, red sneakers, teal backpacks and orange hardware match the reference; the torso/backpack color sampling excludes shoes and verifies identity at every gear tier.
- B3 [must] PASS — Reference front-view head-to-total-height fractions are approximately 0.285 male (hair crown y156 to chin y215, shoes y363) and 0.285 female (crown y425 to chin y482, shoes y625); the loaded GLB fractions are 0.26075 and 0.29743 respectively, relative differences −8.51% and +4.36%, both within ±10% (dimensions.json).
- B4 [should] PASS — Both backpack straps, corgi bag badges, buckles, waist belts, wrist details and the male cheek bandage are visible; cumulative code gear adds pouches, pads/holster, vest/cap and heavy armor/mask without removing the bag or red outfit.
- B5 [should] PASS — Eyes and mouth remain distinct on the baseline gameplay captures; ponytail/spiky hair and red/teal blocks identify the survivor at the gameplay camera, with eye highlights and smiles clearly visible on the four-view sheet.

Overall: PASS (3/3 must and 2/2 should).

The supplied hero meshes retain simplified hair/clothing folds relative to the illustration;
this matches the existing asset reports and does not fail the specified silhouette, identity
or proportion checks. Gear assets below integrated use intentionally simple code geometry.
The stronger shadow tint in the game is the established E02 art direction, not an asset edit.
This review concerns E04's Character checklist; it does not grant E17 final art-production sign-off.
