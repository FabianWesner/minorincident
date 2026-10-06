# E14 HUD vision review

Reviewed with the image-reading tool against the gameplay mockup from
`initial-drafts/sunset-grove-combat-gameplay-mockup.png` in the main checkout.
`compare/hud.png` places that reference beside the `hud-golden` render with the
100 px comparison grid. The render uses Chromium, SwiftShader, DPR 1, seed 1,
a paused mission sandbox and the fixed `hud-golden` camera.

| Checklist F item | Verdict | Evidence and justification |
| --- | --- | --- |
| [must] Portrait + health top left; minimap top right; slots bottom center | PASS | `hud-golden.png` has the portrait and red health/blue armor bars in the upper left, a circular N-up map in the upper right, and the two side cards centered at the bottom. |
| [must] Selected side clearly indicated | PASS | `selected-left.png` and `selected-right.png` show the gold border and lighter panel switching to the side used by the physical J/K input. |
| [must] Text legible at 1600×900 and 390×844 | PASS | `hud-golden.png` and `hud-mobile.png` have readable health, objective, ammo/charge, side and subtitle text with no clipped labels. |
| [should] Rounded dark panels, chunky bars, key badges match mockup | PASS | Rounded dark panels with warm borders, thick red/blue bars and compact key/action labels carry the mockup’s HUD treatment into the specified two-side layout. |

Overall: PASS — 3/3 must items and 1/1 should item (100%).

`touch-390.png` and `touch-844.png` were also opened and reviewed: the stick
zone, selector, pause and two icon action buttons stay inside the viewport and
clear of the objective tracker and map in both orientations. Subtitles sit above
the cards. Bounding-box and target-size checks provide automated corroboration.

Portraits are code placeholders because the HUD portrait assets remain below
`integrated`; this is required by the asset-status policy. The mockup’s four
cards are deliberately adapted to the epic’s two-side model. The surrounding
sandbox world is existing renderer content and is outside this HUD checklist.
No golden thresholds or specification criteria were changed.
