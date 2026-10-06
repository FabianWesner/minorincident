# E09 vehicle vision review — 2026-10-06

Reviewed the actual 1600×900 Chromium/SwiftShader DPR-1 captures at the fixed `vehicle` photo spot, paused ticks 36 and 66. Seed 1. The police reference from the read-only main checkout and all three render captures were opened with the image viewer; `compare/police.png` is the reference/render comparison sheet. The integrated fire engine capture was also opened and checked against its existing procedural asset contract (`assets/veh.fire-engine/notes.md` and node validation); that asset has no reference PNG.

## AC10 functional checklist

| Item | Result | Evidence |
| --- | --- | --- |
| Wheels rotate with speed | PASS | Visible cream wheel-spoke bars change angle; front wheel rotation changes by 3.40755 radians over 30 ticks. |
| Only front wheels steer | PASS | Front pivots change to -0.17780 radians while rear pivots stay at zero; the chassis follows the turn. |
| Brake lamps brighten when braking | PASS | The rear lamp is bright red at rest and dark during acceleration: the projected lamp mask has 672 red pixels on and zero off. |
| Emergency sirens alternate | PASS | The stationary pair swaps the bright blue/red roof lamps; each 25×25 projected siren mask changes 625 pixels. |
| Driver hides and effects remain readable | PASS | The seated survivor and weapon arc are absent, leaving both wheels and lamps unobscured. |
| Integrated asset renders its native parts | PASS | `fire-engine.png` shows separate rubber tires, metal hubs/trim, red paint, glass, brake/siren lamps, ladder and the ground-level door ring. |

Overall AC10 PASS. `visual-metrics.json` records the measurements. Three first vehicle goldens are approved at threshold 0.1 and maximum differing pixel ratio 1.5%; subsequent runs compare without updating.

## Applicable asset checklist C (90 §7.1)

Six vehicle assets remain below `integrated`, so the explicit epic instruction requires code placeholders. This review judges those placeholders' layout, material separation and animation, and does not promote their art status or claim production fidelity to the photographic reference.

| Item | Priority | Result | Justification |
| --- | --- | --- | --- |
| Recognizable at gameplay distance | must | PASS | Two axles, chassis, glass cabin and red/blue roof lamps clearly identify the emergency sedan. |
| Main part layout | must | PASS | The wheels sit at four chassis corners on two axles, the cabin sits above the body and sirens sit on the roof, matching the reference's major layout. |
| Material separation | must | PASS | Warm white paint, dark teal glass, dark rubber wheels and contrasting lamp surfaces remain distinct. |
| Hidden sides consistent | should | PASS | The symmetric wheels/cabin and rear lamp use the same chunky placeholder proportions on both sides. |
| Triangle budget and gameplay faceting | should | PASS | The complete two-car/cone fixture uses 651 rendered triangles; the simple wheel facets do not obscure the spokes or vehicle silhouette at normal gameplay distance. |
| No real-world brands | must | PASS | The placeholder has no lettering/logos, and the fire engine uses generic FIRE / FIRE DEPT. signage. |

Overall applicable checklist C PASS: 4/4 must and 2/2 should items. Warm paint and purple-blue ground shadows preserve the existing diorama palette. The isolated photo spot intentionally excludes a district, foliage, combat, HUD and final vehicle art; their unrelated checklists are outside this epic's AC10 review. Smoke/fire are intentionally minimal code effects pending the VFX epic, with their timing and gameplay consequences tested in simulation.
