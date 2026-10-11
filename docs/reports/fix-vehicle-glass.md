PKG-10/11/12 implemented: transparent material caching, real engine/bus openings, seats/wheel and stable LOD anchors; gates remain blocked.
Inspected before/after game, close, all-LOD and seated Scene Lab captures: [review](../scenes/vehicle-glass/README.md); interiors visible, frames/body opaque, lights/silhouette retained.
Budgets: engine LOD0 66,202→67,986 triangles / 39→40 draws; bus 76,108→78,788 / 29→34; every tier validates; runtime visual 58 draws / 86,203 triangles.
Typecheck, lint, build and 794 unit tests pass (2 workers); strict T-E09-10, T-E20-05 and tagged T-E20-18 pass; original assertions/tolerances retained.
Verify E09/E25/E20 fail: known save mismatch plus API/audio/driving/curb, baseline-confirmed house probe and rescued-person lifecycle; P1 player-outside-truck / sitting-hand clipping notified to PKG-13/14.
Own worktree committed without merge/deploy; temporary checkouts and duplicate screenshots/videos removed; retained before/after set and detailed evidence linked above.
