# hitches2 — campaign first-use frames

Merged `lane/l6-tunnel` first (`a5cf96ccb`). The final native matrix passes all **12 timing cases** and all **12 pixel/population cases**. Every measured frame is below 100 ms; the largest final frame is 66.7 ms. No population, mission, corpse, LOD policy, or gameplay change is part of this lane.

Maximum animation-frame gap in milliseconds, **before → after**:

| Moment | WebGL low | WebGL high | WebGPU low | WebGPU high |
| --- | ---: | ---: | ---: | ---: |
| L8 start | 416.7 → **16.8** | 383.4 → **16.8** | 233.3 → **16.8** | 233.2 → **16.8** |
| L6 exit approach + exit | 1416.6 → **16.8** | 249.9 → **16.8** | 249.9 → **16.8** | 300.1 → **16.8** |
| L5 wrecked bus | 3349.9 → **16.8** | 583.3 → **66.7** | 4583.1 → **16.8** | 233.4 → **66.7** |

These are maxima across the entire real-clock input windows, not selected averages: 6 seconds for L8 and 9 seconds for L6/L5. L6 includes the 20 m exterior-fog boundary and the actual exit/preset/result transition. Its baseline maximum on low WebGL occurred on the approach; the actual exit also had >100 ms frames. The required headlamp fix is present in both baselines, and the fixture retains the headlamp inventory item.

## Cause and change

- **L8 start and L5 bus:** changing between the sun and the promoted spot changes Three's light cache key. At L8 tick 60 and the authored bus flashlight pool, 83–93 world, character, prop and shadow node builds occurred in play. The initial WebGL CPU profile spent about 2.5 seconds in program-status waits, with much less GC time. Warming two lists alone is insufficient because Three retires the previous render objects/program states. The affected night presets now keep both light entries resident. The inactive source has zero illumination and shadow weight and stops updating its map. Only the selected source contributes; diagnostics count active shadow updates. Weather preserves the inactive sun's zero intensity.
- **L6 approach:** `WeatherSystem` selects exterior fog by player position, outside L6's `none` timeline. The load graph had weather mode **104**, while approach changed it to **105** (the cloud bit), rebuilding 35 visible material graphs and leaving further exit geometry/gates cold. The shader-key trace shows changed material keys with identical light/context keys. The loading union now includes this exterior fog/cloud branch. The exterior reflection environment is also cached during loading. All four final L6 cases have **zero** node builds during the approach and exit.
- **Bus residual:** after fixing the light list, the nearby medkit's close-detail rigid batch still first built during approach and caused one cold WebGPU frame of 266.7 ms. L5 now warms its actual cached medkit detail prototypes, with temporary visual copies covering pixels during loading. No simulated pickup or other entity is added. The final low-tier bus cases have **zero** node builds; the high-tier cases have two later small prop builds and remain below 100 ms.

## Measurement and visual evidence

`tests/e2e/levels/campaign-hitches.spec.ts` uses a production build, seed 1, a 1600×900 viewport, DPR 1 and player zoom 1.5. It sets saved campaign quality before `view.load()` so the briefing cannot silently override the requested tier. Focused setup positions the player/cohort, then movement uses physical WASD with the real clock. L8 movement is asserted, L6 must reach its exit, and L5 must enter the real flashlight footprint centred near (-46.48, 39.97). No bot or injected logical input drives the measured windows. Backend and tier are asserted. `loadProfile=2`, renderer profile hooks, frame costs, node counts and optional CDP CPU profiles provide attribution.

The separate fixed-tick pass uses the same physical keys for 360 ticks, then compares frames. The image threshold is pixelmatch 0.1 with at most **0.001%** raster-edge variation. Observed differences are **0–4 of 1,440,000 pixels** (maximum 0.000278%). Seven pairs have zero differences at that perceptual threshold; they are not byte-identical. The 0–4 above-threshold differences are on fine actor/prop edges. Below-threshold RGB differences are also present, particularly in L8 shading; raw differing-pixel counts, channel deltas and RMSE are included in every `pixel-compare.json` and in `summary.json`. The largest whole-image raw channel RMSE is **0.459 on the 0–255 scale**. The full frames retain the same scene, pools, shadows, outfit and silhouettes. I opened the L5 bus, L6 exit, and both L8 WebGPU-low frames for visual review. The L6 capture includes the normal result overlay.

Every fixed-tick entity ID/archetype/health/corpse-field census matches. The raw state comparison additionally confirms that all **37 authored L5 finished bodies** retain their IDs, models, finished state and exact transforms in all four backend/tier cases. The comparison is saved beside each case as `corpse-compare.json`. Corpse rendering/persistence and simulation code were not changed.

