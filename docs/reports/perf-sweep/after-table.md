## after matrix

Each cell reports the worst spot percentile and maximum counters/retained heap. Times are milliseconds; heap is decimal MB. Raw JSON contains every spot and frame sample.

| Level | Tier | Backend | p50 | p95 | p99 | Hitch | Sim p95 | Draws | Triangles | Heap MB | Result |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| [L1](after/L1-high-webgl.json) | high | webgl | 5.60 | 8.40 | 9.20 | 13.40 | 1.20 | 248 | 801822 | 81.79 | pass |
| [L1](after/L1-low-webgl.json) | low | webgl | 4.20 | 5.60 | 6.60 | 9.50 | 1.20 | 202 | 351130 | 73.40 | pass |
| [L1](after/L1-high-webgpu.json) | high | webgpu | 5.10 | 6.10 | 9.00 | 13.80 | 0.90 | 248 | 801822 | 80.36 | pass |
| [L1](after/L1-low-webgpu.json) | low | webgpu | 3.90 | 5.10 | 5.60 | 10.80 | 0.90 | 200 | 351130 | 72.07 | pass |
| [L2](after/L2-high-webgl.json) | high | webgl | 6.00 | 7.50 | 12.60 | 29.30 | 1.00 | 228 | 1162145 | 88.51 | pass |
| [L2](after/L2-low-webgl.json) | low | webgl | 4.80 | 6.90 | 10.80 | 23.30 | 0.90 | 204 | 394637 | 77.68 | pass |
| [L2](after/L2-high-webgpu.json) | high | webgpu | 6.40 | 7.50 | 13.80 | 33.80 | 0.70 | 228 | 1162145 | 87.50 | pass |
| [L2](after/L2-low-webgpu.json) | low | webgpu | 4.30 | 5.50 | 9.70 | 23.50 | 0.60 | 204 | 394637 | 77.01 | pass |
| [L3](after/L3-high-webgl.json) | high | webgl | 4.80 | 6.80 | 8.00 | 12.80 | 1.40 | 178 | 797918 | 98.31 | pass |
| [L3](after/L3-low-webgl.json) | low | webgl | 4.10 | 5.70 | 10.00 | 24.10 | 1.40 | 147 | 355105 | 88.54 | pass |
| [L3](after/L3-high-webgpu.json) | high | webgpu | 4.70 | 6.10 | 8.30 | 10.80 | 1.50 | 178 | 797918 | 96.69 | pass |
| [L3](after/L3-low-webgpu.json) | low | webgpu | 3.10 | 4.60 | 7.80 | 27.60 | 1.10 | 147 | 355105 | 87.31 | pass |
| [L4](after/L4-high-webgl.json) | high | webgl | 5.90 | 7.30 | 9.80 | 16.20 | 1.20 | 222 | 687761 | 83.46 | pass |
| [L4](after/L4-low-webgl.json) | low | webgl | 4.80 | 6.20 | 9.30 | 15.30 | 0.90 | 190 | 271554 | 72.49 | pass |
| [L4](after/L4-high-webgpu.json) | high | webgpu | 6.40 | 7.70 | 8.90 | 15.30 | 0.90 | 222 | 687761 | 81.66 | pass |
| [L4](after/L4-low-webgpu.json) | low | webgpu | 4.40 | 5.40 | 7.10 | 12.30 | 0.70 | 190 | 271554 | 71.01 | pass |
| [L5](after/L5-high-webgl.json) | high | webgl | 4.70 | 6.20 | 17.00 | 74.50 | 1.00 | 181 | 557940 | 94.99 | hitch |
| [L5](after/L5-low-webgl.json) | low | webgl | 4.10 | 5.60 | 38.20 | 72.80 | 0.90 | 162 | 282937 | 73.61 | hitch |
| [L5](after/L5-high-webgpu.json) | high | webgpu | 3.90 | 4.80 | 5.90 | 9.90 | 0.60 | 179 | 557940 | 92.46 | pass |
| [L5](after/L5-low-webgpu.json) | low | webgpu | 3.20 | 4.20 | 5.00 | 8.20 | 0.60 | 162 | 282937 | 71.66 | pass |
| [L6](after/L6-high-webgl.json) | high | webgl | 3.50 | 5.40 | 6.50 | 11.50 | 0.80 | 157 | 287843 | 60.85 | pass |
| [L6](after/L6-low-webgl.json) | low | webgl | 3.80 | 5.60 | 7.00 | 10.90 | 0.80 | 128 | 167550 | 55.15 | pass |
| [L6](after/L6-high-webgpu.json) | high | webgpu | 2.50 | 3.30 | 4.20 | 11.30 | 0.60 | 157 | 287843 | 59.58 | pass |
| [L6](after/L6-low-webgpu.json) | low | webgpu | 2.70 | 3.30 | 6.00 | 9.50 | 0.60 | 128 | 167550 | 54.09 | pass |
| [L7](after/L7-high-webgl.json) | high | webgl | 4.30 | 6.70 | 9.00 | 17.70 | 1.80 | 143 | 408768 | 75.06 | pass |
| [L7](after/L7-low-webgl.json) | low | webgl | 3.40 | 5.20 | 8.20 | 16.50 | 1.30 | 82 | 108531 | 67.01 | pass |
| [L7](after/L7-high-webgpu.json) | high | webgpu | 4.10 | 5.90 | 8.20 | 16.80 | 1.50 | 143 | 408768 | 73.58 | pass |
| [L7](after/L7-low-webgpu.json) | low | webgpu | 2.60 | 3.90 | 5.20 | 13.00 | 1.00 | 82 | 108531 | 65.32 | pass |
| [L8](after/L8-high-webgl.json) | high | webgl | 3.80 | 5.50 | 7.10 | 14.20 | 0.90 | 184 | 553635 | 136.97 | pass |
| [L8](after/L8-low-webgl.json) | low | webgl | 3.30 | 5.10 | 6.30 | 11.50 | 1.00 | 156 | 101091 | 97.12 | pass |
| [L8](after/L8-high-webgpu.json) | high | webgpu | 3.20 | 4.00 | 4.60 | 10.20 | 0.60 | 184 | 553635 | 132.00 | pass |
| [L8](after/L8-low-webgpu.json) | low | webgpu | 2.20 | 3.20 | 3.70 | 7.60 | 0.60 | 156 | 101091 | 93.55 | pass |
| [L9](after/L9-high-webgl.json) | high | webgl | 4.50 | 5.40 | 6.30 | 14.60 | 0.70 | 328 | 177856 | 174.43 | pass |
| [L9](after/L9-low-webgl.json) | low | webgl | 5.00 | 5.80 | 6.50 | 13.70 | 0.70 | 214 | 148642 | 134.02 | pass |
| [L9](after/L9-high-webgpu.json) | high | webgpu | 3.50 | 4.20 | 5.20 | 11.50 | 0.40 | 328 | 177856 | 170.14 | pass |
| [L9](after/L9-low-webgpu.json) | low | webgpu | 3.60 | 4.30 | 6.10 | 10.70 | 0.40 | 214 | 148642 | 131.16 | pass |
| [L10](after/L10-high-webgl.json) | high | webgl | 3.90 | 5.40 | 6.20 | 13.50 | 0.90 | 169 | 95287 | 133.49 | pass |
| [L10](after/L10-low-webgl.json) | low | webgl | 3.80 | 5.00 | 6.40 | 11.80 | 0.90 | 162 | 38889 | 98.36 | pass |
| [L10](after/L10-high-webgpu.json) | high | webgpu | 2.70 | 3.40 | 3.80 | 8.70 | 0.60 | 169 | 95287 | 129.91 | pass |
| [L10](after/L10-low-webgpu.json) | low | webgpu | 2.00 | 2.70 | 3.10 | 7.40 | 0.60 | 162 | 38889 | 95.71 | pass |

40/40 cells recorded.
