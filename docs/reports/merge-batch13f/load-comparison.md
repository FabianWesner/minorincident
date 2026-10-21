
## webgpu-high-x1  (before runs: 1, after runs: 1)
| handover | playable before | after | delta | first frame b/a | max frame b/a | over50 b/a | heap MB b/a | geometries b/a | textures b/a |
|---|---|---|---|---|---|---|---|---|---|
| survivor->L7 | 4128 | 3876 | -252 (-6%) | 0/0 | 0/0 | 0/0 | 94.4/94.7 | 478/478 | 71/71 |
| L7->L8 | 8437 | 21176 | 12739 (151%) | 0/0 | 0/0 | 0/0 | 181.2/169.3 | 672/672 | 189/189 |

## pixel compare (post-load frame, same seed and tick)
| frame | differing pixels | of | share |
|---|---|---|---|
| webgpu-high-x1-L7.png | 8829 | 1440000 | 0.613% |
| webgpu-high-x1-L8.png | 11476 | 1440000 | 0.797% |