| Case | Node builds before → after | Changed pixels | Frames |
| --- | ---: | ---: | --- |
| webgl-low-L8 | 89 → 0 | 0/1,440,000 | [before](evidence/before/webgl-low-L8/fixed-tick.png) · [after](evidence/after/webgl-low-L8/fixed-tick.png) · [diff](evidence/after/webgl-low-L8/diff.png) |
| webgl-low-L6 | 45 → 0 | 0/1,440,000 | [before](evidence/before/webgl-low-L6/fixed-tick.png) · [after](evidence/after/webgl-low-L6/fixed-tick.png) · [diff](evidence/after/webgl-low-L6/diff.png) |
| webgl-low-L5 | 90 → 0 | 2/1,440,000 | [before](evidence/before/webgl-low-L5/fixed-tick.png) · [after](evidence/after/webgl-low-L5/fixed-tick.png) · [diff](evidence/after/webgl-low-L5/diff.png) |
| webgl-high-L8 | 93 → 0 | 0/1,440,000 | [before](evidence/before/webgl-high-L8/fixed-tick.png) · [after](evidence/after/webgl-high-L8/fixed-tick.png) · [diff](evidence/after/webgl-high-L8/diff.png) |
| webgl-high-L6 | 55 → 0 | 0/1,440,000 | [before](evidence/before/webgl-high-L6/fixed-tick.png) · [after](evidence/after/webgl-high-L6/fixed-tick.png) · [diff](evidence/after/webgl-high-L6/diff.png) |
| webgl-high-L5 | 92 → 2 | 2/1,440,000 | [before](evidence/before/webgl-high-L5/fixed-tick.png) · [after](evidence/after/webgl-high-L5/fixed-tick.png) · [diff](evidence/after/webgl-high-L5/diff.png) |
| webgpu-low-L8 | 89 → 0 | 4/1,440,000 | [before](evidence/before/webgpu-low-L8/fixed-tick.png) · [after](evidence/after/webgpu-low-L8/fixed-tick.png) · [diff](evidence/after/webgpu-low-L8/diff.png) |
| webgpu-low-L6 | 49 → 0 | 0/1,440,000 | [before](evidence/before/webgpu-low-L6/fixed-tick.png) · [after](evidence/after/webgpu-low-L6/fixed-tick.png) · [diff](evidence/after/webgpu-low-L6/diff.png) |
| webgpu-low-L5 | 90 → 0 | 3/1,440,000 | [before](evidence/before/webgpu-low-L5/fixed-tick.png) · [after](evidence/after/webgpu-low-L5/fixed-tick.png) · [diff](evidence/after/webgpu-low-L5/diff.png) |
| webgpu-high-L8 | 93 → 0 | 0/1,440,000 | [before](evidence/before/webgpu-high-L8/fixed-tick.png) · [after](evidence/after/webgpu-high-L8/fixed-tick.png) · [diff](evidence/after/webgpu-high-L8/diff.png) |
| webgpu-high-L6 | 59 → 0 | 0/1,440,000 | [before](evidence/before/webgpu-high-L6/fixed-tick.png) · [after](evidence/after/webgpu-high-L6/fixed-tick.png) · [diff](evidence/after/webgpu-high-L6/diff.png) |
| webgpu-high-L5 | 92 → 2 | 3/1,440,000 | [before](evidence/before/webgpu-high-L5/fixed-tick.png) · [after](evidence/after/webgpu-high-L5/fixed-tick.png) · [diff](evidence/after/webgpu-high-L5/diff.png) |

Raw frame/state records and population censuses are stored as gzip JSON under `evidence/before/` and `evidence/after/`; `summary.json` contains all measurements and load timings. The `diagnostic-intermediate/` shader-key trace establishes the L6 weather-mode change and preserves the unsuccessful intermediate timing pass. `diagnostic-initial/provenance.txt` identifies the earlier fixture/quality limitations; those traces are diagnostic only and do not supply the table above.

## Commands and validation

Native runs were headless on macOS Metal, one worker/browser, `E2E_PORT=3921`, `SCENE_PORT=3922`, through `tools/perf/quiet-run.sh` and `sh tools/e2e-lock.sh`. Each reservation finished below 20 minutes. The final batch was admitted within the cumulative 30-minute queue/preflight allowance; no further native reservation was requested. `conditions.jsonl` records admission conditions. The absent `tools/playtest` directory was replaced by the focused spec permitted by the task.

```sh
E2E_PORT=3921 SCENE_PORT=3922 HITCH_PHASE=before sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh \
  node_modules/.bin/playwright test tests/e2e/levels/campaign-hitches.spec.ts --project=chromium --workers=1
# Rebuild the patched production bundle, then repeat with HITCH_PHASE=after.
# For the matched fixed-tick image/population pass, also set HITCH_VISUAL=1.
```

- Final production build: passed.
- Final native timing: **12/12 passed**, zero frames >100 ms.
- Final image/population comparisons: **12/12 passed**.
- Typecheck/lint and focused lighting/weather regression tests: passed (11 tests).
- Final typecheck/lint: passed. Final full unit suite: **1,756 passed, 7 skipped** (321 passing files, one skipped file).
- `npm run verify -- E18`: **failed in the sim-only phase: 377 passed, 12 failed, 2,969 skipped**. Typecheck, lint and build passed again. The failures are CPU wall-time budgets in unchanged simulation code (200-entity horde/Alpha/Mega/zoo/crossing cases plus the L1 perception timing comparison). The browser stages were not reached. This is not a green full-E18 gate; the native hitch matrix above passed independently. Exact failures and assertion values are in [verify-summary.json](verify-summary.json).

Heavy checks run through `tools/remote/run.sh` with at most four Vitest workers. No deployment, push or merge into main was performed. This report closes the three hitch moments; it does not claim full epic or full-campaign playthrough closure.
