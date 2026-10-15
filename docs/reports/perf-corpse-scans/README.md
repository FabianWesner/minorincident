# Corpse searches — 2026-10-15

Implemented; native performance targets remain unverified. Every corpse remains retained for the level. No population/time cap, geometry simplification, camera, weather, pose palette or locomotion changes were made.

Placement reuses `SpatialHash` and a reusable neighbor buffer rather than copying/scanning the whole corpse map for each candidate. The 1.25 m predicate, support/strip checks, candidate order and visibility checks are unchanged. CrowdView caches the figures that still need animated processing, refreshing on entity/frozen membership revisions; checkpoint rebuilds and hidden/deleted records invalidate that list. Static pages keep identity object transforms, and thrown-body updates share the lifecycle pass.

Validation: production build, typecheck, lint and 12 focused tests passed; the strengthened placement test also passed again (2 tests). Dense-pile positions match the former full scan for 600 bodies, moved IDs, negative cells and support edges. A 2,000-body regression checks that production placement does not iterate the corpse map. Frozen revisions and thrown-body matrix updates have direct coverage.

Scene Lab: `tests/scenes/catalog/corpse-placement-pile.json`; all 12 cells passed (both actual backends, both tiers, zoom 0.5/1/1.5). All cells retained 30 grounded bodies, zero undrawn frames and zero console errors; 40 draws and 65,823 triangles maximum, within the low E18 geometry/submission limits. This establishes fixture counters, not native frame/simulation timing or whole-level E18 certification. See [evidence.json](evidence.json).

I opened all eight requested game-camera sheets below. The settled pile, colored clothing and headwear match across backends/tiers. Bodies remain present and grounded from frames 60–180. The close zoom crops the edge of the deliberately dense pile; overlapping bodies remain visible. No new disappearing bodies or settled-frame popping was visible. This is a visual review plus exact placement regression, not a pixel baseline comparison against the audit build.

| Backend | High, zoom 1 | High, zoom 0.5 | Low, zoom 1 | Low, zoom 0.5 |
| --- | --- | --- | --- | --- |
| WebGL2 | [sheet](webgl-high-z1.jpg) | [sheet](webgl-high-z0.5.jpg) | [sheet](webgl-low-z1.jpg) | [sheet](webgl-low-z0.5.jpg) |
| WebGPU | [sheet](webgpu-high-z1.jpg) | [sheet](webgpu-high-z0.5.jpg) | [sheet](webgpu-low-z1.jpg) | [sheet](webgpu-low-z0.5.jpg) |

Unmeasured: 2,000-body p95 ≤20 ms, L2 collapse/L4 war phone p95 ≤33.33 ms, native E18 timing, full unit/sim/levels and complete E18 verification. Quiet timing never received admission; the first reservation was canceled at 20 minutes, released, and a later attempt was released to allow the remaining visual QA. The aggregate 30-minute browser deadline was reached without native timing admission. Hetzner accepted the full validation job but it remained queued and was canceled at report close; a separate pool-selection attempt failed with SSL EOF. No test/budget was weakened. No deploy or merge.

The new probe `tools/perf/corpse-scans.ts` records strict p95/E18 gates (including invalid/missing timing rejection). It uses headless native Chrome/Metal, Pixel 7 412×839, DPR 2.625, render DPR 1.5, low tier, seed 2 and 4× CPU throttle; 3 s warmup + 10 s corpse / 20 s level samples. The original memory-audit probe was deleted from `/tmp`, so this is a documented reconstruction, not an exact A/B. Corpses are generated in permanent waves of 100 on a 25×25 repeated grid at 1.5 m spacing. Level setup uses the audit's reported ticks (L2 5,190, L4 7,020) through the complete bot; saved state must confirm collapse / tank-and-helicopter war before interpreting timings.

After a fresh build, run each batch separately and release the reservation between them (at most 20 minutes; stop after 30 minutes of slot waiting):

```sh
SCENE_SERVER=preview SCENE_PORT=35861 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/perf/corpse-scans.ts
SCENE_SERVER=preview SCENE_PORT=35861 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/perf/corpse-scans.ts --phone-levels
sh tools/remote/run.sh "$PWD" -- sh -c 'npm run typecheck && npm run lint && npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4'
```
