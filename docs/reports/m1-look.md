# M1-14 — Level 1 world look

Status: **partial**. The world is substantially richer and the requested rendering,
ground, wind, dressing and post-processing changes are implemented. The final
six-view comparison still falls short of the mockup's density and cinematic finish,
particularly at the district join and main intersection. This is not a claim that
the “stunning” acceptance criterion is met.

## Changes

Production prop batches, survivor materials, infected and civilian crowds now share
the stylized material model: coloured drop shadows, core shade, terrain bounce,
controlled saturation and distance fog. Animated crowd normals are transformed
into the view space expected by Three's node materials. Emissive windows, eyes,
hit flashes and blood remain supported. `src/data/worldLook.ts` owns the morning
surface, light, grass, ambient and post-FX colours/settings.

Asphalt has procedural aggregate noise, tonal variation, sealed resurfacing patches
and short angular cracks. Sidewalks have tile grout and per-tile variation; lawns
have layered colour noise. L1 roads are 5 m rather than 7 m wide, with raised kerb
lips, gutters, drains, manholes, lane markings, crosswalks and entrance driveways.
Street centre lines and every JSON anchor in D-RES, D-MAIN and D-SHOP are unchanged.
The binary-anchor audit found that D-SHOP's old base export was stale: regeneration
aligns `food-court-door` from local (-14,0,18) to (-14,0,20.8724995), and `mall-door`
from (14,0,18) to (14,0,19.8512497), matching their existing JSON definitions.
All D-RES/D-MAIN GLB anchors and the remaining D-SHOP anchors are unchanged.
These two deltas were sent to the orchestrator for mission integration.

The three base layouts add staggered gardens, planters, daisies, gnomes, toy balls,
hoses, litter, trash bags, bins, benches, porch chairs, hydrants, signs, a shopping
cart and vending machines. Existing accepted assets use `InstancedGroup`; simple
handmade detail is merged by palette. Tiny daisies replace the expensive original
flower prototypes. Fallen leaves use two triangles instead of bevelled boxes.
The districts contain 268 / 333 / 355 flower details and 72 / 80 / 83 colliders.
Handmade planters, gnomes and trash bags have explicit `dressing:*` collider records.

GPU wind animates crossed grass blades and rooted tree/hedge vertices. Grass is
area-scaled, taller and wider at the close camera; low quality retains a sparse
prefix spread across every lawn. Three small GPU meshes supply drifting petals,
leaves, dust and three flapping birds around the camera focus. Whole-district
frustum culling prevents off-screen merged dressing from exhausting mobile budgets.

L1 high quality enables tilt-shift at Bruno's 0.2–0.5 falloff and a soft vignette.
An additional protected ellipse keeps the survivor sharp at close zoom. Low
quality retains the vignette and bloom but omits DOF. Existing bloom thresholds
and mip budgets are retained. No runtime dependencies or textures were added.

## Measured evidence

Fixed follow-camera poses: porch (-14,-7), crescent (0,0), connection (27,0), diner
(42,-6.5), main intersection (56,0), hardware (70,-7). An extra D-SHOP view at
(70,47) was also reviewed. Before and after used actual L1 menu entry, identical
poses, headless native Metal WebGL2, DPR 1 and one Playwright worker. Desktop is
1600×900/high; portrait emulation is 390×844/low. Each measurement uses 149 warmed
RAF intervals with frame limiting/vsync disabled on the Apple M1 Max. These are
emulated mobile results, not physical-phone measurements.

| View | Desktop before FPS | Desktop after FPS | Portrait before FPS | Portrait after FPS |
| --- | ---: | ---: | ---: | ---: |
| Porch | 400.0 | 384.6 | 416.7 | 526.3 |
| Crescent | 400.0 | 384.6 | 434.8 | 476.2 |
| Connection | 400.0 | 333.3 | 434.8 | 500.0 |
| Diner | 416.7 | 344.8 | 476.2 | 434.8 |
| Main intersection | 256.4 | 277.8 | 416.7 | 294.1 |
| Hardware | 294.1 | 333.3 | 357.1 | 370.4 |
| Extra D-SHOP | 322.6 | 303.0 | 370.4 | 416.7 |

