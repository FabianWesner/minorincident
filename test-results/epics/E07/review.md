# E07 combat readability review

Reviewed 2026-10-06 at 1600×900, DPR 1, seed 1, paused tick 0, golden-hour lighting and bloom, pinned Chromium/SwiftShader WebGL2. Opened `horde-readability.png`, `telegraphs.png`, `bloated-windup.png`, `horde-archetypes.png`, `webgpu.png`, `compare/readability.png` and `compare/telegraphs.png` with the image viewer. Comparison sheets use the read-only main checkout's `initial-drafts/sunset-grove-combat-gameplay-mockup.png` on the left, with actual game captures in the remaining columns.

Checklist D from `specs/90-test-concept.md` §7.1:

| Item | Result | One-sentence justification |
| --- | --- | --- |
| D1 [must] Player identifiable within one second | PASS | The lone red-clothed, teal-backed survivor stands clear in the foreground against the brown infected and dark street. |
| D2 [must] Infected separable from background; glowing eyes visible | PASS | Individual head/body silhouettes remain distinct against the road, and paired bright red eyes identify all 60 threats, including the shadowed rows. |
| D3 [must] Telegraphs visible and distinguishable by shape | PASS | The runner's outlined ring and brute's filled directional arrow are clear beside the survivor, while the large open circle in `bloated-windup.png` marks the 3 m death explosion. |
| D4 [should] Pickups/interactables distinguishable from clutter | PASS | The bright gold bat to the player's left and orange grenade in front of the vehicle float over clear road, visually separate from the dark bench, bin and vehicle silhouettes. |
| D5 [should] VFX do not hide player/telegraphs beyond brief moments | PASS | Eye bloom and lamp halos stay localized, while the survivor's red torso/head and the attack ring/arrow remain visible in both wind-up captures. |

Result: PASS, 3/3 must items and 2/2 should items (100%; minimum 70%). Both pickup targets use E06's existing registry-driven presentation; no checklist item is excluded.

`player-mask.png` independently measures 2,534 visible player pixels. `readability.json` records all 60 runner instances, the golden light preset and 3,925 bright red pixels. Image inspection establishes that the paired eyes are visible; the unmasked red-pixel count alone is not treated as an eye detector.

The mixed-archetype capture verifies prototype role cues (shield, bulk, crawler pose, suit colors, animal posture and individual crow birds). Infected entries are below `integrated`, so the registry correctly selects code placeholders. The native Apple/Metal WebGPU image also shows the full instanced crowd with visible eyes, rigid-part poses and telegraphs. This review approves E07 combat readability and the fixture's two pickup affordances, not final asset likeness, district clutter density, HUD or combat VFX art.

## Shared AC closure review — 2026-10-22

This section supersedes the older Checklist D matrix scope. Opened the read-only `initial-drafts/sunset-grove-combat-gameplay-mockup.png`, the fresh 24-frame named `horde-readability` matrix and the full-size WebGL2 high frame. Actual backend/tier/zoom are asserted in the capture runner; no image grade or contrast correction was applied.

| Checklist D item | Result | Observed justification |
| --- | --- | --- |
| Player identifiable within 1 second [must] | PASS | Red sleeves, teal backpack, ponytail and the clear foreground stance locate the courier immediately at zoom 0.5/1/1.5 on both tiers/backends. |
| Infected separation and glowing eyes [must] | PASS | Leading hands/faces separate from the purple road and red eye pairs remain visible through the dense 60-runner crowd. |
| Distinct telegraph shapes [must] | PASS | The directional corridor and broad Brute ground area stay visibly different and unobscured in all twelve configurations. |
| Pickups/interactables distinct from clutter [should] | PASS | Yellow rings mark the bat/grenade while the bin, bench and blue car retain ordinary ground silhouettes. |
| VFX preserve player/warnings [should] | PASS | Window/streetlight halos stay localized and do not erase the foreground courier or warning outlines in the warning frames. |

**PASS: 3/3 must, 2/2 should (100%).** [Matrix and state receipts](../../../docs/reports/ac-close-shared/README.md#named-checklist-d-review--e07-ac13). Source/runtime changes after these captures retain identical drawn crowd attributes and leave the clear-weather golden-hour shading path unchanged; the exact memory-only storm comparison is separately recorded, not substituted for this named review.

Other partial ACs remain subject to the closure report and full verifier. In particular, a nominal 1.5 m stampede corridor does not describe the current 0.82 m capsule-contact boundary; that wording is proposed for user decision, not marked met by this D review.
