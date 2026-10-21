
## webgpu-high-x1  (groupB runs: 1, final runs: 1)
| handover | playable before | after | delta | first frame b/a | max frame b/a | over50 b/a | heap MB b/a | geometries b/a | textures b/a |
|---|---|---|---|---|---|---|---|---|---|
| survivor->L7 | 4089 | 3891 | -198 (-5%) | 0/0 | 0/0 | 0/0 | 94.3/94.6 | 478/478 | 71/71 |
| L7->L8 | 8546 | 21063 | 12517 (146%) | 0/0 | 0/0 | 0/0 | 181.3/169.3 | 672/672 | 189/189 |

## pixel compare (post-load frame, same seed and tick)
| frame | differing pixels | of | share |
|---|---|---|---|
| webgpu-high-x1-L7.png | 14 | 1440000 | 0.001% |
| webgpu-high-x1-L8.png | 37 | 1440000 | 0.003% |
