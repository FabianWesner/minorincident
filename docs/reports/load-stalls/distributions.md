# Cold-load distributions

Production snapshots, native Metal GPU, one headless browser through `quiet-run.sh`; a new browser/profile per observation. Times are click → closed loading card. Median is the mean of the middle pair; p90 uses nearest rank. Profiled traces are excluded.

The candidate records the first post-card frames of all 20 loads and a ten-second movement segment in the final fresh profile of each configuration. L10 lamp-boundary replay is a separate guard. `PASS` requires the executable probe gate to succeed, including ≤6 s worst load, median no slower, native backend, no browser errors and ≤200 ms post-card frames.

| Configuration | N before/after | Before median/p90/max (s) | After median/p90/max (s) | Max post-card (ms) | Gate |
| --- | ---: | --- | --- | ---: | --- |
| L1 webgpu low | 20/— | 2.459/2.511/2.561 | pending | — | pending |
| L1 webgpu high | 20/— | 2.485/2.559/2.592 | pending | — | pending |
| L1 webgl2 low | 20/— | 2.642/2.719/2.743 | pending | — | pending |
| L1 webgl2 high | 20/— | 2.627/2.686/2.773 | pending | — | pending |
| L4 webgpu low | —/— | pending | pending | — | pending |
| L4 webgpu high | —/— | pending | pending | — | pending |
| L4 webgl2 low | —/— | pending | pending | — | pending |
| L4 webgl2 high | —/— | pending | pending | — | pending |
| L7 webgpu low | —/— | pending | pending | — | pending |
| L7 webgpu high | —/— | pending | pending | — | pending |
| L7 webgl2 low | —/— | pending | pending | — | pending |
| L7 webgl2 high | —/— | pending | pending | — | pending |
| L8 webgpu low | —/— | pending | pending | — | pending |
| L8 webgpu high | 20/— | 24.270/24.571/24.627 | pending | — | pending |
| L8 webgl2 low | —/— | pending | pending | — | pending |
| L8 webgl2 high | —/— | pending | pending | — | pending |
| L10 webgpu low | —/— | pending | pending | — | pending |
| L10 webgpu high | —/— | pending | pending | — | pending |
| L10 webgl2 low | —/— | pending | pending | — | pending |
| L10 webgl2 high | —/— | pending | pending | — | pending |