Worst submitted counters across these views: desktop 242 draws / 1,121,751
triangles; portrait 225 draws / 455,096 triangles. Collected CDP JS heap peaks at
87.4 MB desktop and 84.7 MB portrait, below the 400/250 MB budgets. Page
`performance.memory` is quantized and was not used as the heap gate. The before/
after comparison retains substantial frame-rate headroom, while some individual
views get slower with the additional detail. Exact counters and p95 intervals are
in [m1-look-metrics.json](m1-look-metrics.json).

## Visual review

All six before/after desktop and portrait views were inspected beside
`initial-drafts/sunset-grove-combat-gameplay-mockup.png`, plus full-size screenshots
of real mouse/touch play and the extra shopping-centre view. Iterations corrected
dark needle-like grass, excessively costly flower models, faint flowers, grass
height, curly pavement cracks and mobile slab submission.

The porch and storefronts now have readable flower colour, grass volume, tiled
paths and small compositions. Roads have surface character and readable edges;
the survivor remains the sharp focal point. The district join and main intersection
still feel too regular and open beside the reference. The result is a nicer,
coherent morning diorama, but I would not honestly call the whole route stunning
yet. A further composition pass and the integrated art/animation/camera review
are needed before closing M1-14.

The extra pharmacy view has a pre-existing problem in both baseline and final:
the legacy `collapse-canopy` hides the survivor's upper body. This was flagged to
the orchestrator for the camera lane; the existing decay contract was preserved.
Character hair, faceted hedge art, combat animation and HUD changes belong to
the other lanes and were not authored here.

## Validation and integration

All requested gates pass:

- `npm run typecheck` and `npm run lint`.
- `npm run test:unit -- --maxWorkers=1`: 53 files / 138 tests.
- `npm run test:smoke`: 3 tagged unit/sim tests / 22 browser tests.
- `npm run verify -- E19`: all five commands exit zero, 17 tagged unit/sim tests
  and 32 browser tests, including desktop, portrait and landscape real-input
  menu-to-completion routes, combat, pickup, death/restart and performance.
- Single-worker M1-14 desktop/portrait captures and protected-area DOF: 3 tests.
- Numeric coloured-shadow, bloom, time-of-day and fog regressions: 4 tests.
- `git diff --check`.

The shared console/request guard reported no unexpected errors. A concurrent unit
rerun hit two timeouts and one timing failure under load; the complete sequential
rerun passed. The final E19 run includes the added gnome and bag collider exports.

No specs, reference assets, other district layouts or later decay-tier GLBs were
changed. `main` was merged once at the start (already current at 960c215).
Seven existing prop definitions gain only `world` token/solid metadata. No asset
dimensions or models changed. The two stale D-SHOP GLB anchor corrections are
listed above; no anchor definitions changed. The vehicle envelope regression
now checks actual placement districts; unplaced future heavy vehicles keep the
unchanged civic arterial as their reference rather than L1's narrowed streets.

During integration, preserve the handmade `dressing:*` collider records alongside
the navigation lane's generated asset colliders. Rebuild the three base layouts
after merging art/physics manifest changes so their updated footprints are used.
CrowdView/CivilianCrowd changes are limited to shared shading and normal conversion;
keep them when resolving animation-lane edits. The shared renderer intentionally
changes the look; E02 image goldens were not automatically rebaselined.

Temporary before/after captures, comparison sheets, generated test screenshots
and failure traces were deleted after final inspection. Existing tracked reference
screenshots were restored. Metrics and this written review are retained.

Integration follow-up (2026-10-06): merged main at `55ba8af` once on the
orchestrator's request. DistrictView keeps ambient focus updates, slab culling,
and main's fading location tags. CivilianCrowd keeps shared palette shading and
main's five model variants and movement-driven animation. Generated compound
asset colliders now coexist with district-authored `dressing:*` solids; the L1
regression checks that those solids reach navigation while mission anchors stay
reachable. Narrowed streets, lighting, ground detail, grass and post FX remain.

Typecheck and lint pass. Unit tests pass with one worker: 54 files / 142 tests,
excluding `tests/unit/static.test.ts`, which launches a production build. A
focused collider/visual unit rerun passes all five tests. The user requested no
heavy work: no Blender, browser, rendering or production build ran during this
merge. Build-containing unit, smoke, E19 verification, integrated desktop/iPhone
visual review and performance measurements remain pending heavy-work clearance.
