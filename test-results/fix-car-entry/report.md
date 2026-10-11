PKG-09 / FIX-08: preserved authored door geometry, synchronized courier boarding/step-down, corrected all seven doorway anchors and capsule-safe exits.  
Captures: reviewed all 56 before/after game and Scene Lab close sheets for seven cars, stopped/moving entry and exit; courier waits for the opening door, boards and lands outside the chassis ([review](review.md)).  
Assets: canonical fire-engine and runtime exports regenerated; all seven base LODs meet 80k/6k/2k triangles and 1500 KiB; baseline bus node-contract errors retained ([budgets](assets.json)).  
Passed: typecheck, lint, build, 802 unit tests (2 workers), final 12 asset tests; scoped T-E09-02, T-E09-08 and T-E20-05, seven-car control/occupant checks and capture assertions.  
Full E09/E20 rerun: baseline API/rack/T-E20-21 failures remain; E20 browser 32/33 pass; additional performance rerun remains non-green (desktop p95 14.8/14 ms, reveal 57.4/50 ms; baseline mobile also fails)—see review/logs.  
Committed source 07bf4ddb and captures 648288df on lane/fix-car-entry; temporary baseline removed, only referenced before/after media retained; no merge or deployment.
