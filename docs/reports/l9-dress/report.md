L9-D2: dressed D-CROSSING using existing countryside stock; added farmsteads, highway stop, groves, dry wreck/rock clusters and approach chevrons.
Reused L9-crossing moonlight with dry light wind; all three routes, detours and sightlines remain open, and boundary bypasses still trigger the authored crash.
Added six Scene Lab catalog scenes; opened and described all 72 final WebGL/WebGPU high/low captures at zoom 0.5/1/1.5 in review.md.
E18: 60 populated region cases pass; regional frame p95 ≤5.6/10.3 ms high/low. Six final high route probes pass: ≤13.2 ms p95, ≤36.4 ms hitch, <0.3% repeated-traversal heap growth.
Validation: full remote unit 1329 passed/7 skipped; focused crossing sim 21 passed; final E31 verify exits zero with 82 remote and 55 headless browser passes; typecheck/lint/build pass.
Broad runs had 16 sim and 11 level failures; original failures, baseline reproductions and successful targeted rechecks remain documented in review.md and validation-summary.json. No deploy or merge.
