# r19-perf — batch 60 load and frame repair

**Status: closed at orchestrator instruction; the full goal is NOT met or certified.** Updated 2026-11-09T14:58:58+00:00. Frozen game source `49078834` (starting point `4f1e6728`). No deployment or push.

## Closeout result

The original frame regressions are repaired in the six remeasured gameplay cells. Cold loading improved substantially in the two remeasured cells, but remains slower than fresh PROD. The full goal requires the missing matrix and event windows; this report does not certify them.

| What improved | Batch 60 before | Final | Matched fresh PROD |
|---|---:|---:|---:|
| L4 low/high frame p95 | 33.30 / 33.40 ms | 16.70 / 16.70 ms | 16.80 / 16.80 ms |
| L9 low/high maximum frame | 100.00 / 83.40 ms | 33.40 / 50.00 ms | 33.40 / 50.00 ms |
| L10 low maximum frame | 66.60 ms | 33.40 ms | 33.40 ms |
| L10 low full-charge maximum frame | 66.70 ms | 33.40 ms | 33.40 ms |
| L8 low WebGPU load median | 3,741.35 ms | 3,224.95 ms | 3,208.05 ms |
| L10 low WebGPU load median | 4,060.50 ms | 3,442.85 ms | 3,301.00 ms |

Before and final were separate sessions; the fresh PROD columns provide the contemporaneous comparison. Neither transfer size nor content was reduced by deleting features; lossless baked assets add delivery bytes, and first-damage render sources now load on demand.

### What is still worse than PROD, and why

| Measurement | Final difference | Explanation and next action |
|---|---:|---|
| L8 low WebGPU load median | +16.90 ms / +0.53% | Passes the brief's +5% bound, but strict parity is not achieved. The final run has no CPU profile to attribute this remaining gap; do not assign it to a specific subsystem from older profiles. Profile a new paired run if strict parity is required. |
| L10 low WebGPU load median | +141.85 ms / +4.30% | Passes +5%, with only about 23 ms median headroom. Earlier profiles identified static conversion, geometry, navigation and placement costs; their repairs explain the improvement, but do not establish the cause of the entire final residual. Profile the final source before another targeted repair. |
| L10 low charge p95 | +0.10 ms (16.80 vs 16.70) | Passes the inherited +1 ms comparison tolerance; literal no-increase is not demonstrated. This is consistent with browser interval quantization; a causal performance regression is not established by that difference alone. |
| L4 high maximum frame | +0.10 ms (50.10 vs 50.00) | Passes the inherited one-frame maximum tolerance. Retained in full rather than rounded away or discarded. |
| Other cold/native cells | Unknown | The closeout stops collection before these were measured at the frozen source. Earlier failures remain unresolved verification work, especially the WebGL2 cold spikes. Lamp replay success does not qualify cold loads or the missing native matrix. |


## Build and method

PROD is the pinned batch 59 public release: all 2,758 mirror files were restored and rehashed against the r18 manifest. Its matching adapter comes from the read-only `2741447` source export; the dependency lock matches. Candidate public bundle is `index-CrPXP-rT.js`, SHA-256 `ab39ed860a2debf9804836047e279b997873beeaa0cbbb2ab2795e09755c7922`. Immutable snapshots are served identically on 4911/4912. Only native probes request `testApi=1`; cold requests receive the original public bytes.

All timing uses `tools/perf/quiet-run.sh`, exclusive browser admission and post-queue cooldown, headless Chromium with `--use-angle=metal`, native Apple Metal, fixed DPR 1. Browser disk/HTTP caches are fresh; OS/GPU driver caches remain shared. Cold viewport is 1600×900; native viewport is 1280×720. Each reservation retains a host scan every two seconds. An overlap invalidates the complete paired reservation and requires a new attempt; individual slow samples are retained.

Cold acceptance: 20 fresh browser profiles per side/configuration; median ≤ matched PROD × 1.05, every candidate load ≤ 6,000 ms, maximum post-card interval ≤ 200 ms. Each configuration includes ten seconds of physical movement, at least 100 gameplay frames and the first post-card frames in every sample. The source cold tool’s strict no-increase median assertion remains unchanged; the separate evaluator applies the brief’s explicit +5% criterion.

