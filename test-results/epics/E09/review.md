# E09 vehicle feel vision review — 2026-10-07

Reviewed `brake-siren-right.png`, `driving-wheels.png` and `brake-siren-left.png` at 1600×900, DPR 1, headless Chromium on macOS ANGLE/Metal. The fixed vehicle camera shows the integrated native police model. The old goldens showed the earlier placeholder and ground palette; these three replacement goldens were reviewed individually before approval. No global comparison threshold changed.

| AC10 check | Result | Evidence |
| --- | --- | --- |
| Wheels spin with speed | PASS | Front and rear rotation changes by 3.72783 radians in 30 fixed ticks. |
| Front wheels steer, rear wheels stay straight | PASS | Front pivots reach -0.22976 radians; rear pivots remain zero. |
| Brake lamps brighten | PASS | Both native rear lenses glow red at rest and darken while driving: 526 versus 0 red pixels in projected masks. |
| Emergency sirens alternate | PASS | The stationary captures visibly alternate red outer sections and blue centre sections; native lamp masks change 585 and 602 pixels. |
| Driver hides | PASS | No survivor or weapon geometry obscures the driven police vehicle. |
| Native parts and materials remain readable | PASS | Black/cream paint, POLICE lettering, badge, glass, rubber tires, hubs, bumpers, headlights and roof lightbar remain distinct. |

The native lamp positions were read from `assets/veh.police-sedan/build.py` and the model offset in `VehicleView`; probes now cover the two lenses and the actual lightbar rather than the historical placeholder bar. This is a functional rendering review, not a new art approval. Existing native asset fidelity is covered by `assets/veh.police-sedan/review.md`. The isolated two-car fixture records 60 draw calls and 140,353 triangles, below the 600 / 1,500,000 budgets.

The town driving review video and its manoeuvre evidence are documented in `report.md`. Human judgement of driving feel remains required; automated steering, drift, recovery and fixed-step determinism checks establish the mechanical behaviour.
