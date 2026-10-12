Z-S3 implements zebra rear kick/herd stampede and flamingo flock dive (E07-AC01/05/19 subset).
Reuses the shared scheduler, Alpha physical resolvers, flock response, stagger, pooled cues and health bars; preserves checkpoint cooldowns and protected humans.
Typecheck/lint/build pass; full unit 850/850, move tests 15/15 and browser tests 5/5; E07 verify passes (285 functional, 5 timing, 74 browser / 0 failures).
Reviewed game and 390×844/844×390 captures: readable cues/veil/HUD, matching facing and velocity, no missed draws/clipping; shared elephant slide p95 13.3→0.2 cm.
E18 high/low: Node sim p95 0.94/0.30 ms; Metal frame p95 6.3/4.3 ms; 57 draws, 6 crowd draws, 657,557/214,353 triangles; CDP heap 135/126 MB.
Evidence: [visual review and retained before/after set](visual-review.md), [validation](validation.json); work is on lane/zoo-zebra-flamingo.
