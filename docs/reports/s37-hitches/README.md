# s37-hitches — frame hitch investigation

Status: in progress. No cause has been attributed and no game performance fix has been made. The historical samples below identify the event windows, but do not meet the lane's two-run comparison requirement. Current before/after p99, load-time delta, and machine-load status are still unmeasured.

## Historical before samples (r35-vqa, 2026-11-11)

These values come from the real-input logs cited in `docs/reports/r35-vqa/README.md`. They are context for reproducing the same runs, not a newly qualified baseline. The old logger retained only frames above 100 ms, so it cannot provide max or p99 across all frames.

| Run | Settings | Long frames after first 3 s | Context recorded at the event | Load delta |
|---|---|---:|---|---|
| L8 lion (`l8-lion4-low-z1-gl`) | low, WebGL2, zoom 1 | 1817 ms at tick 7698 | Player at (-59.3, -12.6); lion at 1.9 m on the preceding sample; two runners visible; 2–3 allies. | not measured |
| L5 cellar-to-Mia route (`l5c-low-z1-gl`) | low, WebGL2, zoom 1 | 667 ms at tick 9091; 583 ms at tick 10949 | Player stationary at (-32.6, -33.6); no enemies visible; two allies drawn at adjacent samples. | not measured |

Raw source logs are in the shared scratchpad at `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r35-vqa/` (`l8-lion4-low-z1-gl/log.jsonl` and `l5c-low-z1-gl/log.jsonl`). The old report does not state host load for these samples.

## Current evidence and measurement changes

- The old fixture-play logger kept only intervals over 100 ms and had no performance counters attached to those intervals. This is insufficient for the requested p99 and causal attribution.
- `tools/qa/r28-vqa-fixture-play.ts` now samples every RAF interval after the first 3 s, reports run max/p99 and the complete >250 ms event list, and attaches `Game.perf()` counters to long frames. It enables `loadProfile=2` so runtime node builds can be tied to material/object identities. `--trace` captures the Chromium main-thread/V8/GC timeline to the supplied output directory; it rejects output directories inside the worktree.
- `npm run typecheck` passes with this instrumentation.
- Controlled reruns have not started. The shared browser pool cannot bind port 4329 in this sandbox (`listen EPERM`); the legacy `tools/e2e-lock.sh` path also cannot read the process table required by `tools/mac-gpu-guard.py` (`ps` EPERM). Both browser admission paths were left intact; no gameplay browser ran.

## Attribution and remaining work

The L8 event coincides with a nearby active lion fight, which makes the encounter a useful reproduction window but does not prove shader compilation, FX, texture upload, or any other cause. The L5 events happened while stationary with no enemies visible, so nearby combat is a weak explanation; the logs still cannot distinguish deferred asset work, GC, CPU tasks, or external scheduling. No cause is yet supported strongly enough to justify a game change.

Next: run at least two controlled baseline plays for each scene on low WebGL2 and high WebGPU, capture frame summaries and runtime counters, attribute each >250 ms event with a trace, implement the smallest evidence-backed fix without reducing content or quality, then repeat both runs and record per-run max/p99 plus load-time delta and host load.

## 2026-11-11 continuation

Filesystem restrictions were lifted; slim-worktree setup, process inspection, QA build and pooled browser admission now succeed. An owned orphan admission process from the restricted attempt was stopped by its exact PID. The owned preview on 4937 was stopped after the run.

The first current L8 low/WebGL2 diagnostic completed for 180 s under shared host load (another QA lane active): 10,606 post-3-s intervals, max 66.7 ms, p99 16.8 ms, zero >250 ms, no page errors. **Excluded from qualification:** marker following stalled at (-115.2, -53.4), checkpoint `cleared-flamingo`, so the lion arena was never reached. Raw log and working Chromium trace: `/private/tmp/s37-hitches/l8-baseline-1/` (trace 340,129,037 bytes). This validates the new logger/trace path, not the requested arena performance.

Recovered actual r35 lion route from its reached/blocked events: `--route='-40,-51;0,-51;0,-64;-60,-64;-60,-56;-60,-12;-60,0;-24,0;-24,4' --block 120`. Use this explicit route for the next baseline; the historical run reached the arena at ~tick2053. Build QA succeeded. Earlier sandbox blockers are resolved.

