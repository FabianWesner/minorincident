# Indexed revision: failed acceptance attempt

Runtime `a6ea63646`, bundle `index-D02R_-jM.js`. These are complete N=20 cold-load distributions, not diagnostic samples. L1 passed, but L10 WebGL2/high failed the unchanged 6.000 s maximum; its raw samples and build identity are retained in `evidence/after-indexed-failed/`. The replacement candidate must repeat all candidate configurations.

| Configuration | Median / p90 / max (s) | Gate |
| --- | --- | --- |
| L1-webgl2-high | 2.493 / 2.525 / 2.543 | PASS |
| L1-webgl2-low | 2.493 / 2.526 / 2.975 | PASS |
| L1-webgpu-high | 2.344 / 2.425 / 2.462 | PASS |
| L1-webgpu-low | 2.360 / 2.377 / 2.400 | PASS |
| L10-webgl2-high | 5.971 / 6.276 / 6.526 | FAIL |
