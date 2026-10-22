# Fixes 13h — L10 #98 / #100

- #98: freeze complete corpse meshes independently of transient dismemberment; firefighter corpses use authored geometry. Corpse lifetime/counts and living LODs remain unchanged.
- Reviewed 24 real-assault views (53 low / 167 high bodies): [GL low](corpses-webgl2-low.jpg), [GPU low](corpses-webgpu-low.jpg), [GL high](corpses-webgl2-high.jpg), [GPU high](corpses-webgpu-high.jpg). Heads/limbs replace torso shards; dense overlap and authored faceting remain.
- #100: cache sun/spot render variants and incrementally prewarm/link/draw alternate graphs before lamp entry. Earlier debug stalls reproduced at 3.7–4.5 s.
- Matching production entry maxima before→after: GL debug 441.3→31.9 ms, continue 421.1→26.7; GPU debug 239.4→41.8, continue 261.8→44.4. All four final guards pass.
- Loading grows 78.7–317.7 ms (limit 1 s). Tick-zero navigation costs ~2.67 s while the existing painted loading card is visible; it was previously misclassified as play.
- Accepted low assault p95: GL 5.0→5.2 ms (+0.2), GPU 3.4→3.8 (+0.4), per orchestrator tolerance. Settled medians improve 3.8→3.7 / 2.4→2.2 ms.
- Green: typecheck, lint, 71 focused tests; exact full remote 2,336 passed / 11 skipped; smoke 31/31. Guards cover real Damage→settle→freeze, persistence, normal transforms and shader warming.
- Extended 200 s profile: no playable frame >200 ms through tick 11445; ticks 33164/90240 untested. [Validation](evidence/final-validation.json), [entry audit](evidence/accepted-entry-summary.json), [assault audit](evidence/accepted-assault-audit.json); final runtime equals `5893caa68`.