## Recovered-route baseline samples

Current unchanged game source, QA production build, headless Metal WebGL2, low, zoom1, real input, one pooled browser per reservation (<10min). Shared Mac load; these are exploratory samples, not isolated reference-machine qualification.

| Run | Duration | Post-3s samples | Max | p99 | >250ms | Coverage |
|---|---:|---:|---:|---:|---:|---|
| `l8-route-baseline-1` | 180s | 10,594 | 133.3ms | 16.8ms | 0 | Explicit recovered route reached `arena-lion`; lion chase/attack nearby. |
| `l5-baseline-1` | 210s | 12,403 | 50.1ms | 16.8ms | 0 | Cellar → Mia → `survivor-1`; stationary (-31.1,-33.6), two drawn allies, no visible enemies, both historical event ticks covered. |

Both runs had zero page errors. Logs and complete Chromium traces remain outside Git in `/private/tmp/s37-hitches/<run>/` (338,382,633 / 328,467,400 trace bytes). No game change was made: the historical >250ms failures did not recur in these first current samples. A clean current sample cannot retrospectively attribute the historical event. Repeat low/WebGL2 and high/WebGPU coverage, trace analysis, before/after/load delta and a supported attribution remain outstanding. Owned preview4937 stopped after both runs; no check left running.

### First high WebGPU samples

Same QA build and recovered routes, high quality, zoom1, headless Metal WebGPU, one browser per <10min reservation, shared Mac load. Backend was read from the runtime log.

| Run | Duration | Post-3s samples | Max | p99 | >250ms |
|---|---:|---:|---:|---:|---:|
| `l8-high-baseline-1` | 180s | 10,587 | 66.6ms | 16.8ms | 0 |
| `l5-high-baseline-1` | 210s | 12,415 | 33.4ms | 16.8ms | 0 |

L8 reached `arena-lion` with lion attacks and nearby runner/armored combat; L5 reached `survivor-1` at (-30.7,-33.6), two allies and no visible enemies through both historical event windows. Zero page errors. Raw logs and traces remain in `/private/tmp/s37-hitches/<run>/`. First samples now exist for all four scene/backend combinations, but repeats and causal attribution remain incomplete. No gameplay/render change and no measured load delta yet. All owned checks finished and preview4937 stopped.

### Trace inspection and load clock

`trace-summary.json` records maxima from all duration events in the four saved traces. Major GC maxima are 30.2–36.5ms and minor GC maxima 5.1–7.2ms. These traces do not reproduce a >250ms gameplay frame and therefore do not establish the historical cause. Maxima cover the complete diagnostic trace, including pre-play setup; they are not post-3s timing gates. CPU profiler startup itself takes192.6–307.7ms before the play collector starts, illustrating why setup/trace overhead cannot be assigned to the old in-play events.

The runner now logs `loadWallMs` around fixture/direct level setup and the engine's `loadTiming` separately. Fixture setup includes checkpoint restoration and the existing paused setup steps; direct setup includes its existing60ticks. Compare like setup paths across repeats, and use engine loadTiming to distinguish engine load from harness preparation. No measured load-time delta is claimed yet.

### Second low WebGL2 samples

Same QA production build, tracing, routes, durations and zoom1; separate pooled reservations under10min each, shared host. Both reached the same arena/survivor checkpoints and had zero page errors. Compact retained receipt: `repeat-low.json`.

| Run | Samples after3s | Max | p99 | >250ms | Setup wall | Engine data/sim/view |
|---|---:|---:|---:|---:|---:|---|
| L8 low repeat2 | 10,596 | 83.4ms | 16.8ms | 0 | 6196ms | 13.6 /145.8 /3008.5ms |
| L5 low repeat2 | 12,407 | 50.1ms | 16.8ms | 0 | 5243ms | 8.5 /214.8 /2477.5ms |

There are now two low/WebGL2 samples per scene, all below250ms after3s. No game fix was applied, so these are repeated baselines rather than an improvement claim. High/WebGPU repeats, a reproducible cause for the historical outliers and a measured before/after load delta remain open. Raw logs/traces: `/private/tmp/s37-hitches/l8-route-baseline-2/` and `l5-baseline-2/`. All checks finished; owned preview4937 stopped.

