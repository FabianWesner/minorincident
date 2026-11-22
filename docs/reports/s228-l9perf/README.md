# s228 — L9 drive hitch

## Finding and change

`DistrictView.partition()` scans the district's LOD placements on camera updates. Before this change, every asset batch allocated a new `Map`, three new partition arrays, and a temporary three-element batch array for each scan. D-CROSSING covers a 1,200 × 800 m region, so this repeats across many placement groups while driving and creates steady garbage-collection pressure. The likely hitch contributor is this per-frame partition allocation churn; the change reuses three arrays per LOD batch and synchronizes them without allocating iterator callbacks or temporary batch arrays. Frustum tests, LOD selection, ordering, instance buffers, and quality remain unchanged. No infected, corpses, or visual targets were removed or reduced.

This is source-level attribution, not yet a measured A/B confirmation. The native frame trace below is the required check before treating it as the confirmed cause.

## Fixture and timing

Native headless WebGPU, HIGH, seed 1, 1600 × 900 at DPR 1, production `LevelNineBot` on the dry-shortcut detour, normal L9 campaign state, ticks 6,500–8,200. Run the before command with `src/render/DistrictView.ts` from parent revision `8ef2a340` and the after command with the committed version; keep the harness identical. The same fixture is used for both sides:

```sh
SCENE_PORT=5252 E2E_ADMISSION_TIMEOUT_SECONDS=1200 sh tools/perf/quiet-run.sh node --import tsx/esm tools/perf/s228-l9-drive.ts before
SCENE_PORT=5252 E2E_ADMISSION_TIMEOUT_SECONDS=1200 sh tools/perf/quiet-run.sh node --import tsx/esm tools/perf/s228-l9-drive.ts after
```

| State | Frames | Frame p95 | Frame p99 | Longest frame | >33.4 ms | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Before | pending | pending | pending | pending | pending | perf pending |
| After | pending | pending | pending | pending | pending | perf pending |

Perf is pending because this Mac was above the quiet-run load limit (load averages 5.07 / 3.74 / 3.77 on the first attempt; quiet-run requires <3) and the alternate lock-based preflight could not spawn its process scan (`EPERM`). The browser-pool startup also failed to bind its local service (`listen EPERM`), so no native frame sample was collected. Rerun both commands in a quiet window; raw traces and JSON summaries will be in `test-results/s228-l9perf/{before,after}/trace.json`.

## Gates

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `node --import tsx/esm tools/qa/l9-driving-proof.ts --route road --tier high --seed 1 --max-seconds 600 --out test-results/s228-l9perf/l9-skilled-high.json`: pass; L9 phase `done` at tick 11,401, 100 HP, peak 172 living infected, peak 25 resident chunks, zero collision failures.
- `npm run qa:threat`: pass; 0 fail flags, L9 skilled and passive complete.
- `sh tools/remote/run.sh "$PWD" -- npm test`: pass; 27 files, 105 passed, 1 skipped, 207.8 seconds within the 240-second budget.

## Open

Native before/after frame-time measurements are still required to confirm the allocation change reduces the reported L9 hitch on the same fixture. The PO may run the listed quiet-window commands; preserve their output here before closing this report.
