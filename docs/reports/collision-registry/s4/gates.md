# S4 gate record

Retained gameplay source: **`3714fe54e`**. Main batch 5 `3883a1679` was merged first in `5f9c2fef4`. Later report commits contain evidence/documentation only. No deployment or merge back to main.

## Final-source results

**The requested collision/full browser gates pass. The extra full E18 check is RED (19 pass /three fail); this is not an unconditional E18 sign-off.** Zoo S2 and all measured phone/desktop/horde timing gates pass. The broader failures and pinned-main comparison are recorded below.

| Gate | Result and retained proof |
| --- | --- |
| Typecheck / lint / fresh production build | Exact canonical script reports **tc=0, lint=0, build=0**. |
| Full timing project, Hetzner | **198 passed, zero failed/skipped**, all 26 files. `timing-371/tests.json`. Source SHA256 matches committed separation: `c3af33b72870ff263b0addf793a6ba6b81fabdeb71c2187babaf8ba1642dfaa0`. |
| Zoo S2 high | **3.804490 ms <=4 ms**; 200 registered actors, 20 zoo replacements, 51 special activations. `timing-371/zoo-200.json`. |
| Zoo S2 low | **1.737080 ms <=6 ms**; 100 registered actors, 10 zoo replacements, 27 special activations. `timing-371/zoo-100.json`. |
| Full functional unit + sim, Hetzner | **2,488 passed, seven existing Linux platform skips, zero failures**. `functional-371.json`. Both weapon offline-audio checks run and pass on runner 1 with ffmpeg present. |
| Complete unit + sim union | **2,686 passed, seven skipped, zero failures**: unit 1,554 passed/seven skipped; sim 1,132 passed. The disjoint functional/timing projects retain the normal include/exclude definitions; no selected cases were dropped. |
| Full levels, Hetzner | **328 passed, two existing skips, zero failures** across 58 files. `collision-s4-levels-371.json`. Full remote unit/sim/levels total: **3,014 passed /nine skipped**. |
| Main comparison, 100 actors | Three alternating main/head trials against pinned batch-5 main. Median p95 **1.384107 ->1.284990 ms, -7.1611%**, passes the +3% regression gate. `main-pair-371/summary.json`. |
| Main comparison, 200 actors | **2.700826 ->1.955125 ms, -27.6101%**. Same 120 warmup +3,600 measured ticks, seed 1, same helper on both sources. All living/visible actors retained; head failures and pending both zero. |
| Exact state replay | **5,760/5,760 tick hashes match**, all special-event sequences match, eight classic/mixed 100/200 actor seed-1/2 cases. `state-compare/`. Existing mixed-200 transient admission (199 visible/one pending) occurs identically on both sides; no fixture change. |
| Touched-area matrix | **WebGL 36/36 and WebGPU 36/36**, high/low x zoom 1.5/1/.5. Six scene families. `final-webgl/index.json`, `final-webgpu/index.json`; 48 requested sheets opened and described in [visual-review.md](visual-review.md). |
| Canonical smoke | **Six Node smoke checks and 31 browser checks passed**, no browser failures/skips/flakes. Node smoke's 3,017 unmatched cases are selection skips, not a claimed full-suite run. |
| Canonical full deploy matrix | **608/608 passed**, zero failed rows. `gate-371/matrix-index.json`. |
| Canonical browser selection | **120/120 passed**, zero failures/skips/flakes; two workers/retries one, exact script unchanged. `gate-371/browser.json`. |
| Core E18 browser checks | **19 passed /three failed**, zero skips/flakes. L5-low triangles565,883>500,000; high/low five-load heap growth exceeds10%. All eight download cases and the quality/context/mobile checks pass. Main baseline comparison is documented below. `e18-core/results.json` and raw artifacts. |
| Native desktop | **5.9 ms frame p95 <=16.7**, 200 actors, native headless Apple M4 Metal. `native-final/desktop-gpu.json`. |
| Native horde | High 200 infected +40 active civilians: **6.3 ms <=14**. Low 100 +40 at 4x CPU: **11.9 ms <=33.333**. `native-final/after-high-1.json`, `after-low-1.json`. |
| Native phone base | **Four/four pass**, frame p95 max31.4 ms <=33, sim p95 max4.2 ms <=6. Unchanged L1/L3/L4/L5 scenes, original 600 live-clock frames/exclusions and actor rosters, low tier, 4x CDP CPU. See table below. |
| Mobile L6 proxies | Pixel7/4x and iPhone14/2x: **59.88 fps p50 >=30**, 1,200 rendered samples each, 100 infected each. Native M4 Chromium emulation, not physical recordings. |