### Second high WebGPU samples — failure reproduced

`repeat-high.json` retains full frame summaries and load clocks. Same recovered routes, durations, high/WebGPU zoom1, one reservation per run under10min, shared Mac/browser pool. L8 reached arena-lion and **FAILS**: 9,345 post3s intervals, max3233.3ms, p99 66.7ms,15frames>250ms (ticks5577–8617). L5:12,286intervals, max166.6ms, p99 16.8ms, zero>250ms. Both zero page errors. This failure is retained and cannot be excluded from acceptance.

L8's650–3233ms gaps have unchanged nodeBuilds642, heap386MB, entities1205; captured simWorldMs12.9–30.5ms and simTickMs3–14.5ms. Full trace duration-event scan shows max FireAnimationFrame40.42ms, MajorGC43.81ms; neither explains3233.3ms. The browser-wide trace contains48 CpuProfiler::StartProfiling events (max240.76ms), HandlePostMessage max544.15ms and background script parsing230.72ms. Process/timestamp mapping is needed before attributing these shared-browser events to the measured renderer or external work. Raw trace/log: `/private/tmp/s37-hitches/l8-high-baseline-2/`; L5 in `l5-high-baseline-2/`. All owned commands terminal; preview4937 stopped.

### Failing trace process audit

`failing-trace-processes.json` identifies measured renderer PID63443 from4937 script URLs; foreign renderers63585 (4931) and65593/65596 (4981) share this browser-wide trace. The measured renderer's traced RAF CPU max is40.42ms. Its RAF timestamps span95,247.934ms, shorter than the180s measurement; the largest measured gap occurred at131,320ms. This trace cannot directly attribute that largest gap. The previous export did not retain Chromium's data-loss flag, so buffer loss is a concern, not a proven cause.

Runner trace capture now requests `recordAsMuchAsPossible`, removes verbose general V8/GC categories while retaining devtools timeline/CPU samples, and logs `dataLossOccurred`. Next controlled measurement should use repository `tools/perf/quiet-run.sh` exclusive admission around the existing e2e-lock invocation, with conditions receipt; the retained shared-load failure remains a failure. Foreign activity is evidenced but its causal role is not yet established. No game change is justified yet.

### Exclusive L8 high control1

`exclusive-l8-1.json` retains admission, load and frame receipts. Quiet admission waited while load fell7.73→3.20, then passed exclusive/load<3/no foreign browsers or build/test jobs. Same unchanged game build and route reached arena-lion. 10,604post3s frames, max50.0ms, p99 16.8ms, zero>250ms, zero page errors. This supports shared scheduling/resource contention as a hypothesis but one isolated clean control does not causally explain the shared failure.

The new trace export explicitly reports `dataLossOccurred:true` at300,507,313bytes. It is unsuitable for full-window attribution; this is no longer hidden. Trace capture now excludes default categories and CPU-profiler sampling, retaining only devtools timeline/user timing to reduce capture pressure. Current RAF metrics remain separately recorded. Need complete failing/control trace, repeated exclusive controls and full original acceptance audit. Owned run terminal and preview4937 stopped. Target not achieved.

### Exclusive L8 high control2 — complete trace

`exclusive-l8-2.json` retains quiet admission/load/frame/export receipts. Exclusive/load<3 admission passed after the bounded wait. Same game build, route, high/WebGPU zoom1 and180s duration reached arena-lion.10,605post3s intervals, max50.0ms, p99 16.8ms, zero>250ms, zero page errors. Export132,557,761bytes, **dataLossOccurred:false**. `exclusive-l8-2-trace.json` verifies one RAF renderer PID87620,180,059.39ms traced RAF span, max RAF CPU33.73ms. This fixes the diagnostic capture gap without changing game content or rendering quality.

Two exclusive controls now pass, versus the retained shared high/WebGPU failure (max3233.3ms). That is evidence consistent with shared resource/scheduling interference, but does not establish a unique cause for each shared or historical gap; the failing trace lacks the largest event window. Need a complete failing shared trace or another direct causal probe before claiming attribution. Target remains open. All owned processes/checks terminal; preview4937 stopped.
