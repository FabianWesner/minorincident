# E18 · Performance, Quality Tiers and Mobile

## Goal
Keep the game smooth with large hordes on desktop and playable on mid-range phones. It defines quality tiers, budgets, measurement, and adaptive auto-quality.

## Depends on / Enables
E02, E07 / M4 ship.

## Budgets

| Metric | Desktop high | Low / mobile |
| --- | --- | --- |
| Target frame rate | 60 fps | 30 fps (60 when possible) |
| Concurrent infected cap | 200 | 100 |
| Draw calls (worst level scene) | ≤ 600 | ≤ 300 |
| Triangles in view | ≤ 1.5 M | ≤ 500 k |
| Sim time p95 (200 / 100 infected) | ≤ 4 ms | ≤ 6 ms |
| JS heap after the L6 load | ≤ 400 MB | ≤ 250 MB |
| Initial download (gzip, before L1 starts) | ≤ 15 MB | ≤ 15 MB |
| Pixel ratio cap | 2 | 1.5 |
| Shadows | 2048 map | 1024 or blob shadows |
| Post FX | bloom 5 mips + DOF optional | bloom 2 mips, no DOF |
| Grass | full | sparse or off |
| Rain / snow / ash particles | 20k | 6k |
| Audio voices / reverb | 32, HRTF, 2 convolvers | 16, equal-power, 1 short convolver |
| Hero lights (shadowed) | 8 (3) | 3 (1) |
| Light field | 1024² / 80 m | 512² / 60 m |
| Awake physics props | 150 | 60 |
| Debris / gibs | 120 / 80 | 40 / 30 |
| Smoke particles / column puffs | 6k / 400 | 2k / 120 |
| SSR, GTAO, god rays, planar water | on | off |

## Scope
**In:**
- `Quality` service: explicit setting + `auto`, which picks the starting tier from a heuristic and then adapts if the frame time p90 is over budget for 5 s (it degrades in steps, never during a cinematic).
- LOD for crowds (E07) and props, the culling distances, the low-tier GLBs (`<id>.low.glb`), and texture/geometry disposal.
- `perf()` counters and a `?perf` overlay.
- Perf scenarios: `perf-horde-200`, `perf-l6-mainstreet`, `perf-l5-bridge`.
- Mobile specifics: touch, orientation, safe areas, `visibilitychange` pause, WebGL context-loss recovery.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Quality.js`](../folio-2025/sources/Game/Quality.js): tiers (port + adaptive)
- [`Monitoring.js`](../folio-2025/sources/Game/Monitoring.js): perf overlay
- [`PreRenderer.js`](../folio-2025/sources/Game/PreRenderer.js): shader warm-up
- [`Viewport.js`](../folio-2025/sources/Game/Viewport.js): pixel-ratio cap
- [`Rendering.js`](../folio-2025/sources/Game/Rendering.js): quality-dependent bloom mips

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E18-AC01 | Deterministic counters: in each perf scenario at fixed camera spots, draw calls and triangles stay within the tier budgets (measured in headless Chromium, which is deterministic for these counters) | perf |
| E18-AC02 | Sim p95 within budget in the Node sim-runner for `perf-horde-200` (high cap) and `perf-horde-100` (low cap) | perf |
| E18-AC03 | Production build: initial download ≤ 15 MB gzip (measured from Playwright network events until `level.started`) | perf |
| E18-AC04 | Auto quality: with an artificial GPU slowdown (`__SS__.debug.simulateFrameCost(30)`), the tier drops from high to low within 6 s and recovers after the load is removed only on the next level start | e2e |
| E18-AC05 | Memory: 5 consecutive level loads (L1→L6→L1…) end with the heap and `renderer.info.memory` within 10% of the first load (no leaks) | e2e/perf |
| E18-AC06 | Context loss: `WEBGL_lose_context` → restore → the game continues rendering within 3 s without a reload, and the sim keeps running paused | e2e |
| E18-AC07 | Mobile emulation (Pixel 7, iPhone 14 profiles): L1 boot to gameplay with touch, no layout overflow, and the low tier selected by auto | e2e |
| E18-AC08 | **Real-device check (manual, recorded):** fps logs from one iOS and one Android mid-range device on `perf-l6-mainstreet` ≥ 30 fps p50, stored in `test-results/perf/devices/*.json` | manual |
| E18-AC09 | Frame-time measurement on the desktop reference machine (headed Chrome with a GPU): `perf-horde-200` p95 frame ≤ 16.7 ms at the high tier (runs locally; not in CI) | perf (local) |
