# AC13: night body highlights

The existing infected-body luminance ceiling was multiplied by `subwayDarkness`, so it was inactive in every other night preset. Pale outfits, rim light and fog could therefore outshine the bounded red eye emitter.

`Lighting.nightThreat` now enables the same hue-preserving limit in the actual night presets. The subway retains its 0.05 ceiling; other night presets use 0.10. The limit runs after ordinary surface, rim, pool and fog shading and excludes emissive eye vertices. L1/L2/L4/L5 have a zero weight. Hurt feedback remains active.

Fresh same-pose WebGL2 high measurements reproduce the original three visible-eye counterexamples at body maxima 0.311–0.421 versus eyes 0.199–0.213. After the repair, those specimens' brightest pixels are their eyes (0.176–0.213). The lossless before/after captures were opened and compared: `test-results/epics/E25/final/eyes-before-after.png`. Body identity colours remain visible; the pale uniform highlights are dimmer.

The expanded source-bound mask audit in `tools/qa/e25-night-readability.ts` covers the retained human/animal archetypes and seven ordinary runner looks. It checks actual geometry and opaque depth, excludes the unchanged health-bar overlay by a black-mask differential, and does not infer eye visibility from red clothes. The generic lab's L1 outbreak dresser is disabled only for the requested native runner fixtures, so it cannot silently substitute one civilian for every requested look. The first complete high run has zero browser errors, with every visible-eye specimen passing. The nurse still has no visible eye fragments and receives a separate content repair; this shader commit alone does not claim full AC13 closure.

TypeScript compilation passed on the source state containing this repair. The final lane report records remaining tier, accepted-view and full-gate validation.
