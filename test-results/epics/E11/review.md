# E11 interaction UI vision review

Reviewed the final verify output from source `cb91d59`: the actual `interact-ui` W0/W5 PNGs at 1600×900 and 390×844, plus the W0/W5 comparison sheet. Reference: `initial-drafts/sunset-grove-combat-gameplay-mockup.png` in the main checkout. Reference/render sheets are in `compare/reference-W0.png` and `compare/reference-W5.png`; `compare/tier-readability.png` compares the identical district photo spot across tiers.

This applies §7 checklist D to interaction readability, E to the tier comparison, and F to the new interaction prompt. The fixture has no infected or attack telegraphs, and E11 does not implement the full HUD, character art, lighting, or explosion effects; those checklist items are outside this review rather than claimed as passes. E27 owns blast/fire/smoke visuals. The generator uses a code placeholder because its asset is below integrated status.

| Checklist item | Result | Observed evidence |
| --- | --- | --- |
| D [must] Player identifiable within one second | PASS | The red survivor and teal backpack remain visible beside the ring in both tiers and both viewport sizes; the raised prompt leaves the head clear. |
| D [should] Interactables distinct from clutter | PASS | The bright white rim, teal progress arc, dark outline, device label, and progress bar clearly isolate the generator from the road, wrecks, and fence debris. |
| D [should] Interaction visuals do not hide the player | PASS | The ground ring surrounds the device and the prompt floats above the survivor; neither covers the head or torso. |
| E [must] Obviously the same place | PASS | The crossroads, zebra crossings, curb corners, lamps, and fence lines keep the same positions at W0 and W5. |
| E [must] Higher tier obviously worse | PASS | W5 has broken fences, scattered vehicle wrecks and much darker lighting, while W0 has intact street furnishings and bright grass. |
| E [should] Varied decay | PASS | Broken fences, multiple differently oriented wrecks, loose panels, dark lamps and debris provide distinct changes. |
| E [should] Lighting mood matches tier | PASS | W0 reads as daytime; W5 reads as a cool, dark ruined street, with the interaction arc and prompt retaining the same brightness. |
| F [must] Text legible at both target sizes | PASS | The 16px label and control hint are readable at native resolution, remain inside the viewport, and retain measured 15.617:1 text contrast against the opaque panel at all six tiers. |
| F [should] Style matches mockup | PASS | The rounded dark panel, thick teal bar and explicit E / middle-click hint match the checklist's rounded dark panels, chunky bars and key hints; the reference's detailed HUD artwork remains outside E11's prompt scope. |

All applicable must items and all five applicable should items pass. The initial review found the prompt overlapping the survivor's head; its anchor was raised and the browser test now asserts that the projected head stays outside the prompt. Screenshots in this directory show the corrected result.

Automated supporting evidence: `tests/visual/interact.spec.ts` (`@E11-AC09`) renders all six tiers at both sizes, checks contrast, font size, viewport bounds, head clearance, ring-colored pixels outside the DOM prompt, and the expected 37.5% interaction state. Actual measurements are saved in `ui-desktop-metrics.json` and `ui-mobile-metrics.json`.
