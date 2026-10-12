Z-D1: built `amb.elephant` once in headless Blender and derived `inf.elephant` with the same rig/proportions, dark skin, wounds and red eyes; integrated all six exports.
LOD triangles normal/infected: 8870/8974, 3624/3728, 1368/1472; each uses 4 materials; runtime files are 24.1–54.7 KiB; 12 raw/runtime validations pass.
Checks: typecheck, lint, build and full Hetzner units 819/819 pass; elephant browser 5/5, Scene Lab 4/4 and native horde performance/readability 2/2 pass.
Reviewed all-LOD lion/gorilla/reference and near/mid/far/motion captures: no clipping, invisible actors or persistent jitter; sink improved 6.6→0 cm; stock trot slide remains 17.9 cm (see [review](review.md)).
E18 high/low: 200/100 infected, 54/54 draws, 676927/315183 triangles, 6.4/3.4 ms frame p95, 1.0/0.5 ms sim p95 and CDP live heap 146/178 MB; native Metal, not physical-phone certification.
Broader E07 is not green: remote verify 212 pass/2 timing failures (all 7 timing checks pass on Mac); existing Alpha/browser failures are recorded in [checks](checks.json); no thresholds changed, merge or deployment.