Native acceptance uses the established [r18 comparison rules](../r18-release/README.md#frame-comparison-rules): p95 ≤ PROD + 1 ms, maximum ≤ PROD + 16.8 ms, and no new ≥66 ms hitch when PROD is below 66 ms. Each L3–L10 tier gets at least 60 seconds (L10 90), ordinary bot input, courier survival protection, actual rendered-frame progress and nonzero geometry. Both versions use the inherited fixture settings: camera shake, cheap DOF and VFX are disabled; selected low/high geometry quality is retained. These are browser animation-frame intervals, not GPU timer queries. Full default-effects parity is outside this measurement. Explicit L7 pickup/rocket, full L10 charge and natural ending windows are evaluated separately.

## Causes and repairs

| Cause | Profile / before evidence | Repair | Evidence / commit |
|---|---|---|---|
| Full dynamic cover scan | r18 L4 simulation p95 19.2 ms; cover query 15.58 s sampled self time in a minute. | Include destruction/door walls in the existing 8 m broadphase; retain exact ray tests and invalidate door mutations. | `09c2c540`; 512-ray differential plus door replacements; diagnostic L4 p95/max 16.8/33.4 ms versus PROD 16.7/33.4. |
| Repeated local destruction partitions | Every duplicate placement recomputed identical parts/collider intersections. | Share immutable templates per asset/class; HP, fire and damage state remain per object. | `66bc53a7`; constructor diagnostic L9 48.65→7.65 ms and L10 20.63→3.44 ms; all geometry/state hashes equal. Stub physics isolates this constructor. |
| Eager destruction render sources | Every potential damaged source and wreck was awaited at initial load. | Request the source after first damage, with readiness/disposal ownership retained. | `170a1a7a`; first-damage source can arrive asynchronously; ordinary combat is included in final native probes; isolated first-damage visibility latency was not measured. |
| Missing monkey/lioness crowd bakes | r18 L8 infected-crowd preparation added 772 ms. | Deliver the existing pipeline’s healthy/infected bakes for all three LODs (12 files, 4.4 MiB). | `fd357e3e`; no animation/geometry reduction. |
| Zoo shader identity includes data | Joint-name strings and bind-row constants split otherwise identical zoo skin graphs. | Share graph features; bind each draw’s atlas, pose and inverse-bind row. | `2da4a316`, `deedd09e`, `be3acfca`; all pixels identical in seven-species healthy/infected low/high fixtures; no browser errors. |
| Seating nonpassenger zoo animals | Vehicle startup prepared seated monkey/lioness models although the escape roster excludes zoo animals. | Prewarm eligible human passengers. | `5f8b5caf`; actual registry-load contract checked. |
| First obstacle/destruction fragment shaders | L9 100 ms frame follows a new plain-box wood material build at 6.44 s. | Warm real box variants under the loading camera; select materials from actual destructible parts. | `e2f6d472`, `c176d5a4`; diagnostic L9 maximum 50 ms after repair. |
| Full-world ground point queries | L10 groundHeight 139 ms plus rescue reachability 302 ms sampled in startup. | Raster exact support/slab heights; avoid redundant flat diagonals while retaining directed drops/climbs. | `cac84c2d`; full L10 raster compared to point samples and directed random graphs compared to reference. |
| Per-cell navigation flood queue | L10 flood 106.5 ms sampled over 8.88M cells. | Traverse contiguous row spans with the same four-neighbour connectivity. | `f419ac77`; differential masks against ordinary BFS. |
| Repeated enclosure frames | L10 interior ownership 153.8 ms sampled, including 106.8 ms in footFrame. | Prepare building frames/prop corners once; reject distant centres before the original exact containment test. | `1ca93632`, `25dade18`; 100 buildings / 2,500 props: identical 258 owners, diagnostic 25.28→6.36 ms. |
| Route-array allocation in scenery assembly | L10 roadside 67.4 ms and vignette placement 51.1 ms sampled. | Scalar distance loops, reuse nearest distance; placement and RNG order unchanged. | `19435ac3`; full outputs byte-identical (279 roadside / 612 vignette placements); isolated 71.12→46.78 and 42.78→27.96 ms. |
| Farm placement overlap scans | Farm scenery repeatedly scanned the full multi-kilometre placement list for each tile. | Cull occupied 16 m X buckets before the original exact footprint predicate; keep RNG and placement order. | `49078834`; 261 generated placements byte-identical in five runs; isolated 21–23→1–3 ms. |
| Runtime static geometry conversion | L10 staticBatch 332.9 ms sampled after the first delivery pass. | Deliver lossless existing batch format for campaign/zoo asset frontier, including hero LOD. Preserve every existing key and the ≤2× source transfer check. | `817c2762`, `e8fbf6aa`; 132 + 154 additional entries (3.21 + 9.61 MiB); source GLBs and fallback remain. |
| Ground triangle iterators | L10 ground field assembly 105.7 ms sampled. | Transform three vertices directly, preserving arithmetic. | `06e88ab0`. |
| Epilogue raw scenery shaders | L10 first charge frame 66.6 ms; 68 late material builds from raw barn/building tableau meshes. | Batch/instance fixed tableau scenery and share equivalent RGB-preserving graphs; animated people retain their rigs. | `457b2962`; diagnostic L10 maximum 50 ms after repair; both natural endings pass with all eight tableaux and panorama. |
| Distant panorama startup pipelines | R1 initial loading compiled panorama-only landscape/forest/mist graphs. | Retain the geometry and incrementally prepare pipelines when the finale console region becomes resident. | `b9460efb`; both natural endings pass; ordinary full-route approach is not separately qualified. |

## Cold-load matrix

Qualified final cells: **2/20**. Values are median / p90 / maximum milliseconds. “Batch 60” is the unchanged game source measured in r18 (`c8d4a802`; no src/tools/public difference from `4f1e6728`).

| Configuration | r18 PROD | Batch 60 before | Fresh PROD | Final candidate | Δ median | Post-card max | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| L1 webgpu low | 1908.70 / 1942.60 / 1959.50 | 1994.35 / 2011.90 / 2059.70 | — | — | — | — | UNMEASURED |
| L1 webgpu high | 1867.70 / 1908.80 / 1912.10 | 1935.65 / 1959.20 / 1960.60 | — | — | — | — | UNMEASURED |
| L1 webgl2 low | 2159.70 / 2192.60 / 2259.00 | 2268.35 / 2324.40 / 8226.80 | — | — | — | — | UNMEASURED |
| L1 webgl2 high | 2126.95 / 2143.40 / 2876.10 | 2192.75 / 2342.20 / 3127.40 | — | — | — | — | UNMEASURED |
| L4 webgpu low | 3141.80 / 3174.00 / 3192.10 | 3366.25 / 3391.00 / 3956.10 | — | — | — | — | UNMEASURED |
| L4 webgpu high | 3574.65 / 3593.30 / 3640.80 | 3858.10 / 3906.50 / 3958.90 | — | — | — | — | UNMEASURED |
| L4 webgl2 low | 3342.05 / 3424.50 / 3641.30 | 3492.30 / 3525.80 / 6607.40 | — | — | — | — | UNMEASURED |
| L4 webgl2 high | 3784.40 / 3808.70 / 4141.30 | 3984.65 / 4292.00 / 5940.10 | — | — | — | — | UNMEASURED |
| L7 webgpu low | 2742.35 / 2791.60 / 2808.80 | 2824.80 / 2841.90 / 2842.10 | — | — | — | — | UNMEASURED |
| L7 webgpu high | 3315.00 / 3341.30 / 3342.20 | 3275.45 / 3325.90 / 3358.80 | — | — | — | — | UNMEASURED |
| L7 webgl2 low | 2991.40 / 3041.40 / 3107.20 | 3125.95 / 3159.10 / 10274.90 | — | — | — | — | UNMEASURED |
| L7 webgl2 high | 3542.30 / 3608.70 / 10257.00 | 3558.25 / 3675.60 / 7508.00 | — | — | — | — | UNMEASURED |
| L8 webgpu low | 3191.85 / 3209.00 / 6407.50 | 3741.35 / 3774.70 / 3776.30 | 3208.1 / 3324.8 / 4074.3 | 3225.0 / 3275.2 / 3308.2 | +0.53% | 33.4 | PASS |
| L8 webgpu high | 3341.40 / 3376.20 / 4374.80 | 4007.85 / 4041.80 / 4058.40 | — | — | — | — | UNMEASURED |
| L8 webgl2 low | 3091.80 / 3127.70 / 10358.20 | 3625.55 / 3659.20 / 11256.80 | — | — | — | — | UNMEASURED |
| L8 webgl2 high | 3292.25 / 3358.80 / 6674.80 | 3924.35 / 4041.90 / 7241.00 | — | — | — | — | UNMEASURED |
| L10 webgpu low | 3267.05 / 3292.30 / 3375.10 | 4060.50 / 4092.30 / 4124.90 | 3301.0 / 3325.7 / 3359.3 | 3442.9 / 3476.3 / 3507.9 | +4.30% | 33.4 | PASS |
| L10 webgpu high | 3008.75 / 3042.30 / 3075.80 | 3857.15 / 3875.00 / 3890.60 | — | — | — | — | UNMEASURED |
| L10 webgl2 low | 3535.85 / 3560.40 / 8509.10 | 4359.20 / 4410.00 / 9725.10 | — | — | — | — | UNMEASURED |
| L10 webgl2 high | 3233.95 / 3326.50 / 5425.30 | 4226.50 / 4276.70 / 6607.60 | — | — | — | — | UNMEASURED |

## Native frame matrix

Values are p95 / maximum milliseconds. r18’s diagnostic values above do not substitute for this frozen-source matrix.

| Cell | r18 PROD | Batch 60 before | Fresh PROD | Final candidate | Verdict |
|---|---:|---:|---:|---:|---|
| L3 low | 16.70 / 16.80 | 16.70 / 16.80 | — | — | UNMEASURED |
| L3 high | 16.70 / 16.80 | 16.70 / 33.40 | — | — | UNMEASURED |
| L4 low | 16.80 / 33.40 | 33.30 / 50.00 | 16.80 / 33.20 | 16.70 / 33.20 | PASS |
| L4 high | 16.80 / 33.40 | 33.40 / 66.60 | 16.80 / 50.00 | 16.70 / 50.10 | PASS |
| L5 low | 16.70 / 33.40 | 16.70 / 33.40 | — | — | UNMEASURED |
| L5 high | 16.70 / 33.40 | 16.80 / 33.30 | — | — | UNMEASURED |
| L6 low | 16.70 / 33.30 | 16.70 / 33.40 | — | — | UNMEASURED |
| L6 high | 16.80 / 49.90 | 16.70 / 33.40 | — | — | UNMEASURED |
| L7 low | 16.70 / 33.30 | 16.70 / 33.40 | — | — | UNMEASURED |
| L7 high | 16.70 / 50.00 | 16.70 / 33.30 | — | — | UNMEASURED |
| L8 low | 16.70 / 183.30 | 16.70 / 50.00 | — | — | UNMEASURED |
| L8 high | 16.70 / 133.40 | 16.80 / 50.00 | — | — | UNMEASURED |
| L9 low | 16.70 / 50.00 | 16.80 / 100.00 | 16.80 / 33.40 | 16.70 / 33.40 | PASS |
| L9 high | 16.80 / 50.10 | 16.70 / 83.40 | 16.80 / 50.00 | 16.70 / 50.00 | PASS |
| L10 low | 16.70 / 33.30 | 16.70 / 66.60 | 16.70 / 33.40 | 16.70 / 33.40 | PASS |
| L10 high | — | — | 16.70 / 50.00 | 16.70 / 33.30 | PASS |

### Event and ending windows

| Window | PROD p95 / max | Candidate p95 / max | Verdict |
|---|---:|---:|---|
| L7 pickup low | — | — | UNMEASURED |
| L7 pickup high | — | — | UNMEASURED |
| L7 rocket low | — | — | UNMEASURED |
| L7 rocket high | — | — | UNMEASURED |
| L7 combined low | — | — | UNMEASURED |
| L7 combined high | — | — | UNMEASURED |
| L10 charge low | 16.70 / 33.40 | 16.80 / 33.40 | PASS |
| L10 charge high | 16.70 / 50.00 | 16.70 / 33.30 | PASS |
| L10 ending low | 16.70 / 66.70 | 16.70 / 33.40 | PASS |
| L10 ending high | 16.70 / 133.30 | 16.70 / 50.00 | PASS |

### L10 lamp-boundary recorded input

Required: >100 native playable frames, actual backend, endpoint x >800, maximum post-card interval ≤200 ms. These are uncapped profiled diagnostics; they are excluded from the cold and native matched-frame distributions. The QA game source is frozen at `49078834`. The game API calls its WebGL2 backend `webgl`.

| Backend / entry | Frames | p95 / max ms | Endpoint x | Verdict |
|---|---:|---:|---:|---|
| webgpu / debug | 16922 | 6.30 / 51.00 | 842.51 | PASS |
| webgpu / continue | 16258 | 6.40 / 50.80 | 842.51 | PASS |
| webgl2 / debug | 12452 | 8.00 / 53.40 | 842.51 | PASS |
| webgl2 / continue | 11540 | 8.70 / 50.30 | 842.51 | PASS |


## Validation, attempts and remaining work

- `npm run verify -- E18`: PASS, typecheck + lint + 27 files / 107 unit cases. The retired per-AC gate delegates to the per-change gate.
- `git diff --check`: PASS after the frozen source commit.
- Public and QA builds: PASS. No new dependencies.
- Zoo skinning: healthy/infected lion, gorilla, elephant, zebra, flamingo, monkey and lioness fixtures are pixel-identical in low and high tiers, with no browser errors. Static-bake views in L8/L10 are also pixel-identical in both tiers, with no browser errors.
- The first clean 20-profile repair attempt (`b9460efb`) was retained as a FAIL: L8 3,408.55 vs 3,174.85 ms (+7.36%); L10 approximately 3,725 ms vs 3,292.45 ms. Later three-profile runs are diagnostic only. The next complete repair attempt (`e8fbf6aa`) was also retained: L8 PASS (+0.55%), L10 FAIL (+5.039%, 1.30 ms above the +5% limit). Final source `49078834` adds an exact farm overlap broadphase and is measured independently.
- One native L4/L9 reservation was invalidated in full when a root-workspace TypeScript check overlapped at 13:52:31–13:52:42 UTC. All four captures were repeated; the retry host receipt is clean.
- The previously unexecuted r18 ending harness initially timed out on PROD: its old bot starts route cursor 0 on the restored release save. The fixture now restores the cursor to the finale on both versions and records that provenance. Positions, physics, native inputs and natural clocks are retained. The failed attempt and its complete unpaired candidate diagnostic are retained.
- Closed coverage: 2/20 cold cells, 6/16 native cells, both charge windows, both natural endings, and all four lamp replays. All qualified measurements pass the stated comparison rules; missing cells remain UNMEASURED.
- Closeout: the orchestrator instructed this lane to finish its current capture, commit, document remaining regressions, and end within 20 minutes. The last capture finished at 14:54:47 UTC on 2026-11-09. No further captures were started. Remaining qualification and repairs belong to a follow-up lane.

## Reproduction

The retained harness runs the original public cold tool with 20 fresh browsers per side, then applies the brief’s +5% evaluator. Native uses each release’s matching adapter. Every attempted reservation retains raw samples and host receipts; slow samples are not removed. See the evidence and reproduction section below.

## Follow-up lane

Keep game source `49078834` as the starting point and preserve the pinned batch 59 baseline. Finish qualification before treating the performance goal as achieved:

1. **18 cold cells:** all four backend/tier combinations for L1, L4 and L7; high WebGPU and both WebGL2 tiers for L8 and L10. Use 20 fresh browsers per side, all samples retained, the 6,000 ms maximum, +5% median and 200 ms post-card criteria. Prioritize WebGL2: r18 reported maxima of 8,226.8 ms at L1 low and 11,256.8 ms at L8 low. These were not remeasured here. Browser profile freshness does not reset OS or driver caches.
2. **10 native cells:** L3, L5, L6, L7 and L8, both tiers. Capture at least 60 seconds of actual gameplay with rendered-frame, geometry, input and survival proof.
3. **L7 event coverage:** pickup, rocket impact and combined windows in both tiers. Six r18 windows do not qualify the changed source.
4. **Residual strict parity:** investigate the +0.53% / +4.30% cold medians and repeat the +0.10 ms low charge p95 if the brief's literal p95 wording is required. PASS in these tables uses the explicitly disclosed inherited frame tolerance, not a stronger assertion.
5. **Deferred-work risk:** measure a normal full-route L10 approach through panorama prewarming, and isolated first-damage source visibility latency. Both natural endings and all lamp-boundary replays are complete; they do not establish every preceding route's performance.

Do not reuse an invalid host reservation. The rejected L4/L9 attempt and WebGL2 lamp attempt retain the foreign TypeScript process evidence. Pool-owned Chrome is classified by ownership, not rejected as a foreign browser. The observer uses a three-second pool RPC timeout; the earlier one-second timeout and a continuation-fixture failure are retained as failed attempts.

## Evidence and reproduction details

- [Coverage verdict](coverage.json): the complete goal remains false, with each missing cell counted.
- [Evidence index](evidence-index.json): compressed raw measurements, host receipts, failed repair summaries, differential outputs and CPU profiles, with SHA-256 and original local paths. Every native frame, event, proof and scene sample is retained. Redundant complete input histories remain in the original local JSON; compact files include their count, digest and first/last records.
- [Source and build provenance](provenance.json), [public instrumentation](instrumentation.json), [lamp hardware probe](lamp-hardware.json), [validation receipt](validation.json).
- [Native evaluator output](final-native-evaluation.json), [main capture ledger](final-ledger.json), [ending/lamp ledger](deferred-ledger.json). The last main ledger row was reconciled from its completed child host receipt because the parent was stopped before its next job.
- [Reproduction harness](repro-harness.tar.gz): extract into `test-results/r19-perf/` in this repository. Absolute workspace imports are normalized to relative paths in the archive. Requires this repository, its locked dependencies, browser-pool tooling and the recorded browser/GPU environment; it is not a standalone application. The kit contains seed source references rather than large duplicate save files. CPU source maps and original full local histories are not included; the selected raw CPU profiles and mapped summaries are included.

Use `b21393dc` for the continuation fixture correction; its `src/` and `public/` trees equal frozen source `49078834`. The report commit adds evidence only. No dependencies were added. The baseline adapter is compiled from `2741447`, not from candidate game code.

From the repository root, after unpacking the kit:

```sh
mkdir -p test-results/r19-perf
tar -xzf docs/reports/r19-perf/repro-harness.tar.gz -C test-results/r19-perf
node test-results/r19-perf/restore-batch59.mjs
```

The restore fails if a remote file no longer matches the recorded SHA; in that case restore the archived batch 59 bytes matching `docs/reports/perf12/mirror.json`. It never silently substitutes a later deployment. Rebuild public bytes with the frozen build label (or restore the retained immutable local snapshot):

```sh
NODE_ENV=production BRANCH=release VITE_QA_HOOKS=0 node --input-type=module <<'JS'
import { build } from 'vite';
await build({ define: { __BUILD_COMMIT__: JSON.stringify('49078834') } });
JS
cp -R dist test-results/r19-perf/public-dist
cp -R dist test-results/r19-perf/public-dist-v12
node test-results/r19-perf/build-baseline-adapter.mjs
PERF_CANDIDATE_ROOT=test-results/r19-perf/public-dist-v12 node test-results/r19-perf/snapshot-serve.mjs
```

Verify the public main bundle SHA-256 against the provenance before accepting a repeat; a rebuild with different tooling need not produce identical bytes. The last command owns ports 4911/4912; run it in a separate terminal and stop it afterwards. The supplied candidate adapter bundle is retained in the kit; cold URLs never request it. For a fresh one-cell cold capture:

```sh
sh tools/perf/quiet-run.sh node --import tsx test-results/r19-perf/observe-job.mjs test-results/r19-perf/recheck-cold node --import tsx test-results/r19-perf/collect-cold.mjs test-results/r19-perf/recheck-cold L10/webgpu/low
node test-results/r19-perf/evaluate-cold.mjs test-results/r19-perf/recheck-cold
```

For a fresh paired L10 native capture (use a new output directory rather than resuming old rows):

```sh
RELEASE_QUALITY=high RELEASE_SECONDS=90 RELEASE_PERF_ONLY=1 RELEASE_CPU_PROFILE=0 RELEASE_OUT=test-results/r19-perf/recheck-native/native-high-L10-a0 sh tools/perf/quiet-run.sh node --import tsx test-results/r19-perf/observe-job.mjs test-results/r19-perf/recheck-native/native-high-L10-a0 node --import tsx test-results/r19-perf/native.mjs strips L10 webgpu
node test-results/r19-perf/evaluate-native.mjs test-results/r19-perf/recheck-native
```

Restore ending fixtures from each entry's Git `source` in the kit's `ending-seed-sources.json` to `test-results/r19-perf/ending-seeds/{side}-{tier}.json.gz`, verifying its SHA-256. Resolve candidate `HEAD:` references at `49078834`. `run-deferred.mjs` then describes both natural ending and four QA lamp reservations. Its QA snapshot must be built with `VITE_QA_HOOKS=1`; it is separate from the public cold snapshot. Delete qualified cache stamps only when intentionally starting an independent repeat; raw previous attempts must remain available.

The development servers and matrix runner owned by this lane were stopped at closeout. No push or deployment was performed.
