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
