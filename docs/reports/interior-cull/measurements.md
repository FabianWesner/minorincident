# Interior culling measurements

Seed 1, full L4/L5 levels, game follow camera at zoom 1.5, native Metal WebGL2. L5 has four survivors found (survivor-4 state); this reconstructs the state rather than replaying the exact reported tick 29048. PO courier position is (83.75, 38.84); street is (-13.7, -22.5). Before is a production build of starting commit `350ac1d1d712adc69f677200277bbdb7b54885a5`; after uses this change.

Draws and triangles include view, shadow and fullscreen passes. The probe waits for a fresh animation frame before each sample; raw counters and category totals are in [before.json](before.json) and [after.json](after.json).

| Level / pose | Tier | Draws before → after | Triangles before → after | Culling CPU mean / max ms |
| --- | --- | --- | --- | --- |
| L4 po | high | 125 → 124 | 465,927 → 278,035 | 0.0000 / 0.0 |
| L4 street | high | 213 → 212 | 389,610 → 349,442 | 0.0000 / 0.0 |
| L5 po | high | 140 → 139 | 492,155 → 304,263 | 0.0000 / 0.0 |
| L5 street | high | 205 → 202 | 312,003 → 271,595 | 0.0000 / 0.0 |
| L4 po | low | 103 → 102 | 169,257 → 148,205 | 0.0017 / 0.1 |
| L4 street | low | 186 → 185 | 241,278 → 228,838 | 0.0000 / 0.0 |
| L5 po | low | 115 → 114 | 179,461 → 158,409 | 0.0017 / 0.1 |
| L5 street | low | 177 → 176 | 225,701 → 213,141 | 0.0033 / 0.1 |

Every measured pose passes the unchanged E18 draw/triangle budgets (600 / 1.5 M high; 300 / 500 k low). All 480 final culling CPU samples are ≤ 0.1 ms at Chromium’s 0.1 ms timer resolution. The probe asserts these limits and zero console errors.

Packed GLB material primitives mix masonry and stock. Loading separates connected components wholly inside an inset footprint, preserves boundary geometry in the shell, and compacts referenced vertices. Standalone world props and dressing use oriented building footprints for ownership. Per-building changes compact interior instances before the same frame renders; unchanged player/reveal state skips the building scan.

Reproduce after a fresh build with a private `SCENE_PORT`: `SCENE_SERVER=preview sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/qa/interior-cull.ts`. The optional `INTERIOR_BASELINE=1` records an unmodified baseline build; `INTERIOR_AB=1` submits both culling states in the changed build.
