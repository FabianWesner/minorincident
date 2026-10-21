# heap-budgets

Base: `93e1fbea8` on `lane/heap-budgets`. Scope: E25-AC14, E28-AC10, E29-AC19 and E29-AC20. Verification is in progress; no epic status file is changed.

## Change and retainer evidence

The baseline already contains the earlier `perf-heap-w5` and renderer lifecycle fixes. Its collected-heap helper, thresholds, scenarios and acceptance tests are unchanged by this lane.

Fresh CDP heap snapshots found expanded infected geometry retained by the module-level `bakedCrowds` cache. The cache stores a full interleaved triangle-soup copy before `CrowdView` indexes and simplifies its separate scene copy. Light-lab's largest allocations include 5.57, 5.46 and 5.45 MB buffers rooted through this map. The map's asset/LOD/clip keys identify it independently of minified constructor names. The shortest path happens to enter the shared module context through the physics constructor; these are rendering cache allocations, not Rapier colliders.

`bakeInfected` now caches the sampled `CrowdClip` only. Cache hits reuse the animation atlas and reconstruct the same geometry from the loaded source model during loading. The existing cache bound and eviction order are retained. No surface, LOD policy, actor population, particle count or persistent corpse is removed. Source geometry remains independently owned by the registry; scene geometries remain independent, including mutable appearance and index attributes.

Root paths and shallow allocation groups are in [light-lab-retainers.json](evidence/before/light-lab-retainers.json), [L7-retainers.json](evidence/before/L7-retainers.json), and [rocket-retainers.json](evidence/before/rocket-retainers.json). Root paths show reachability; they are not claimed as dominator retained sizes. The L7 snapshot also records large live district vertex buffers and pose palettes. No resource is called a leak solely because it is large.

## Measurement contract

The existing acceptance tests collect completed-frame temporaries using `tests/perf/collected-heap.ts` and gate CDP `Runtime.getHeapUsage.usedSize` in decimal MB against 400/250. This lane changes neither the helper nor any test. Evidence also retains `backingStorageSize`, `embedderHeapUsedSize`, and the legacy `performance.memory` counter. These counters must not be substituted for each other.

For example, baseline light-lab high has 137.18 MB collected `usedSize`, 603.92 MB backing stores and 741.38 MB legacy `performance.memory`. Storm high has 124.14/471.21/595.60 MB respectively. These paused snapshot diagnostics use a fixed 960×600 viewport and are not the acceptance timing fixtures. A passing JS-heap gate does not establish a 400/250 MB process/GPU/combined-allocation budget.

All browsers are headless and serial, with ANGLE Metal, private ports 3931/3932, `quiet-run.sh` followed by `e2e-lock.sh`, 20-minute reservations and a 30-minute admission limit. Acceptance phone tests retain their existing 4× CPU throttle, viewport and DPR. Fixed-frame pixel diagnostics use the same seeded scenario, simulation tick and camera on each build.

## Lifecycle baseline

Five settled loads, `L7→L1→L7→L1→L7`, begin each mission, retire render lists with six `screenshotReady()` calls, and collect before reading heap and GPU counts. Settings are written once on the first load and checked after every load. This extends the stock three-load L7 check without modifying it.

| Backend / tier | First → fifth JS heap MB | Heap growth | Geometry count | Texture count |
| --- | ---: | ---: | ---: | ---: |
| WebGL high | 79.42 → 75.81 | −4.55% | 397 → 388 | 64 → 65 |
| WebGL low | 75.42 → 71.59 | −5.07% | 396 → 387 | 59 → 60 |
| WebGPU high | 77.26 → 73.79 | −4.48% | 397 → 388 | 63 → 64 |
| WebGPU low | 74.62 → 71.17 | −4.62% | 396 → 387 | 58 → 59 |

[Full readings](evidence/lifecycle). The initial diagnostic attempt used an unsupported `L1-default` progression name and was discarded. The corrected run sets `L7-default` only on its first load and preserves the campaign/settings thereafter.

## Reproduction

Build only when this worktree has no active preview capture. Run each browser command in a separate bounded reservation; do not start them together.

```sh
npm run build
E2E_PORT=3931 SCENE_PORT=3932 HEAP_AUDIT_OUT=test-results/heap-audit HEAP_AUDIT_SNAPSHOT=1 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/perf/heap-audit.ts
E2E_PORT=3931 SCENE_PORT=3932 HEAP_AUDIT_OUT=test-results/heap-lifecycle HEAP_AUDIT_LIFECYCLE=1 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/perf/heap-audit.ts
E2E_PORT=3931 SCENE_PORT=3932 SCENE_SERVER=preview sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx tsx tools/perf/l7-transition-audit.ts
E2E_PORT=3931 SCENE_PORT=3932 sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh npx playwright test tests/perf/e25-light-lab.spec.ts tests/perf/e25-lighting.spec.ts tests/perf/weather.spec.ts tests/perf/l7-encounters.spec.ts tests/perf/l7-district.spec.ts tests/perf/l7-rocket.spec.ts tests/perf/l7-lifecycle.spec.ts tests/perf/l5-budgets.spec.ts --project=chromium --workers=1
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/levels --maxWorkers=4
```

Analyze a raw snapshot with `npx tsx tools/perf/heap-retainers.ts snapshot.heapsnapshot output.json`. Compare frames with `npx tsx tools/perf/heap-pixel-diff.ts before after diff`; every changed RGB pixel is counted, without alignment, masks, resizing or tolerance.
