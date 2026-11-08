# L9 long dark drive

Base: `0ad5a72b` · 2026-11-08 · complete; scoped checks and measurements recorded

[Recorded evidence](evidence.json) · [Comparison sheet](../../../test-results/r10-l9/before-after.jpg)

## Changes

The ordinary objective-bearing drive crosses the open z=0 sightline between the three decorated routes. Existing flare, wreck, and verge-fire lines belong to those routes, so the direct crossing missed much of their content.

- `f780b141`: warm flare guidance every 17 m and small alternating brush fires every 68 m along the open crossing. Reuses the existing instanced emitters, light field, flame/smoke pools, and assets. Adds no solid props or colliders.
- `0cfe25ab`: quiet-interval patrols use two staggered rows of three runners and an eight-second minimum interval. Existing population caps, whole-silhouette offscreen admission, minimum distance, navigation clearance, chunk residency, persistent identities, and avoidable ramming remain in charge.
- QA tooling records projected content, actual ram contacts/knockdowns/permanent kills, and frame/render counters through the existing real keyboard/mouse driver. Screenshot pauses explicitly separate frame intervals; captures default to 45-second spacing.

Only `src/render/NightAccents.ts` and `src/sim/missions/LevelNineEncounters.ts` change runtime behavior. Route geometry, vehicle tuning, recovery rules, bridge/crash/crawl, and other levels are unchanged. There are no new assets, dependencies, or material/shader paths.

## Matched content results

All eight runs finish L9 and hand over to L10. Each cell uses real keyboard/mouse input, the female L9 progressed preset, headless native Metal WebGL2, 1280×720, and identical physical steering waypoints. Courier god mode is enabled; APC durability and ramming are live. The logged map assist bends around existing field bushes, adding 2.8 m to the 1,020 m objective-bearing comparison path. It does not write positions or skip objectives.

Values below are **before → after**:

| Quality / zoom | Drive seconds | Empty seconds | Longest empty stretch | Ram knockdowns | Visible encounter bouts |
| --- | ---: | ---: | ---: | ---: | ---: |
| Low / 1 | 95.7 → 86.4 | 54.9 → 7.9 | 10.3 → 3.4 | 15 → 40 | 9 → 11 |
| Low / 1.5 | 86.6 → 113.9 | 31.4 → 3.2 | 6.1 → 1.7 | 16 → 37 | 11 → 14 |
| High / 1 | 85.7 → 89.5 | 51.2 → 11.0 | 9.9 → 5.1 | 14 → 42 | 10 → 13 |
| High / 1.5 | 87.5 → 86.8 | 29.2 → 0.9 | 6.0 → 0.9 | 13 → 39 | 13 → 14 |

A separate exclusive low/1 pair has **84.40 → 84.53 seconds of driving**, **49.05 → 4.50 empty seconds**, and **14 → 44 ram knockdowns**. It completes the unchanged crash/crawl and L10 handover. The table measures the approach objective; the scripted finale is additional. The clean low/1.5 completion takes 102 wall seconds including entry and handover.

HUD kills and permanent vehicle kills remain **zero in both builds**. Rams knock infected down under the existing recovery rules; the mission HUD credits courier-source kills. The change supplies more visible/reactive ram encounters without changing those semantics.

The longer low/1.5 run stays in the table. Its trace spends extra time turning near x=373–375 m, z=9–12 m; the opened 91-second capture shows the APC facing away from the objective. An unchanged small bush is nearby at (371.39, 12.92), but the capture alone does not establish a collision with it. High/1 also wanders off the common line near the existing pickup. These are physical driver runs, not fixed-speed replays; route length and speed tuning are unchanged.

### Measurement contract

