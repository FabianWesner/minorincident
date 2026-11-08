# AC10: high-tier wet-surface SSR

The previous high-tier pipeline had no screen-space reflection pass. It now uses the installed Three.js SSR node at half resolution and half ray-march quality, restricted to the same directional wet mask used by surface rendering. View normals and world positions come from the existing opaque depth buffer; world material and MRT contracts are unchanged. Low tier retains its existing practical streaks. Dry high-tier scenes skip the seven offscreen passes after one shader warmup behind the loading card.

A native car-colour ID render leaves all opaque depth intact and feeds the actual SSR ray march. It is compared against a separate exact geometric mirror mask; the mirror is an expected target, never the measured reflection. **WebGL2 IoU 33.98%, native WebGPU IoU 34.49%**, exceeding 30%; corresponding coverage is 37.48% / 38.02%. Both backends report zero errors.

Wet and dry floor pixels are independently proven by a GPU floor-ID and production-wetness mask. Wet mask=1, dry mask=0, and suppressing reflections produces a positive wet-pixel luminance delta. WebGL2 wet/dry ratios are **5.38× and 3.13×**; native WebGPU **5.36× and 3.13×**. Both exceed 2× without reclassifying partially wet neighbors as dry. [Numeric proof](evidence/ssr-repair.json).

Performance acceptance is reported separately in the final report. These functional measurements do not establish native frame or GPU budgets.