## Native phone samples and admission

| Scene | Frame p95 /33 ms | Sim p95 /6 ms | Peak infected |
| --- | ---: | ---: | ---: |
| L1 | 16.0 | 4.2 | 0 |
| L3 | 17.5 | 3.8 | 12 |
| L4 | 19.6 | 3.5 | 0 |
| L5 | 31.4 | 3.6 | 12 |

The final native batch ran all 13 existing tests together: **nine passed, four existing manual skips, zero failures/flakes**. The skips are desktop WebGPU timing, the two mobile WebGPU timings and physical Android/iOS recording validation. This report does not claim physical-phone timing. The new visual matrix independently exercises real headless WebGPU. Full native samples, CPU profiles (gzip), DOM diagnostics, screenshots, conditions and browser result are under `evidence/native-final/`.

Admission used the unchanged `tools/perf/quiet-run.sh` and a temporary `lockf` wrapper adding nonblocking acquisition to its four existing browser locks. Partial acquisitions release immediately. A process-group deadline of 1,140 seconds plus at most 15 seconds termination grace bounds a reservation below 20 minutes. Initial attempts had a 25-minute admission window and returned busy; those logs remain historical. An older f872 batch completed at07:07 CEST in154.63 seconds. The **final371** immediate attempt at08:23 CEST acquired all four locks after the focused matrix had released; preflight load1.00, no other headless Chrome and no local Vitest. It completed and released after **225.47 seconds** at08:27. Quiet batches were separated by more than an hour, with ordinary work between them. No slot wait exceeded30 minutes.

Every final phone proof records no competing Chrome/Vitest at either measurement endpoint. Load averages during the active batch rose above the initial preflight value; the files preserve those readings, including load3.66 at L3 end. No local builds, unit sweeps, profile processing or image viewing ran during the native batch. Remote runner work uses separate machines.

## Exact commands and environment

All heavy unit, sim and levels work uses `sh tools/remote/run.sh "$PWD" -- ...`; maxWorkers4. Complete timing reserves both runner slots through `tools/remote/timing-isolated.sh`; the candidate driver installs exactly the committed source bytes in its private remote snapshot and runs the **unmodified entire timing project**. The source hash is retained alongside its full report. The functional project and levels run independently from the same source snapshot. Runner1 has ffmpeg, preventing the two incidental audio skips seen on runner3.

The final canonical gate is the exact requested command:

```sh
sh /Users/wesner/Workspace/minorincident/epics-pipeline/gate-browser.sh "$PWD"
```

It owns free ports3397/3393 and uses existing E2E locks. The watcher only snapshots JSON reports before subsequent stages overwrite them; it does not modify the script, selection, tests or exit statuses. It also preserves the complete log because that shell script's grep pipelines can hide individual failures in its exit code. Final acceptance uses stage outputs and the JSON counts, not shell status alone.

Focused matrices used free ports3474/3475 with one worker each, at most two own browser workers in total. Native timing used3476, one worker and all shared reservations. The core E18 follow-up uses its own checked-free port, one worker, after the canonical process ends. Browser work is headless; macOS WebGL uses ANGLE Metal; no second server or any server on3300 was started. The production build is refreshed before final browser QA; no source changes occur while it serves.

`npm run verify -- E18` is **not claimed as run**: its E18 split path still unconditionally starts local full Vitest timing, contrary to the remote-only instruction. The complete Node projects, canonical browser gate and E18 browser/performance constituents are recorded directly instead. The physical recordings and manual WebGPU timing remain their existing explicit skips.

## Attribution, failures and historical evidence

