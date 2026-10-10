# ped-props — street furniture crowd collision

Revision: `4dc4ce08` (includes merge of main `d27704a2`; own final code change `a9046663`). Validation is in progress.

## Cause and change

E26 pushable placements are removed from DistrictWorld’s static collider/nav bake. PropSystem previously registered only displaced medium/heavy props with crowd navigation, leaving authored benches and all light furniture open to NPC capsules.

Resting enabled props now register their actual collider footprints during assembly, for every mass class. InfectedSystem seeds the shared and district crowd grids from those blockers. Moving, broken and braced props release their blockers; barricade ownership updates immediately. Props forced to sleep by the existing awake cap register their new footprint in that same tick. No placements, crowds or budgets were removed or reduced.

Live blockers use NavGrid’s existing 4 m spatial broad phase. Regression coverage includes initial benches/light props, swept movement, displaced rest, movement, breakage, barricades, blocker replacement and mutable bounds.

## Penetration gate

Scene Lab records consecutive standing actor/collider overlaps independently of navigation and rendering. The campaign gate samples L1–L6 for 1,200 ticks, allows at most two consecutive frames, and writes per-level metrics. Isolated woman, infected and ally bench scenes require zero frames. Seated, fallen, finished, hidden and dead figures have no walking capsule in this metric; buildings are not street furniture.

## Validation so far

- Focused regression suite: 35 passed. The forced-sleep regression failed before the fix and passes afterward.
- Merged `4dc4ce08` remote unit suite: 132 files / 463 tests passed, including typecheck, lint and production build (457.37 s).
- Remote E26 verification and smoke: 29 selected tests passed.
- Native GPU high/phone budgets: 13/14 passed, unchanged populations and limits. L4 phone collapse triangles: 518,872 versus 500,000; quiet rerun queued.
- Pre-merge `a9046663` full remote simulations with both runner slots reserved and one worker: 67 files / 488 tests passed (six existing skips), 967.28 s. The earlier shared run had six timing/timeout failures; L3 high/low campaign p95 is 2.95/2.74 ms in the isolated run versus the unchanged 4/6 ms budgets.
- Scene Lab campaign gate: all six levels passed at zero consecutive penetration frames over 1,200 ticks each. Capsule samples: L1 73,416; L2 43,418; L3 33,033; L4 74,462; L5 24,020; L6 25,221.
- Four isolated bench scenes passed at zero penetration frames and zero console errors (600 ticks / 1,200 actor samples each).
- Original-omission reproduction: disabling resting crowd blockers produced 105 consecutive woman/bench penetration frames, 191 total overlap frames.
- Production level/browser suite: 38/39 passed. Oak’s original detour went through a resting planter (`D-CORRIDOR/l3-garden-70`); its test driver now goes along the clear south side of the wreck, retaining the same 1.2 m arrival checks and mission assertions. The corrected route rerun passed in 57.3 s with zero deaths: all 39 production level/smoke checks are green across the initial 38 passes and this rerun.
- Inspected `sidewalk-capture-final/shot-0240.png` and `sheet.jpg`: the authored `D-GROVE/prop.bench:1341` is on the tiled sidewalk, beside the lawn and picket fence. The shoulder-bag woman and opposing pedestrian arc around the street-facing side, continue past it and return. Scene Lab reports zero penetrations in 600 ticks / 1,200 actor samples. The earlier negative reproduction used the same bench asset at placement 355.

Raw evidence is in `perf/`, `e26-node.json`, and sibling `../ped-props-final-suite/` logs. Final per-level metrics and inspected capture will be added after the queued runs.

A supplementary Linux software-rendered browser run passed two continuity checks but hit fixture setup failures (infected concurrency cap and a Begin mission click timeout). It was stopped with failure logs preserved. The full native Mac level/smoke rerun is queued.

No deployment or merge into main was performed.
