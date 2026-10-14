# Native ending performance

Headless Chrome / native Metal, 1600×900, DPR 1; quiet-run owns all browser slots. Low is the low quality tier on this desktop, not a physical-phone claim. Each case samples three pull-out phases, then warms one R1/R7 cycle and checks five more.

| Backend | Tier | Zoom | Frame p95 ms | Sim p95 ms | Draws | Triangles | Heap MB | Resident | Voices | Puffs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| webgl | high | 1 | 8.50 | 0.60 | 242 | 304,858 | 209.1 | 20 | 12 | 73 |
| webgl | high | 0.5 | 8.60 | 0.60 | 230 | 279,677 | 208.9 | 20 | 16 | 24 |
| webgl | low | 1 | 6.30 | 0.40 | 181 | 95,417 | 159.0 | 9 | 12 | 25 |
| webgl | low | 0.5 | 7.20 | 0.50 | 177 | 97,227 | 158.9 | 9 | 12 | 8 |
| webgpu | high | 1 | 6.80 | 0.40 | 242 | 348,968 | 205.7 | 20 | 14 | 73 |
| webgpu | high | 0.5 | 6.90 | 0.40 | 230 | 279,677 | 205.3 | 20 | 17 | 23 |
| webgpu | low | 1 | 5.00 | 0.40 | 181 | 95,417 | 156.9 | 9 | 12 | 25 |
| webgpu | low | 0.5 | 4.80 | 0.30 | 177 | 97,227 | 156.8 | 9 | 12 | 7 |

High limits: 16.7 ms frame, 4 ms sim, 600 draws, 1.5M triangles, 400 MB heap, 25 resident chunks, 32 voices, 400 column/mist puffs. Low: 33.3 / 6 ms, 300 draws, 500k triangles, 250 MB, 9 chunks, 16 voices, 120 puffs. All eight cases pass. Healthy survivor counts are 6/3; corpses remain across every warmed revisit. Heap/geometries/textures stay within 10% of the first warmed cycle.

The shared effect/light checks also pass in every case: particles including mist ≤6k/2k, gibs ≤80/30, debris ≤120/40, awake props ≤150/60, hero lights ≤8/3 and hero shadows ≤3/1.

Full raw measurements and six cycle samples per case are in [native-performance.json](native-performance.json). Admission conditions are in [native-conditions.json](native-conditions.json). Each reservation lasted under five minutes and was released between batches; other browser checks ran between the timing batches. Physical iOS/Android FPS and release/seam hitch distributions were not measured in this lane.
