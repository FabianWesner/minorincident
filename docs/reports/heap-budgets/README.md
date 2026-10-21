# heap-budgets

Base: `93e1fbea8` on `lane/heap-budgets`. Scope: E25-AC14, E28-AC10, E29-AC19 and E29-AC20. Status: **partial**; no epic status file is changed. Latest production source: `74a33b34f`. Its native/pixel repeat, transition audit and five-load lifecycle audit are **unmeasured** after 30-minute admission timeouts; the measured first candidate below contains the geometry-cache fix and paw minimum optimization.

[Machine-readable evidence index](evidence/summary.json).

## Before / after acceptance table

Fresh baseline: **17/20 pass**. High/low values below use the unchanged acceptance fixtures. The first candidate also passes **17/20**; its three timing misses remain open. The current-source repeat hit the admission cap and is unmeasured. Historical raw figures from the sweep are not represented as comparable collected-heap baselines.

| AC / workload | Fresh baseline high / low | First candidate high / low | Literal gate |
| --- | --- | --- | --- |
| E25-AC14 light-lab heap | 139.26 / 129.62 MB | 138.91 / 129.64 MB | ≤400 / 250 MB |
| E25-AC14 night-street heap | 170.60 / 159.98 MB | 169.50 / 159.21 MB | ≤400 / 250 MB |
| E28-AC10 storm heap | 112.78 / 112.32 MB | 112.71 / 112.29 MB | ≤400 / 250 MB |
| E28-AC10 L5 ash heap | 112.87 / 93.77 MB | 112.67 / 93.47 MB | ≤400 / 250 MB; all authored peak counters |
| E29-AC19 district heap | 92.20 / 85.50 MB | 91.79 / 85.30 MB | ≤400 / 250 MB |
| E29-AC19 horde heap | 94.57 / 85.58 MB | 94.42 / 85.39 MB | ≤400 / 250 MB |
| E29-AC19 rocket heap | 67.95 / 58.44 MB | 67.83 / 58.32 MB | ≤400 / 250 MB |
| E29-AC19/20 district frame p95 | 11.7 / **33.7 ms** | 11.9 / **33.8 ms** | ≤16.7 / 33.3 ms |
| E29-AC19/20 horde frame p95 | 10.8 / **34.3 ms** | 10.9 / **33.8 ms** | ≤16.7 / 33.3 ms |
| E29-AC19 horde sim p95 | 2.0 / 4.6 ms | 2.1 / 4.6 ms | ≤4 / 6 ms |
| E29-AC20 rocket maximum | 17.3 / **52.8 ms** | 25.6 / **52.8 ms** | ≤50 ms |
| E29-AC20 five-load lifecycle | pass on both tiers/backends | pass, stock three-load check | heap/geometries/textures ≤110% of first load; settings retained |
| E29-AC20 checkpoint / boarding / L8 transition | **unmeasured: admission exit 75** | **unmeasured: admission exit 75** | ≤50 ms desktop |

[Baseline JSON and complete test receipt](evidence/perf-before). [First-candidate JSON and complete test receipt](evidence/final). L5 retains five followers, 18/12 infected, 13 fires and 37 corpses; ash particles are 1,750/525. Its maxima are 12.6/37.1 ms. Storm retains exactly 20,000/6,000 precipitation particles. L7 district retains 28 fires, seven blasts and 200/100 peak infected. The failures are low district p95, low horde p95 and low rocket maximum; all other assertions in this 20-case batch pass.

## Change and retainer evidence

The baseline already contains the earlier `perf-heap-w5` and renderer lifecycle fixes. Its collected-heap helper, thresholds, scenarios and acceptance tests are unchanged by this lane.

Fresh CDP heap snapshots found expanded infected geometry retained by the module-level `bakedCrowds` cache. The cache stores a full interleaved triangle-soup copy before `CrowdView` indexes and simplifies its separate scene copy. Light-lab's largest allocations include 5.57, 5.46 and 5.45 MB buffers rooted through this map. The map's asset/LOD/clip keys identify it independently of minified constructor names. The shortest path happens to enter the shared module context through the physics constructor; these are rendering cache allocations, not Rapier colliders.

`bakeInfected` now caches the sampled `CrowdClip` and small bind matrices. Expanded geometry is not cached. The matrices preserve the exact first bake’s bind transform after Euler clip sampling/restoration. Cache hits reuse the animation atlas and reconstruct the same geometry from the loaded source model during loading. The existing cache bound and eviction order are retained. No surface, LOD policy, actor population, particle count or persistent corpse is removed. Source geometry remains independently owned by the registry; scene geometries remain independent, including mutable appearance and index attributes.

Root paths and shallow allocation groups are in [light-lab-retainers.json](evidence/before/light-lab-retainers.json), [L7-retainers.json](evidence/before/L7-retainers.json), and [rocket-retainers.json](evidence/before/rocket-retainers.json). Root paths show reachability; they are not claimed as dominator retained sizes. The L7 snapshot also records large live district vertex buffers and pose palettes. No resource is called a leak solely because it is large.

Raw snapshots are local generated artifacts in `test-results/heap-budgets/snapshots-before/`; the extracted root paths and [archive hashes/sizes](evidence/before/snapshots.json) are committed. The baseline raw gzip archives total 152.90 MB and are excluded from Git.

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

