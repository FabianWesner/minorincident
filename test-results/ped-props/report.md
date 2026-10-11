# ped-props — street furniture crowd collision

Code revision: `dc7f8ee5`; main merged through `d27704a2`. All requested validation is green.

## Root cause and fix

DistrictWorld excludes E26 pushable placements from its static collider/navigation bake. PropSystem formerly registered only displaced medium/heavy props with crowd navigation. Authored benches and all light furniture consequently had physical colliders but no crowd blockers.

Every enabled resting prop now registers its actual transformed collider footprint during assembly. InfectedSystem seeds shared and district crowd grids from those blockers, covering civilians, infected and allies across all levels. Moving, broken and braced props release their blockers; barricade ownership updates immediately. The existing awake cap also registers a prop in the same tick that it forces the body to sleep. Live blockers use NavGrid’s existing spatial broad phase, including correct replacement/removal of mutable bounds. No props, crowds or performance budgets were removed or reduced.

Regression coverage includes initial benches and light furniture, collider offsets and rotation, displaced rest, movement, breakage, barricades, forced sleep, mutable bounds and replacement. The forced-sleep regression failed before its fix and passes afterward.

## Scene Lab gate and visual evidence

Scene Lab samples standing actor capsules against static street-furniture footprints independently of navigation/rendering. It records consecutive overlaps per actor/prop, allowing at most two frames in campaign gates. Seated, fallen, finished, hidden and dead figures are excluded; buildings are excluded. Production level tests run the same gate.

Fresh campaign runs sampled 1,200 ticks per level:

| Level | Capsule samples | Maximum consecutive penetration frames |
| --- | ---: | ---: |
| L1 | 73,416 | 0 |
| L2 | 43,418 | 0 |
| L3 | 33,033 | 0 |
| L4 | 74,462 | 0 |
| L5 | 24,020 | 0 |
| L6 | 25,221 | 0 |

All four focused scenes passed the stricter zero-frame gate and recorded zero console errors (600 ticks / 1,200 actor samples each). Disabling resting blockers to reproduce the omission yielded **105 consecutive woman/bench penetration frames**, 191 total. That negative control used the same bench asset at Grove placement 355.

Inspected [game-camera capture](sidewalk-capture-final/shot-0240.png) and [contact sheet](sidewalk-capture-final/sheet.jpg): authored `D-GROVE/prop.bench:1341` sits on the tiled sidewalk beside a lawn and picket fence. The shoulder-bag woman and opposing pedestrian arc around its street-facing side, continue past it and return. Neither walks through the seat. This reproduces the PO’s spot type, with the authored bench and neighboring assets retained.

## Validation

- Typecheck, lint and production build passed on the final code revision.
- Remote unit suite: **132 files / 464 tests passed**, 448.33 s.
- Remote simulation suite: **68 files / 489 tests passed**, six existing skips, 977.04 s. Renderer-only changes followed this run; simulation code was unchanged.
- Native Mac headless high/phone performance: **all 14 checks passed**, including L1–L6 and both L6 transitions, unchanged budgets and populations.
- Production levels and smoke: **39/39 passed in one final run**, no failures, skips or flaky results, 606.80 s.
- Six campaign capsule gates and four focused scenes passed as described above.
- E26 verification: typecheck, lint, build, **31 remote node checks and 31 browser checks passed** (Chromium, phone portrait/landscape, iPhone and WebKit profiles).

Remote suites used one worker and reserved both runner slots. Native performance held both browser slots and used one worker; the level suite used two. Browser automation was headless through `tools/e2e-lock.sh`; native WebGL used Metal. WebGPU-labelled visibility checks retain the existing fallback behavior; no manual WebGPU validation is claimed.

## Performance fixes required by unchanged budgets

L4 phone initially exceeded its 500,000-triangle ceiling (518,872, then 531,941). Frozen corpse pages combined up to 128 bodies from across the map, submitting distant bodies whenever any body on that page was visible. Pages now group bodies within 16 m world cells so normal frustum culling can reject distant pages. All bodies and geometry persist; prewarmed pages are reused. A focused regression failed before this change and passes afterward.

Creating additional spatial pages initially exposed L6 first-page hitches. Pages now share cached frozen geometry attributes and warmed materials while keeping instance state separate. All six static-corpse regressions pass. Targeted L6 maximum frames are 16.8 ms high / 47.4 ms phone against unchanged 50/80 ms limits, with no long tasks. The final full performance suite passes; L4 phone submits **360,367 triangles**, retaining its 48 infected and 20 civilians. See [final performance summary](perf-summary-final.json).

## Integration and test-driver adjustments

The required main merge increased fire-axe damage by 25%. Existing TTK lower bands rejected the resulting brute/riot hit counts. `src/data/balance.ts` now applies the existing inverse damage scaling and one 0.5 s swing of discrete hit-count rounding. Upper TTK bounds and weapon damage remain unchanged. All eight focused combat checks and the full simulation suite pass.

Oak’s old test-driver detour crossed the newly respected resting planter `D-CORRIDOR/l3-garden-70`. Its route now uses the clear south side of the wreck, retaining the same 1.2 m arrival checks and mission assertions. The final full-suite Oak playthrough passed with zero deaths. No level placement or per-bench gameplay workaround was introduced.

Earlier shared simulation timing failures were superseded by the isolated full pass. A supplementary Linux software-rendered browser run was stopped after fixture setup failures; the complete native Mac run above passed, including those fixtures.

Compact evidence: [proof summary](proof-summary.json), [per-level capsule metrics](campaign-scene-lab/), [baseline reproduction](baseline.json), and the capture links above. Raw logs and traces remain in this worktree’s ignored test results.

No deployment or merge into main was performed.
