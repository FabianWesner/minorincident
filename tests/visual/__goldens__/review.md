# E02 vision review — 2026-10-05

Reviewed at 1600×900, pinned Playwright 1.63.0 Chromium, SwiftShader, `renderer=webgl&dpr=1`, seed 1, paused tick 60, golden-hour preset. Reference: `initial-drafts/sunset-grove-combat-gameplay-mockup.png` from the read-only main checkout. The reference and the rendered overview/street/shadow-probe were opened with the image viewer; a side-by-side reference/render sheet is generated in `test-results/epics/E02/compare/`.

North-star checklist A (90 §7.1):

| Item | Priority | Result | Visual evidence |
| --- | --- | --- | --- |
| A1 Warm saturated palette | must | PASS | Golden light warms yellow walls, brick roofs and cream trim, alongside red player clothing, a teal backpack and saturated green foliage. |
| A2 Soft purple-blue shadows | must | PASS | Long house/fence/tree shadows have purple interiors and filtered edges; the sidewalk probe also passes the 230–290° hue and >15% lightness checks. |
| A3 Emissives glow with bloom | must | PASS | Lamp heads and windows have visible warm halos, and infected eyes emit red accents; paired bloom screenshots measure the gain outside the lamp surface. |
| A4 High 3/4 narrow-FOV camera | must | PASS | Two visible building faces and the diagonal street give the high-angle diorama framing with little size change between near/far props. |
| A5 Chunky proportions and bevels | should | PASS | Rounded box edges, thick pickets, oversized heads/hands/shoes and blocky cars read as toy placeholders. |
| A6 Rounded foliage and flower accents | should | PASS | Clustered round tree crowns and continuous rounded hedges frame the street; the flower bed adds red accents beside the picket fence. |
| A7 Readable player about 1/12 height | should | PASS | The central red/teal survivor is immediately identifiable among five brown-clothed infected and has no UI overlap; projected height passes the specified range. |
| A8 Comparable clutter density | should | FAIL | The test street has fences, lamps, bins, a bench, a car and flowers, but lacks the reference's shop signage and loose combat clutter. |

Overall PASS: 4/4 must items and 3/4 should items (75%, requirement ≥70%). A8 remains a documented placeholder-content limitation for district/asset epics, not a failed must item. No combat VFX, campaign content or HUD is judged as part of this E02 street fixture.

Additional review: L1 is visibly brightest and warm-neutral; L4 is golden; L6 is cool and darkest while glowing windows/eyes remain visible. Bloom-on/off show halos only when enabled. The inside-house screenshot hides the roof and preserves the survivor silhouette. ID reference and occluded player masks show no lost silhouette pixels. The three photo spots are intentional first goldens; future updates require a new visual review.

Final audit: the overview was intentionally pulled back to place the complete survivor silhouette near 1/12 of the viewport. The final golden was re-opened after adding explicit shader fog and hemisphere fill; the checklist results above remain unchanged. The far-fog probe resolves to the exact L4 fog color (229, 179, 158). Optional tilt-shift is tested separately to preserve all pixels in the central 60% of the image.

## E09 vehicle goldens — 2026-10-06

`vehicle-brake-siren-right.png`, `vehicle-driving-wheels.png` and `vehicle-brake-siren-left.png` were opened and reviewed with their reference/render comparison. The full AC10 and applicable checklist-C PASS review and pixel measurements are recorded in `test-results/epics/E09/review.md` and `visual-metrics.json`. These are intentional first goldens for below-integrated code placeholders, not an art-status promotion.
