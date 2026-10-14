## before matrix

Each cell reports the worst spot percentile and maximum counters/retained heap. Times are milliseconds; heap is decimal MB. Raw JSON contains every spot and frame sample.

| Level | Tier | Backend | p50 | p95 | p99 | Hitch | Sim p95 | Draws | Triangles | Heap MB | Result |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| [L1](before/L1-high-webgl.json) | high | webgl | 7.40 | 8.60 | 9.50 | 12.50 | 1.20 | 249 | 801822 | 80.78 | pass |
| [L1](before/L1-low-webgl.json) | low | webgl | 5.60 | 6.70 | 7.20 | 11.20 | 1.10 | 203 | 351130 | 72.33 | pass |
| [L1](before/L1-high-webgpu.json) | high | webgpu | 6.80 | 7.70 | 9.20 | 12.70 | 0.80 | 249 | 801822 | 79.14 | pass |
| [L1](before/L1-low-webgpu.json) | low | webgpu | 4.90 | 5.80 | 6.30 | 9.80 | 0.80 | 203 | 351130 | 71.06 | pass |
| [L2](before/L2-high-webgl.json) | high | webgl | 7.80 | 9.80 | 17.10 | 33.10 | 0.90 | 229 | 1162345 | 87.52 | pass |
| [L2](before/L2-low-webgl.json) | low | webgl | 7.60 | 9.50 | 13.10 | 29.10 | 0.80 | 205 | 394837 | 76.72 | pass |
| [L2](before/L2-high-webgpu.json) | high | webgpu | 7.30 | 9.90 | 14.60 | 26.70 | 0.60 | 229 | 1162345 | 86.49 | pass |
| [L2](before/L2-low-webgpu.json) | low | webgpu | 5.90 | 7.80 | 10.60 | 27.70 | 0.60 | 205 | 394837 | 75.88 | pass |
| [L3](before/L3-high-webgl.json) | high | webgl | 8.10 | 9.00 | 12.90 | 14.00 | 1.30 | 170 | 798118 | 97.46 | pass |
| [L3](before/L3-low-webgl.json) | low | webgl | 7.00 | 8.10 | 15.40 | 26.70 | 1.20 | 142 | 355305 | 87.38 | pass |
| [L3](before/L3-high-webgpu.json) | high | webgpu | 6.80 | 7.90 | 9.00 | 12.10 | 1.00 | 179 | 798118 | 95.65 | pass |
| [L3](before/L3-low-webgpu.json) | low | webgpu | 6.20 | 7.80 | 16.40 | 31.40 | 1.00 | 148 | 355305 | 86.14 | pass |
| [L4](before/L4-high-webgl.json) | high | webgl | 7.40 | 8.40 | 10.80 | 16.40 | 1.10 | 223 | 687961 | 82.83 | pass |
| [L4](before/L4-low-webgl.json) | low | webgl | 6.10 | 7.10 | 9.00 | 36.30 | 0.80 | 191 | 271754 | 71.97 | pass |
| [L4](before/L4-high-webgpu.json) | high | webgpu | 5.90 | 7.20 | 9.20 | 13.90 | 0.80 | 223 | 687961 | 81.05 | pass |
| [L4](before/L4-low-webgpu.json) | low | webgpu | 4.60 | 5.50 | 8.00 | 17.40 | 0.60 | 191 | 271754 | 70.42 | pass |
| [L5](before/L5-high-webgl.json) | high | webgl | 5.70 | 7.10 | 8.40 | 13.10 | 1.00 | 180 | 557940 | 94.68 | pass |
| [L5](before/L5-low-webgl.json) | low | webgl | 4.70 | 6.00 | 6.70 | 12.60 | 0.90 | 163 | 282937 | 73.03 | pass |
| [L5](before/L5-high-webgpu.json) | high | webgpu | 4.70 | 5.70 | 7.00 | 10.30 | 0.60 | 180 | 557940 | 91.82 | pass |
| [L5](before/L5-low-webgpu.json) | low | webgpu | 3.90 | 4.70 | 5.20 | 9.40 | 0.60 | 163 | 282937 | 71.35 | pass |
| [L6](before/L6-high-webgl.json) | high | webgl | 3.80 | 5.60 | 9.30 | 13.00 | 0.80 | 158 | 288043 | 60.49 | pass |
| [L6](before/L6-low-webgl.json) | low | webgl | 3.20 | 5.10 | 6.70 | 12.00 | 0.80 | 129 | 167750 | 55.11 | pass |
| [L6](before/L6-high-webgpu.json) | high | webgpu | 2.80 | 3.60 | 4.00 | 13.60 | 0.60 | 158 | 288043 | 59.37 | pass |
| [L6](before/L6-low-webgpu.json) | low | webgpu | 2.20 | 2.80 | 3.20 | 11.00 | 0.60 | 129 | 167750 | 53.98 | pass |
| [L7](before/L7-high-webgl.json) | high | webgl | 5.10 | 7.40 | 9.60 | 17.30 | 1.60 | 144 | 408968 | 75.04 | pass |
| [L7](before/L7-low-webgl.json) | low | webgl | 3.70 | 5.10 | 6.60 | 13.80 | 1.00 | 83 | 108731 | 66.95 | pass |
| [L7](before/L7-high-webgpu.json) | high | webgpu | 4.40 | 6.10 | 7.60 | 17.00 | 1.50 | 144 | 408968 | 73.13 | pass |
| [L7](before/L7-low-webgpu.json) | low | webgpu | 3.70 | 4.90 | 6.30 | 12.70 | 1.00 | 83 | 108731 | 65.20 | pass |
| [L8](before/L8-high-webgl.json) | high | webgl | 4.00 | 5.40 | 6.00 | 15.70 | 1.00 | 185 | 553835 | 136.42 | pass |
| [L8](before/L8-low-webgl.json) | low | webgl | 3.60 | 5.00 | 5.80 | 11.90 | 0.90 | 157 | 101291 | 96.57 | pass |
| [L8](before/L8-high-webgpu.json) | high | webgpu | 3.30 | 4.20 | 5.80 | 10.70 | 0.60 | 185 | 553835 | 131.91 | pass |
| [L8](before/L8-low-webgpu.json) | low | webgpu | 2.50 | 3.20 | 4.30 | 8.20 | 0.60 | 157 | 101291 | 93.41 | pass |
| [L9](before/L9-high-webgl.json) | high | webgl | 4.70 | 5.60 | 6.70 | 14.40 | 0.70 | 329 | 177856 | 173.87 | pass |
| [L9](before/L9-low-webgl.json) | low | webgl | 3.90 | 5.00 | 5.90 | 12.80 | 0.60 | 215 | 148642 | 133.56 | pass |
| [L9](before/L9-high-webgpu.json) | high | webgpu | 3.50 | 4.20 | 5.00 | 11.30 | 0.40 | 329 | 177856 | 169.77 | pass |
| [L9](before/L9-low-webgpu.json) | low | webgpu | 2.80 | 3.80 | 4.60 | 10.00 | 0.40 | 215 | 148642 | 130.80 | pass |
| [L10](before/L10-high-webgl.json) | high | webgl | 4.00 | 5.30 | 6.20 | 13.70 | 0.80 | 170 | 95287 | 133.10 | pass |
| [L10](before/L10-low-webgl.json) | low | webgl | 3.00 | 4.70 | 5.60 | 11.40 | 0.80 | 163 | 39089 | 98.03 | pass |
| [L10](before/L10-high-webgpu.json) | high | webgpu | 2.80 | 3.50 | 3.90 | 9.00 | 0.60 | 170 | 95287 | 129.88 | pass |
| [L10](before/L10-low-webgpu.json) | low | webgpu | 1.90 | 2.80 | 3.40 | 7.50 | 0.70 | 163 | 39089 | 95.73 | pass |

40/40 cells recorded.
