# Scene Lab cost per effect

CPU submission p95 in ms, at zoom 1. Draws/triangles are maxima. These shared-Mac timings are **not E18 native frame-time certification**; see scene-costs.json for every zoom and cold maximum. Captures span earlier revisions; final cover/contact refinements are unmeasured. The saved raw checks are 132/144 passing; see README for obsolete cover-fixture expectations.

| Effect | Backend | Tier | CPU p95 before → after | Draws before → after | Triangles before → after |
| --- | --- | --- | --- | --- | --- |
| vfx-alpha-hit | webgl2 | high | 2.6 → 2.9 | 29 → 29 | 77595 → 77595 |
| vfx-alpha-hit | webgl2 | low | 2.4 → 2.2 | 29 → 29 | 42880 → 42880 |
| vfx-alpha-hit | webgpu | high | 2.4 → 2.6 | 29 → 29 | 77595 → 77595 |
| vfx-alpha-hit | webgpu | low | 2.3 → 2.3 | 29 → 29 | 42880 → 42880 |
| vfx-explosion | webgl2 | high | 1.7 → 2.1 | 20 → 20 | 117284 → 117284 |
| vfx-explosion | webgl2 | low | 1.6 → 1.4 | 20 → 20 | 56140 → 56140 |
| vfx-explosion | webgpu | high | 1.9 → 1.5 | 20 → 20 | 117284 → 117284 |
| vfx-explosion | webgpu | low | 1.7 → 2.1 | 20 → 20 | 56140 → 56140 |
| vfx-gore | webgl2 | high | 2 → 2.3 | 26 → 26 | 74673 → 74673 |
| vfx-gore | webgl2 | low | 2.2 → 2 | 26 → 26 | 46655 → 46655 |
| vfx-gore | webgpu | high | 2.1 → 3.2 | 26 → 26 | 74673 → 74673 |
| vfx-gore | webgpu | low | 1.9 → 1.8 | 26 → 26 | 46655 → 46655 |
| vfx-molotov-fire | webgl2 | high | 1.5 → 1.6 | 20 → 20 | 117248 → 117248 |
| vfx-molotov-fire | webgl2 | low | 1.3 → 1.5 | 20 → 20 | 56104 → 56104 |
| vfx-molotov-fire | webgpu | high | 1.6 → 1.5 | 20 → 20 | 117248 → 117248 |
| vfx-molotov-fire | webgpu | low | 1.3 → 1.3 | 20 → 20 | 56104 → 56104 |
| vfx-rifle-cover | webgl2 | high | 3.1 → 3.4 | 29 → 29 | 88548 → 88548 |
| vfx-rifle-cover | webgl2 | low | 3.8 → 3 | 29 → 29 | 50957 → 50957 |
| vfx-rifle-cover | webgpu | high | 4.3 → 4.1 | 29 → 29 | 88548 → 88548 |
| vfx-rifle-cover | webgpu | low | 6.9 → 3.4 | 29 → 29 | 50957 → 50957 |
| vfx-rifle-impact | webgl2 | high | 2.5 → 2.2 | 28 → 28 | 78648 → 78648 |
| vfx-rifle-impact | webgl2 | low | 3.5 → 1.8 | 28 → 28 | 43933 → 43933 |
| vfx-rifle-impact | webgpu | high | 2.3 → 2.1 | 28 → 28 | 78648 → 78648 |
| vfx-rifle-impact | webgpu | low | 2.2 → 2 | 28 → 28 | 43933 → 43933 |
| vfx-shotgun-impact | webgl2 | high | 2.4 → 2.2 | 27 → 27 | 77653 → 77653 |
| vfx-shotgun-impact | webgl2 | low | 2.4 → 2.5 | 27 → 27 | 42938 → 42938 |
| vfx-shotgun-impact | webgpu | high | 2.1 → 2 | 27 → 27 | 77653 → 77653 |
| vfx-shotgun-impact | webgpu | low | 1.8 → 3 | 27 → 27 | 42938 → 42938 |
| vfx-vehicle-contact | webgl2 | high | 15.1 → 13.7 | 54 → 56 | 120810 → 129002 |
| vfx-vehicle-contact | webgl2 | low | 2.9 → 3.1 | 49 → 51 | 54770 → 56818 |
| vfx-vehicle-contact | webgpu | high | 15.7 → 16.2 | 54 → 56 | 120810 → 129002 |
| vfx-vehicle-contact | webgpu | low | 3.2 → 3.1 | 49 → 51 | 54770 → 56818 |
| vfx-vehicle-crash | webgl2 | high | 11.4 → 12.1 | 47 → 47 | 101065 → 101065 |
| vfx-vehicle-crash | webgl2 | low | 1.8 → 2.1 | 42 → 42 | 33140 → 33140 |
| vfx-vehicle-crash | webgpu | high | 12.3 → 12.9 | 47 → 47 | 101065 → 101065 |
| vfx-vehicle-crash | webgpu | low | 1.9 → 1.9 | 42 → 42 | 33140 → 33140 |
