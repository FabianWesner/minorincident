# Scene Lab cost per effect

CPU submission p95 in ms, at zoom 1. Draws/triangles are maxima. These shared-Mac timings are **not E18 native frame-time certification**; see scene-costs.json for every zoom and cold maximum.

| Effect | Backend | Tier | CPU p95 before → after | Draws before → after | Triangles before → after |
| --- | --- | --- | --- | --- | --- |
| vfx-rifle-cover | webgl2 | high | 3.3 → 2.8 | 29 → 32 | 88548 → 88592 |
| vfx-rifle-cover | webgl2 | low | 2.9 → 3.5 | 29 → 32 | 50957 → 50999 |
| vfx-rifle-cover | webgpu | high | 5.1 → 5.8 | 29 → 32 | 88548 → 88592 |
| vfx-rifle-cover | webgpu | low | 3.1 → 3 | 29 → 32 | 50957 → 50999 |
| vfx-vehicle-contact | webgl2 | high | 14.8 → 14.7 | 54 → 59 | 120810 → 129046 |
| vfx-vehicle-contact | webgl2 | low | 2.7 → 5.2 | 49 → 54 | 54770 → 56860 |
| vfx-vehicle-contact | webgpu | high | 15.8 → 15.4 | 54 → 59 | 120810 → 129046 |
| vfx-vehicle-contact | webgpu | low | 2.7 → 3.1 | 49 → 54 | 54770 → 56860 |