The profile in `full-context-profile/` attributes the original measured 600 high ticks inside the full timing process: query345.163 ms self, registry commit195.332, separation visitor152.488. Its instrumented5.379 ms p95 is diagnostic overhead, not acceptance. A final capture on371 retains all three measured-window CPU profiles in `profile-371/`: 200actors/51activations each; instrumented p95 3.984085 /3.907185 /3.242719ms. These isolated diagnostics do not replace full-project acceptance. Earlier measured-window/phase profiles and all before/after trials are retained. The source, runner command, exact byte transformations and comparisons are under `method/`.

Historical files with `final-*` names at the evidence root are the first ffdd optimization, not final371. Its initial full suite passed2,681/seven skipped and Zoo3.852958/2.200539; its exact full matrix failed593/608 but its browser120 passed. Those 15 visual failures caused the documented QA corrections. `ffdd-webgl/` and `ffdd-webgpu/` are that earlier six-row fixture coverage. `native/` is the older f872 seven-pass/one-skip batch. **Only `timing-371/`, `functional-371.json`, final levels371, `main-pair-371/`, `final-webgl/`, `final-webgpu/`, `native-final/` and the final canonical/core records support the final-source acceptance table.**

Rejected timing results remain visible: window6.004126, empty-only4.665920, source103 at4.219711, f872 at4.184432 and231 at4.159168 ms. The f872 complete gate was stopped during its failing matrix using its verified owned process tree; its partial rows and stop record remain under `gate-f872-partial/`. No failed sample is dropped or relabeled as success. Finer separation indexing changed special activations54vs51 and was rejected. Numeric-array/proposal/repair-cache trials did not consistently improve the full context and were reverted.

L5 difficulty and `src/assets/staticCollision.ts` match merged main3883a1679. No specs, gates, budgets, actor counts, forbidden reference trees or dependencies were changed.

## Extra E18 failures and pinned-main comparison

The additional broader core E18 batch ran after the complete requested gate, on the same unchanged gameplay source. It passes19 and fails3 with zero skips/flakes. No gate is loosened or suppressed. The failures are retained in `e18-core/results.json`, `run.log`, `failures/` and `artifacts/`. All8 download combinations pass (female/male, high/low, WebGL/WebGPU), maximum **14.945198 MB <=15 MB**. Absolute L6 heap usage remains within400/250MB, but that does not excuse the separate10% growth failure.

| Five-load check | First L1 heap MB | Last L1 heap MB | Growth /10% limit |
| --- | ---: | ---: | ---: |
| head high | 79.757604 | 96.643024 | 21.171% |
| main high | 79.266408 | 96.179812 | 21.337% |
| head low | 68.164940 | 85.913688 | 26.038% |
| main low | 67.611160 | 85.435496 | 26.363% |

Both heap failures reproduce on pinned main3883a1679 with almost the same progression. Main's low-L5 counter test fails earlier, with **Infected concurrency cap reached**, before writing triangle counters. The branch reaches100 actors and records **565,883 triangles /500,000**,243 draws /300; deterministic first/second counts match. Consequently main E18 AC01 is already red, but the exact565,883 triangle overrun is **not attributed to main** without a valid baseline measurement. That attribution remains unresolved. No baseline scenario, actor count or cap was modified to force a measurement.

The baseline uses513 verified git blobs for source, fixture and counter-test files; the unchanged memory tests/config are extracted directly from the pinned commit. Runtime assets/public have no branch diff. It has its own fresh build, Metal headless browser, one worker and checked-free3481 port. The archive has no.git directory, so Vite prints a harmless source-revision warning; source identity is established by git-blob comparisons, not that runtime label. Baseline reports, both memory sample arrays, build/run logs and comparison are under `e18-baseline-main/`.

The job's stated open items are Zoo S2 and unmeasured phone timing. They are resolved, and the exact requested deploy gate passes. Broader E18 failures are surfaced explicitly for follow-up; no L5 difficulty/asset detail, memory criterion or budget is changed to hide them. A scope clarification was offered while baseline work continued; absent further steering, the implementation stays within the stated collision task.