The observer samples every 0.5 seconds while the drive objective is active. “Empty” means no submitted on-screen living infected, non-stud practical, fire, or vehicle/building/kit landmark projected into the central frame. The APC, minimap dots, headlights, insects, bare terrain, and downed bodies do not count. Practical/landmark projections also require visibility and a 35 m distance cap. This is a sampled geometric estimate checked against opened captures, not pixel classification. An encounter bout begins when at least one living infected becomes visible after none were visible; it need not be a distinct group.

Per-run summaries, served-bundle identities and the common route are retained in `evidence.json`.

## Opened visual evidence

[Single comparison sheet](../../../test-results/r10-l9/before-after.jpg), 274 KB. Every source capture used in it was opened, and the assembled sheet was opened again.

- Initial low/1, about 30 and 40 seconds: baseline central frames contain the APC, headlights, insects, and bare terrain. Afterward a flare casts a warm pool; the later frame shows the ram aftermath, another flare, and a brush fire.
- Matched low/1 at 45 seconds: a warm flare/pool is visible on the left, with blood impacts and 770/1000 armor. Matched high/1 shows warm points on both verges; the baseline high/1 frame has bare central ground and only a faint warm glow at the top edge.
- Matched low/1.5 at 45–46 seconds: the baseline already shows infected, a verge fire, and a water tower at the edge. The changed frame adds closer flares around a visible pursuer; armor is 700/1000. Wider views already included some decorated-lane content.
- Matched high/1.5 at 45 seconds: both builds show an existing encounter. The changed frame has a larger ram aftermath and blood trail, a flare close behind the APC, and the existing verge fire/pursuer farther away; armor is 710/1000 versus 890/1000 before.
- The low/1.5 recovery frame at 91 seconds shows nearby infected, flares and two fires while the APC turns away from the objective. Dark terrain remains between the light pools.

Detailed capture descriptions, exploratory summaries and exclusions are retained in `evidence.json`.

## Checks and performance

| Check | Result |
| --- | --- |
| Typecheck / full lint | Pass; final heap/CPU tooling also typechecks and lints |
| Unit suite / E31 verification | 107 tests in 27 files pass; registry stays at 150/150; `npm run verify -- E31` exits 0 |
| L9 native acceptance (`--skip-browser`) | Low/high completion, stationary, fixture and checkpoint runs complete; zero current failing rows; eight current incomplete rows remain as on the base |
| Scoped L9 threat audit | Both policies complete, zero L9 passive flags; overall exit 1 is `PARTIAL_LEVEL_SELECTION`, so this is scoped evidence |
| Full threat sweep | Exceeded the 600-second cap under concurrent host load; not a pass |
| Scene gate | All 50 selected assertions pass across 46 saved rows and a four-row shard rerun; no runtime or scene-input change between them |
| Cold load ≤6 s | Pass: worst of 20 changed-build observations is 3.559 s low / 3.589 s high |
| No new gameplay frame >66 ms | Pass: 23,523 candidate frames across all four cells; none >66 ms |

Acceptance retains a **historical stale FAIL for L9-03**, whose current status is NOT CHECKED. L9-08 currently passes; the other eight current rows require fresh browser/manual evidence. Native completion is not full acceptance signoff. The original full scene invocation exits 1 because another lane's exclusive reservation times out its final batch; `--shard 11/11 --batch 5` then exits 0 with all four rows passing. The combined 50-row coverage and unchanged input check are retained in the evidence.

### Native frame qualification

Headless native Metal WebGL2, 1280×720, all playing L9 phases including crash/crawl, ordinary real input, no profiler or forced GC. Each reservation passes the unmodified exclusive quiet-run preflight.

| Quality / zoom | Frame p95 | Maximum | Frames >66 ms |
| --- | ---: | ---: | ---: |
| Low / 1 | 16.7 ms | 33.4 ms | 0 |
| Low / 1.5, clean repeat | 16.8 ms | 50.0 ms | 0 |
| High / 1 | 16.7 ms | 50.1 ms | 0 |
| High / 1.5 | 16.8 ms | 50.0 ms | 0 |