[Full readings](evidence/lifecycle). This trace covers warmed, settled loaded resources before elapsed combat; post-combat five-load retention is unmeasured. The initial diagnostic attempt used an unsupported `L1-default` progression name and was discarded. The corrected run sets `L7-default` only on its first load and preserves the campaign/settings thereafter.

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

## Intermediate diagnostics and validation

The cache-only snapshot run in [after-cache](evidence/after-cache) removes **64.30/34.67 MB** of collected backing stores in WebGL light-lab, **34.92/34.79 MB** in storm, **35.62/35.01 MB** in L7 and **67.87/35.03 MB** in rocket. Scene buffer sizes and WebGL resource counts stay unchanged. One WebGPU L7 high comparison has different offscreen residency, so it is not used to quantify cache savings. Root-path summaries and archive hashes are retained for both snapshots.


| WebGL backing stores, MB | Before high / low | Cache-only high / low | Saved high / low |
| --- | ---: | ---: | ---: |
| light-lab | 603.92 / 534.48 | 539.62 / 499.81 | 64.30 / 34.67 |
| storm-street | 471.21 / 460.54 | 436.29 / 425.75 | 34.92 / 34.79 |
| L7 | 463.15 / 290.40 | 427.53 / 255.39 | 35.62 / 35.01 |
| rocket | 345.28 / 276.39 | 277.41 / 241.36 | 67.87 / 35.02 |

The first native CPU profiles are in [profile-before](evidence/profile-before) and [rocket-profile-paws](evidence/rocket-profile-paws). The low district profile identifies repeated corgi sole scans and crowd update work; the rocket profile includes loading, so loading costs are not attributed to its eight-second acceptance window. No profiler-instrumented timing is used as acceptance evidence.

`PawContacts` keeps each referenced vertex once and computes the exact Y component of the same matrix transform for minima. This removes duplicate triangle-index work, unused X/Z calculations and temporary mapped arrays. All points, contact decisions and paw trajectories remain. The first candidate still fails the same three timing gates, so this optimization alone does not close E29.

Final source refinements (native effects unmeasured) reuse appearance resolution only between `CrowdAccessories.begin()` and `finish()`, retain a set of loaded model keys instead of constructing LOD strings repeatedly, and copy flat frame/fixed-tick log records without structured serialization. Nested event payloads retain deep copies and every record is retained under the unchanged ring policy. No test, measurement helper or threshold is changed.

The first candidate/control comparison has **17/20 exactly identical RGB frames**, including all four corgi-contact backend/tier cases. Differences: WebGPU high light-lab 7 pixels (max channel error 2), WebGPU high rocket 5 (max 7), WebGL high rocket 3 (max 11). Original baseline versus repeat baseline independently differs in WebGL high rocket (9 pixels, max 11) and WebGPU low rocket (747, max 79). The latter reproduces the original low WebGPU rocket difference without a source change. All raw counts and error images remain in [exact pixel evidence](evidence/final/pixels) and [baseline controls](evidence/final/baseline-repeat-pixels); no mask/tolerance is applied. **Exact pixel equality is not established for every measured frame; the current-source pixel repeat was not admitted.**

Validation so far: typecheck, lint and production build pass. Full remote cache-only suite passes **2,145 tests / 390 files**, 11 tests / 3 files skipped. The focused paw/contact suite passes **16 tests / 5 files**. See [unit-cache.json](evidence/unit-cache.json) and [paw-units.json](evidence/paw-units.json). Full remote current-source unit/level run passes **2,147 tests / 390 files**, with the same 9 existing skips / 3 files as baseline, in 2,464.03 s: [complete command receipt](evidence/remote-final.log.txt). Its optional JSON transfer lost the idle SSH connection; the runner command itself exited 0 and its complete streamed result is retained. The cache-only runner’s two additional skips are the existing audio checks gated on ffmpeg/generated weapon audio availability; no skip was added by this lane. Full-epic `verify` commands have not run; the native batch selects the actual acceptance fixtures for these rows and does not certify other epic criteria.

## Final-source admission and cleanup

The native/capture repeat and checkpoint/boarding/L8 audit each exited **75** after the unchanged 30-minute admission limit, before measurement started. They are **unmeasured** on `74a33b34f`; the first candidate’s results above do not certify these later refinements. See [native admission receipt](evidence/admission/native-repeat2.json) and [transition admission receipt](evidence/admission/transitions-candidate.json). These rows are not requeued. The five-load candidate audit also exited 75 at its 30-minute admission limit: [receipt](evidence/admission/lifecycle-candidate.json).

The one temporary baseline build directory was removed after the native job ended. [Source, test and build hashes](evidence/builds.json) retain its identity. No baseline Git worktree was created. Raw heap snapshot archives remain local ignored diagnostic artifacts; extracted retainers, hashes, native readings, pixels and reports are committed. No merge, push, deployment, spec/status change or test/threshold/helper edit was made.

## Offline bake equality

[Twenty shipped asset/LOD cases](evidence/bake-equivalence.json) pass exact fresh-versus-cache-hit comparison on the final production source: all seven regular infected models plus Alpha, dog and crawler, each at LOD1/LOD2. Every geometry attribute’s byte hash/layout, complete clip-matrix hash, shirt colour, double-sided flag and stride scale matches; the cache hit reuses the same clip object. A third independently sampled fresh bake also matches. [Remote command receipt](evidence/bake-equivalence.log.txt).

This covers CPU bake buffers and metadata. Final backend-frame equality remains unmeasured after the browser admission timeout; this check is not substituted for the pixel matrix.
