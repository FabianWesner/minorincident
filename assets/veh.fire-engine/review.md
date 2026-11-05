# Fire-engine vision review

Reference: main-checkout `assets/fire-engine/reference-upscaled.png`.
Comparison: `test-results/epics/E17/comparison.png`.
Reviewer: Codex, 2026-10-05, five actual game-renderer views at 1600×900, with CPU-baked AO.

Checklist C:

- [must] Recognizable at gameplay distance: PASS — the red ladder truck, cab, equipment compartments and two axles read clearly in the gameplay view.
- [must] Main part layout matches: PASS — the rear pump bay, broad central shutters, front crew cab, two-axle spacing and roof ladder follow the reference arrangement.
- [must] Material separation correct: PASS — red paint, light trim, gray shutters, dark glazing and dark tires remain visually distinct in all five views.
- [should] Hidden sides plausibly inferred: PASS — the far side repeats the compartment rhythm and the rear has a consistent access ladder and lights.
- [should] Budget without visible gameplay faceting: PASS — LOD0 is below 80k triangles and curved tires remain readable at gameplay distance; smaller bevels are visible only on close inspection.
- [must] Fictional brands / adult infected: PASS — lettering is generic FIRE / FIRE DEPT.; there are no brands, trademarks or characters in this asset.

Verdict: PASS

Measured occupied pixels (toolbar hidden): 11.11%, 51.42%, 11.25%, 51.26%, 16.06%.
The palette version uses stylized matte trim rather than the reference's
photographic chrome. Rear and far-side details are inferred from the single
reference. No failed must or should item.
