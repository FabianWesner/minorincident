# E06 visual review — 2026-10-05

Reference: `initial-drafts/sunset-grove-combat-gameplay-mockup.png` in the main checkout.
Reviewed deterministic seed 1, `combat-arena`, photo spot `aim`, Chromium SwiftShader,
1600×900 DPR 1. Captures: `aim-{melee,ranged,throwable}-{left,right}.png`.
Comparison sheets: `compare/aim-{melee,ranged,throwable}.png`.

Scope: checklist D, combat telegraph readability, for E06-AC09. This empty isolated
arena verifies catalog presentation; district density, final character art, HUD,
gore and explosion art are owned by their other epics. Art below integrated status
uses code placeholders under E17's manifest gates. Those gates were preserved.

| Item | Result | Evidence / justification |
|---|---|---|
| D1 [must] player identifiable within 1 second | PASS | Red torso, teal backpack and red shoes distinguish the survivor from the blue infected and tan ground in all six frames. |
| D2 [must] infected separable, glowing eyes visible | PASS | The blue infected silhouette contrasts strongly with the ground and its red eye pair remains visible. |
| D3 [must] telegraphs visible and distinguishable by shape | PASS | Melee has two edges and a curved cone rim; ranged has a straight ground line; throwables have a raised ballistic ribbon and a complete landing circle. The line/cone stay at 0.04m while the arc rises above 0.8m. |
| D4 [should] pickups distinguishable from clutter | PASS | The yellow hovering weapon pickup is isolated above the ground and separate from both character silhouettes; there is no ambiguous ground clutter in this fixture. |
| D5 [should] VFX do not hide player or telegraphs | PASS | Thin ribbons and open circle/cone outlines leave the survivor and infected readable, with no opaque effect covering them. |

Selected-side check: LEFT renders warm yellow; RIGHT renders cyan. Each screenshot
shows only its selected telegraph; the inactive side retains its held model without
an aim indicator. The landing circles fit fully within both throwable captures.

All three must items and both should items pass. Overall: PASS.
Six goldens in `tests/visual/__goldens__/aim-*.png` were created only after inspecting
these renders and the reference. Pixel regression uses threshold 0.1 and a maximum
1.5% differing pixels; subsequent verification does not update snapshots.

Native WebGPU follow-up: `webgpu.png` was opened and inspected after the single
headed run. The survivor, raised yellow arc and complete landing circle remain
visible with no opaque coverage. `webgpu.json` confirms the native backend, all
three indicator shapes and both correct hand attachments. This backend sanity
capture supplements the six deterministic goldens above.
