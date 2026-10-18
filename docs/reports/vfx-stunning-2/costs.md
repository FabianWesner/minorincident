# Scene Lab cost per effect (zoom 1)

CPU sim + render submission per frame (stepMs), shared Mac, not native GPU time. Max frame of the first scene in each session (explosion) is the cold first blast.

| Scene | Backend | Tier | CPU p95 ms before → after | Max frame ms before → after | Draws before → after | Triangles before → after |
| --- | --- | --- | --- | --- | --- | --- |
| explosion | webgl2 | high | 1.5 → 1.7 | 49.1 → 2.2 | 20 → 21 | 117284 → 143526 |
| explosion | webgl2 | low | 1.4 → 1.4 | 45.6 → 2.5 | 20 → 21 | 56140 → 61582 |
| explosion | webgpu | high | 1.6 → 1.5 | 24.5 → 25.7 | 20 → 21 | 117284 → 143526 |
| explosion | webgpu | low | 1.5 → 1.4 | 21.2 → 32 | 20 → 21 | 56140 → 61582 |
| rifle-impact | webgl2 | high | 2 → 3.3 | 13.6 → 6.4 | 28 → 28 | 78648 → 78648 |
| rifle-impact | webgl2 | low | 1.9 → 2.1 | 12.8 → 2.4 | 28 → 28 | 43933 → 43933 |
| rifle-impact | webgpu | high | 2.9 → 2.6 | 6.7 → 8.1 | 28 → 28 | 78648 → 78648 |
| rifle-impact | webgpu | low | 2.3 → 2 | 6.6 → 7.2 | 28 → 28 | 43933 → 43933 |
| molotov-fire | webgl2 | high | 1.4 → 1.3 | 44.1 → 1.9 | 20 → 20 | 117248 → 142210 |
| molotov-fire | webgl2 | low | 1.2 → 1.2 | 41.6 → 1.6 | 20 → 20 | 56104 → 81066 |
| molotov-fire | webgpu | high | 1.4 → 1.4 | 19.1 → 23.9 | 20 → 20 | 117248 → 142210 |
| molotov-fire | webgpu | low | 1.2 → 1.3 | 19.4 → 23.9 | 20 → 20 | 56104 → 81066 |
| vehicle-crash | webgl2 | high | 2.2 → 2 | 29.6 → 14.9 | 47 → 47 | 129205 → 155447 |
| vehicle-crash | webgl2 | low | 1.7 → 2 | 28.5 → 6.4 | 42 → 42 | 61280 → 66722 |
| vehicle-crash | webgpu | high | 3.5 → 2.1 | 15.1 → 17.2 | 47 → 47 | 129205 → 155447 |
| vehicle-crash | webgpu | low | 1.9 → 2 | 16.7 → 18.2 | 42 → 42 | 61280 → 66722 |
