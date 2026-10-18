# Scene Lab cost per effect (zoom 1)

CPU sim + render submission per frame (stepMs), shared Mac, not native GPU time. Max frame of the first scene in each session (explosion) is the cold first blast.

| Scene | Backend | Tier | CPU p95 ms before → after | Max frame ms before → after | Draws before → after | Triangles before → after |
| --- | --- | --- | --- | --- | --- | --- |
| explosion | webgl2 | high | 2.7 → 2.3 | 3.2 → 2.6 | 24 → 24 | 143570 → 143570 |
| explosion | webgl2 | low | 2.4 → 1.9 | 2.8 → 2.5 | 24 → 24 | 61624 → 61624 |
| explosion | webgpu | high | 2.2 → 2 | 2.6 → 2.6 | 24 → 24 | 143570 → 143570 |
| explosion | webgpu | low | 1.9 → 1.9 | 2.6 → 2.2 | 24 → 24 | 61624 → 61624 |
| rifle-impact | webgl2 | high | 3.2 → 3 | 3.5 → 3.3 | 31 → 31 | 78692 → 78692 |
| rifle-impact | webgl2 | low | 2.8 → 2.7 | 3.3 → 3.1 | 31 → 31 | 43975 → 43975 |
| rifle-impact | webgpu | high | 3.1 → 2.5 | 3.4 → 3 | 31 → 31 | 78692 → 78692 |
| rifle-impact | webgpu | low | 2.5 → 2.5 | 2.9 → 2.8 | 31 → 31 | 43975 → 43975 |
| molotov-fire | webgl2 | high | 2.3 → 1.9 | 2.6 → 2.2 | 20 → 20 | 142210 → 142210 |
| molotov-fire | webgl2 | low | 2 → 1.9 | 2.4 → 2.5 | 20 → 20 | 60266 → 60266 |
| molotov-fire | webgpu | high | 1.9 → 1.8 | 2.6 → 2 | 20 → 20 | 142210 → 142210 |
| molotov-fire | webgpu | low | 1.8 → 1.7 | 2.4 → 2.1 | 20 → 20 | 60266 → 60266 |
| vehicle-crash | webgl2 | high | 3.3 → 3.1 | 14.1 → 15.1 | 50 → 50 | 155491 → 155491 |
| vehicle-crash | webgl2 | low | 2.5 → 2.4 | 3.3 → 4.9 | 45 → 45 | 66764 → 66764 |
| vehicle-crash | webgpu | high | 2.6 → 2.5 | 14.3 → 14.4 | 50 → 50 | 155491 → 155491 |
| vehicle-crash | webgpu | low | 2.4 → 2.2 | 2.8 → 2.8 | 45 → 45 | 66764 → 66764 |
| smoke-column | webgl2 | high | 2.3 → 2.4 | 3 → 3.1 | 24 → 24 | 143570 → 143570 |
| smoke-column | webgl2 | low | 2 → 1.9 | 2.5 → 2.5 | 24 → 24 | 61624 → 61624 |
| smoke-column | webgpu | high | 1.8 → 1.8 | 3.8 → 4.5 | 24 → 24 | 143570 → 143570 |
| smoke-column | webgpu | low | 1.7 → 1.6 | 2.1 → 2.1 | 24 → 24 | 61624 → 61624 |