The paired baseline low/1 has one existing 166.7 ms frame late in the approach; its changed counterpart peaks at 33.4 ms. Presentation p95 stays in the baseline's 16.7–16.8 ms range. These are the recorded presentation timings; this report does not substitute them for a full E31/manual performance signoff.

A first low/1.5 run overlaps foreign main-repo typecheck/unit work after admission. It still peaks at 50.1 ms, but is excluded from clean qualification and repeated. The retained clean repeat and the high cells have no observed foreign workload. Shared content-matrix timings, which contain multi-second stalls in both builds, are excluded from qualification.

### Resource budgets

Observed in the qualification runs and paused heap diagnostics:

| Metric | Low observed | High observed | Low / high ceiling |
| --- | ---: | ---: | ---: |
| Draw calls | 93 | 114 | 300 / 600 |
| Triangles | 113,149 | 211,726 | 500,000 / 1,500,000 |
| Fixed-tick CPU p95 | 1.2 ms | 1.5 ms | 6 / 4 ms |
| Collected JS heap | 210.7 MB | 221.0 MB | 250 / 400 MB |

CPU is the per-frame maximum fixed-tick elapsed time, observed throughout play. Heap uses four explicit paused `HeapProfiler.collectGarbage` / `Runtime.getHeapUsage.usedSize` probes per quality, including initialization, mid-drive, late drive/crash and the bounded endpoint. Backing-storage bytes are separately retained. This matches the collected JS heap metric of the existing E31 performance tool; it is not a process-RSS measurement. Forced-GC diagnostic frame timings do not contribute to frame qualification. The coarse page memory counter is retained for diagnosis but is not the heap proof.

### Cold loads

Twenty isolated empty browser contexts per build and quality, native Metal WebGL2, real level click → loading card closed / Begin ready. The browser process is reused; there is no profiler. The final sample of each configuration also sends ten seconds of physical WASD input.

| Quality | Before median / worst | After median / worst | N per build |
| --- | ---: | ---: | ---: |
| Low | 3.541 / 3.641 s | 3.541 / 3.559 s | 20 |
| High | 3.440 / 4.271 s | 3.317 / 3.589 s | 20 |

All 80 observations use the requested quality and hardware WebGL2 backend, with zero browser errors. Maximum post-card frames are 33.4 ms low and 50.0 ms high in both builds. Main-repo native checks/builds overlap part of the high cold matrix after admission; the host log records them. Every observed worst case remains below six seconds. Small timing differences are not attributed to this change.

## Reproduction and retention

Build with `MI_BUILD_CACHE=off npm run build:qa`. Serve the base and changed builds on separate preview origins. The recorded base bundle is `index-BoRx-SN5.js`; the changed bundle is `index-AXN2AXqb.js`. Run one cell with:

```sh
L9_DRIVE_ORIGIN=http://127.0.0.1:4843 sh tools/e2e-lock.sh node --import tsx tools/qa/r10-l9-drive.ts candidate low 1
```

Use `tools/perf/quiet-run.sh` for timing with `PLAYTEST_SHOT_SECONDS=9999`. The runner's `pair` mode accepts `L9_BEFORE_ORIGIN` and `L9_AFTER_ORIGIN` and serializes both builds inside one reservation. Cold-load reproduction uses `tools/perf/cold-load-time.ts <origin> webgl2 <low|high> 20 L9`. For paused heap diagnostics, set `PLAYTEST_HEAP_PROBE=1`, `L9_DRIVE_SAMPLE_SECONDS=100` and `PLAYTEST_SHOT_SECONDS=45`; a bounded yield intentionally returns exit 1 and does not claim level completion.

Reviewed raw captures, browser/CPU profiles, telemetry, redundant sheets and temporary baseline files are removed. The report, compact `evidence.json`, and one 274 KB comparison sheet are committed. Temporary preview servers are stopped. Commits remain local.
