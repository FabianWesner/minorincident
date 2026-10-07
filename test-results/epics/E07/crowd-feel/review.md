# Crowd feel image review

Images inspected with the local image viewer: baseline/after L1 stills, common-worker high/LOD1 previews, horde game-camera and close-camera stills, and the 20-body return still. The final 45/135/225/315-degree worker views were also opened and inspected. Scope is this lane’s presentation/permanence repair, not a replacement for the campaign’s complete art review.

## Character/asset checklist (B/C)

- PASS — Identity materials: the horde’s hair is dark again; skin, dark jacket, torn white shirt, red tie/blood and glowing infected eyes retain their separation. The baseline grey, glowing hair covered the head/body silhouette.
- PASS — Recognizable at game-camera distance: after rebuilding/welding the distance tiers and restoring smooth corner normals, the crowded heads read as hair and the bodies as intact characters rather than detached grey facets. Authored torn clothing remains.
- PASS — Layout/proportions: head/torso/limb placement matches the high-detail source preview; delivery dimension checks passed both tiers without a manifest tolerance change.
- PASS — Accessories: tie, cuffs and shoes remain present; the same silhouette is used in the death pose.
- PASS — Faces: glowing eyes and mouth remain visible at the delivered horde angle.
- PASS — Budgets: 5,236/4,174 delivered triangles remain below the existing 6,000/5,000 caps. The production validator reports zero errors. Rounded surfaces no longer have the harsh per-triangle normals seen in the earlier failed repair capture.
- PASS — Brands/age: no brand marks were added; the worker remains an adult infected figure.
- PASS — Four-view silhouettes: 45/135/225/315-degree stills retain the head, jacket, shirt, tie and shoe silhouette without grey shards. The back jacket is closed and readable; authored clothing tears remain.

## L1 combat readability (D) and permanence

- PASS — The player remains identifiable by courier cap/backpack and distinct outline in the L1 follow-camera stills.
- PASS — Infected separate from the warm street/sidewalk; fleeing civilians are visibly distinct before transformation.
- PASS — Telegraph shape remains visible in the L1 stills and source horde test scene.
- PASS — Persistent small clutter: the dropped coffee accessory remains on the pavement in the L1 scene; separate sim guards cover persistence rather than inferring it from a single frame.
- PASS — Corpse return still: the dead figures retain the baked authored death pose and identity on return. The sim and renderer guard reports 20 retained IDs and 20 submitted bodies; camera clipping/overlap means the image alone is not the authoritative count.
- PASS — Temporal submission continuity: 60-second after capture contains 0 brief gaps, 0 sustained gaps, 0 duplicate submissions and 0 unexplained recently-seen departures. This is submission telemetry and does not certify pixel visibility through occluders.

The baseline did not reproduce a brief missing submission, so no reduction from a nonzero flicker baseline is claimed. World-space foot-joint/paw stance metrics and the opposing-rotation determinant guard provide the separate animation evidence; stills cannot establish foot sliding or a whole-minute temporal count.

## Remaining visual coverage

Headless WebGL2/Metal was used. Native WebGPU and full E18 device/frame budgets are owned by the platform/performance lanes. All four worker inspection views passed this review.
