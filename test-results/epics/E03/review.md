# E03 functional controls review

Reviewed 2026-10-05 against `specs/00-game-concept.md` §5.3 and E03's functional DOM scope, following `specs/90-test-concept.md` §7.1's PASS/FAIL-with-evidence protocol.

E03 has no visual/vision acceptance criteria. These screenshots supplement the device tests; they do not claim to complete E14's HUD art or E02's rendering. No art goldens were changed.

Screenshots opened for review: `desktop.png` (1600×900), `stick-pixel-7.png` and `aim-pixel-7.png` (390×844), `stick-iphone-14-landscape.png` and `aim-iphone-14-landscape.png` (844×390). Equivalent captures for desktop touch emulation and the other mobile projects are saved alongside them.

| Functional checklist | Result | Evidence / justification |
| --- | --- | --- |
| [must] Scheme hint is legible at desktop and mobile sizes | PASS | White text on a dark backing is fully visible in all reviewed images; the desktop hint describes WASD + cursor and the mobile hint describes stick/drag/tap. |
| [must] Left and right action controls are distinguishable | PASS | The separate `LEFT` and `RIGHT` labels fit their outlined 64 px buttons at both orientations. |
| [must] Selector and pause controls are legible and accessible | PASS | `NEXT` and `PAUSE` fit without clipping in a separate row above the action buttons. |
| [must] The floating stick appears in the left movement region | PASS | Both stick screenshots show a complete circle at the contact origin, separate from the bottom-right buttons. |
| [should] Controls leave the central fixture readable | PASS | The orange player fixture remains visible and separated from the touch controls in portrait and landscape. |
| [should] Layout keeps distinct movement and action regions | PASS | Movement is on the left; action buttons occupy a compact bottom-right block with visible spacing. |

All four applicable must items and both should items pass. The initial long `SELECTOR` label clipped; it was replaced with `NEXT`, rebuilt, re-captured, and reviewed again. The landscape screenshot contact was moved inside the viewport; the test now exercises a valid on-screen origin.

Of the standard §7 checklist F items, text legibility is applicable and passes. Portrait/health, minimap, slot cards, selected-rack visuals and final mockup styling belong to E14 and are not evaluated here. Drag direction and release timing are proven by E03-AC07 frame assertions rather than inferred from a still image of the E01 cube.
