# r20-loadtime — cold loads and threat runtime

**BLOCKED — goal not met: 6/20 cold cells qualify; threat runtime margin is unproven.** Starting revision: `cab3405c`. All commits are on `lane/r20-loadtime`; no deployment or push.

## Required qualification

- L1/L4/L7/L8/L10 × WebGPU/WebGL2 × low/high: 20 fresh browser profiles per side, median ≤ matched PROD × 1.05, every candidate load ≤ 6,000 ms, post-card maximum ≤ 200 ms.
- The complete, unchanged threat audit must finish inside its 600-second command budget with useful headroom.
- Preserve level content, policies, seeds, observation windows and acceptance thresholds.

## Repairs

| Cause | Evidence | Change |
|---|---|---|
| Companion graphs are created after prototype warm-up | A render-pipeline trace attributes late synchronous links to the corgi body, collar bell and backpack. | `8ae970c5`: instantiate resident NPC presentations before warming and use the companion's actual courier-depth materials for its loading representative. |
| Vertex/index uploads interleave with queued WebGL links | L8's first-profile chunk phase stalls after shader compilation; the retained trace also identifies blocking buffer uploads. | `04ea9aff`: upload resident WebGL attributes through Three's version cache before starting program links. All ordinary/instanced/solo draws remain. |
| Long passive follower jobs start last | The old L7 seed estimates are 20 seconds; measured complete windows take 149–161 seconds. The original gate leaves both running at timeout. | `10e47dbd`: price long passive jobs before short routes. All 31 stages complete in 598.97 seconds, still without useful margin. |

The broad compilation experiments were discarded. Runtime content and public assets are retained. The frozen qualification bundle is built from both repairs; later changes to the threat tool do not change that bundle.

## Before and intermediate results

These are complete 20-profile paired reservations on this lane. Values are median / maximum milliseconds. The first two rows precede either repair; the last four use only the companion repair and do **not** qualify the subsequent buffer-upload build.

| Candidate | Configuration | Fresh PROD | Candidate | Median Δ | Verdict |
|---|---|---:|---:|---:|---|
| Starting main | L10 WebGL2 low | 3493.70 / 5794.10 | 3708.85 / 6524.60 | +6.16% | FAIL |
| Starting main | L10 WebGL2 high | 3201.70 / 5660.90 | 3467.45 / 6557.70 | +8.30% | FAIL |
| Companion repair | L10 WebGL2 low | 3495.00 / 5809.60 | 3584.70 / 5476.70 | +2.57% | PASS |
| Companion repair | L10 WebGL2 high | 3209.10 / 5692.80 | 3342.55 / 5275.50 | +4.16% | PASS |
| Companion repair | L8 WebGL2 low | 3101.15 | 3059.20 / 6758.10 | −1.35% | FAIL: maximum |
| Companion repair | L8 WebGL2 high | 3324.75 | 3366.65 / 6774.70 | +1.26% | FAIL: maximum |

## Final cold matrix

Qualified: **6/20** cells, **240/800** fresh profiles. Every measured cell has 20 profiles per side. Values are milliseconds. Unmeasured cells remain unqualified.

| Configuration | PROD median | Candidate median | Candidate p90 | Candidate maximum | Median Δ | Post-card max | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| L1-webgpu-low | — | — | — | — | — | — | UNMEASURED |
| L1-webgpu-high | — | — | — | — | — | — | UNMEASURED |
| L1-webgl2-low | 2193.55 | 2225.80 | 2292.90 | 2326.40 | +1.47% | 33.40 | PASS |
| L1-webgl2-high | 2158.65 | 2192.90 | 2227.00 | 2375.90 | +1.59% | 50.00 | PASS |
| L4-webgpu-low | — | — | — | — | — | — | UNMEASURED |
| L4-webgpu-high | — | — | — | — | — | — | UNMEASURED |
| L4-webgl2-low | — | — | — | — | — | — | UNMEASURED |
| L4-webgl2-high | — | — | — | — | — | — | UNMEASURED |
| L7-webgpu-low | — | — | — | — | — | — | UNMEASURED |
| L7-webgpu-high | — | — | — | — | — | — | UNMEASURED |
| L7-webgl2-low | — | — | — | — | — | — | UNMEASURED |
| L7-webgl2-high | — | — | — | — | — | — | UNMEASURED |
| L8-webgpu-low | — | — | — | — | — | — | UNMEASURED |
| L8-webgpu-high | — | — | — | — | — | — | UNMEASURED |
| L8-webgl2-low | 3075.70 | 3042.45 | 3092.70 | 4242.10 | -1.08% | 33.40 | PASS |
| L8-webgl2-high | 3349.95 | 3316.50 | 3442.20 | 4507.20 | -1.00% | 33.40 | PASS |
| L10-webgpu-low | — | — | — | — | — | — | UNMEASURED |
| L10-webgpu-high | — | — | — | — | — | — | UNMEASURED |
| L10-webgl2-low | 3575.90 | 3627.15 | 3676.10 | 5259.60 | +1.43% | 33.40 | PASS |
| L10-webgl2-high | 3227.35 | 3384.05 | 3426.40 | 4992.30 | +4.86% | 33.40 | PASS |

The [matrix receipt](cold-matrix.json) includes both sides’ distributions, bundle identities, host digests and rejected reservations. Failed quiet reservations are retained in full and excluded as whole reservations.

## Threat runtime

Every full run uses the unchanged 600-second budget, all levels, original policies, seeds and observation windows. Both runner slots are held for the entire command; queue/sync time is excluded. The reference host is `2.31.107.230`, four shared AMD EPYC-Rome vCPUs, 8 GB RAM, Node 26.0.0. The first estimate trial uses a different, slower host and is labelled accordingly.

| Attempt | Runner | Command seconds | Finished stages | Result |
|---|---|---:|---:|---|
| Original scheduling | .230 | [600.24](threat-before-budget.json) | 29/31 | Timeout; L7 passive seeds 2/3 unfinished |
| First estimate trial | .171 | [600.98](threat-first-schedule-budget.json) | 12/31 | Timeout; different host |
| Measured scheduling, retained | .230 | [598.97](threat-matched-schedule-budget.json) | 31/31 | Complete, only 1.03 seconds of budget headroom |
| Warm-worker affinity | .230 | [600.23](threat-affinity-budget.json) | 30/31 | Timeout; discarded |
| Exact observer route cache | .230 | [600.17](threat-path-cache-budget.json) | 30/31 | Timeout; discarded |
| CPU pinning | .230 | [601.07](threat-cpu-placement-budget.json) | 30/31 | Timeout; discarded |
| Five workers | .230 | [600.39](threat-five-workers-budget.json) | 23/31 | Timeout; discarded |
| Single-threaded GC | .230 | [600.24](threat-serial-gc-budget.json) | 27/31 | Timeout; discarded |
| 256 MiB young-generation limit | .230 | [600.32](threat-semi256-budget.json) | 30/31 | Timeout; discarded |

The [complete control receipt](threat-control.json) preserves all ten levels, 31 stages without stage errors, native hashes, and **ten acceptance flags**. Its exit status is 1 for those findings. Audit execution itself takes 592.71 seconds; the budgeted command takes 598.97. This is not certification of the requested runtime margin or a green acceptance audit. The stage durations sum to 2,341.87 seconds: four-worker ideal balance is 585.47 seconds versus the observed 591.71-second stage envelope. Scheduling alone has little remaining room.

Additional diagnostics were also rejected: bundling a full L7 passive window preserved all 164 receipt leaves and its native hash but improved less than 1%; disabling Maglev changed the same full window from 175.18 to 176.71 seconds. The route cache passed 9,600 exact query/distance comparisons, including live blockers, several clearances, authored paths and weighted terrain (7,308 original versus 4,010 cached native A* calls), but did not improve the complete command. These changes are absent from the committed code. Raw profiles, patches and failed attempts are retained in the archive.

The [matched heap-size diagnostic](threat-heap-probe.json) preserves every receipt value and the `bfdfd24f` native hash. On the reference host, 64/16/256 MiB limits take 131.31 / 131.43 / 127.73 seconds for the same complete 1,200-second L7 window. Despite that 2.73% single-window gain, the full 256 MiB audit times out with L6 skilled unfinished. A snapshot during the long stages shows 3.43 GiB combined Node RSS and 3.79 GiB available; it is not a full-run memory maximum. The flag is reverted.

## Cold capture blockers

The original six rejected reservations and every extension attempt remain in the raw archive. Extension collection attempted **18 reservations**; 12 reached sampling and retained 99 fresh-profile records. **0 extension configuration(s) qualified.** All partial records are excluded from the matrix.

Repeated local typechecks, builds, Vitest and QA simulation/capture scripts in `p1-l8rework` and `p1-l3ramp` overlapped sampling or prevented quiet admission. The [extension capture ledger](cold-extension.json) records each attempt, side counts, foreign commands and interrupted admissions. Some attempts reached the candidate side; none completed the required twenty profiles per side without an overlap. No sample-level exclusion or selective resampling is used.

The monitor aborts an entire sampling reservation when foreign work begins. Later collection also tried shorter, single-configuration reservations, with the same profile count and limits. Admission expirations and aborted setup remain unmeasured. The original three-hour time box ended around 18:23 UTC; the orchestrator granted ninety more minutes, starting at 18:27 UTC. That extension did not provide a sustained quiet window. The goal is not complete.

**Needed to finish:** pause competing local CPU/browser jobs for an enforced quiet window, then complete or repair the 14 unqualified configurations. Additional runtime repair time is also needed: the complete control still has only 1.03 seconds of headroom; every extension audit timed out. Queue and sync time are excluded from the reported audit budgets.

## Extension work

The orchestrator granted 90 more minutes at 18:27 UTC. The original evidence archive remains immutable; extension artifacts are retained separately.

- `a3278435` / `edebeef6`: the shared host classifier also detects CPU-consuming QA/simulation probes, while permitting idle clients queued behind the owned browser reservation. The existing classifier fixture includes active foreign probes and owned/idle exclusions; no test case was added.
- `4d43c7d5`: collect the three independent test inventories concurrently. Their shared wall-clock deadline, watchdogs, counts and cancellation status remain intact; cancellation now forwards to every active collector.
- `09b133ac`: serialize external browser preparation behind pending launches. A late shared Chrome could otherwise appear after retirement and block GPU admission. The live shared daemon was not restarted because other requests were queued; existing reservation preparation was repeated to clear idle instances.

[Extension validation](validation-extension.json) records typecheck, lint and the existing collection/timeout/cancellation/descendant-cleanup regression. [Extension threat trials](threat-extension.json) retain complete command-budget receipts and finished-stage records. The compiler inlining probe preserves every receipt value and hash `bfdfd24f`, but changes a complete 1,200-second route only from 126.24 to 125.89 seconds (−0.28%); it is discarded. Observer census and alternative dispatch-order probes are also reverted.

A possible L3 prefix-sharing optimization was rejected: its survival and army bootstraps use different chunk-residency setup. Both original simulations and their original windows are preserved.

<!-- extension-runtime-start -->
### Extension runtime trials

All rows retain the complete audit and the 600-second command limit. Incomplete trials do not qualify.

| Configuration | Runner | Command seconds | Finished stages | Result |
|---|---|---:|---:|---|
| Completed cohort observer | .230 | 601.10 | 26/31 | TIMEOUT |
| Three workers | .230 | 600.28 | 15/31 | TIMEOUT |
| Balanced tail + parallel inventory | .230 | 601.01 | 28/31 | TIMEOUT |
| Retained schedule + parallel inventory | .230 | 601.11 | 25/31 | TIMEOUT |
| 256 MiB on slower pool runner | .173 | 600.51 | 12/31 | TIMEOUT |
| 16 MiB reference run | .230 | 601.06 | 23/31 | TIMEOUT |
| One V8 background thread | .230 | 600.21 | 27/31 | TIMEOUT |

Exact receipts and raw artifact names: [extension results](threat-extension.json). All observer, dispatch-order, worker-count, compiler and heap probes are discarded. The retained runtime change is concurrent test inventory collection; a useful full-audit margin remains unproven.
<!-- extension-runtime-end -->

## Method and provenance

[Build and host provenance](provenance.json) records the frozen candidate bundle, source hashes, build settings and PROD identity. Candidate: `index-BnxiBBWO.js`, SHA-256 `518be35eed467aeeea9e8da94ad2346596d51ee349463b710d312d76ba88583a`, game revision `04ea9aff`. PROD is the pinned batch-59 release: all 2,758 mirror files were restored and checked against their recorded sizes and SHA-256 values. Both snapshots use the same static server. Cold requests receive original public bytes, without the opt-in diagnostic adapter. Public hook exclusion passes for all 21 HTML/JS files.

Captures use `tools/perf/quiet-run.sh`, exclusive browser admission, a post-queue cooldown, and continuous two-second host receipts. Chromium 153.0.8010.12 runs headlessly on native Apple M4 Metal at 1600×900, DPR 1. Browser processes and disk/HTTP profiles are fresh; OS/driver caches remain shared. Every sample retains its first post-card frames. Every configuration includes ten seconds of physical movement and at least 100 gameplay frames. Both sides use the same menu waits and requested quality. The original cold tool remains unchanged; its stricter no-increase assertion is disabled only by the harness, whose evaluator applies the brief's explicit +5% rule. A foreign-work overlap invalidates the entire reservation.

If game source or the candidate bundle changes, the current qualified cells cannot qualify that new build. Tool-only threat changes leave the frozen game artifact unchanged.

## Content and validation

The [content comparison](content-comparison.json) covers L1/L4/L7/L8/L10 in both tiers, comparing original main against the final buffer-upload build. Actor transforms and populated render-object metadata (names, vertex/index counts, instance counts and visibility) match exactly, with no browser errors. All populated objects, including hidden variants, are included; zero-count asynchronous corpse LOD cache batches are excluded.

Seven pairs have identical pixels. L7 low/high and L8 low differ in startup animation poses; the inspected image pairs preserve the scenery and actors. Selected L8 proof: [before](L8-low-before.png), [after](L8-low-after.png). This static comparison's host receipt caught a foreign Vitest job, so it is explicitly excluded from performance qualification. Its completed equality assertions remain content evidence. A later interrupted repeat is retained as rejected evidence.

The [earlier validation receipt](validation.json) covers the loading repairs. The [final extension gate](validation-extension.json) records `npm run verify -- E18` on retained code revision `09b133ac`: typecheck, lint, and **27 unit files / 107 cases all pass**. The full gate takes 68.67 seconds. Its inventory remains 150 cases across 44 files (limits 150/45); no test case was added. All observer, worker, heap, compiler and dispatch experiments have been reverted. This is the E18 per-change gate, not certification of the full E18 acceptance matrix.

The selected report files pass the scoped size/type/JSON/link check. The earlier repository-wide retention check reported 8,487 pre-existing historical/sparse-checkout violations; its archived log is retained. Unrelated reports are unchanged.

## Evidence and reproduction

Original raw captures, host receipts, failed attempts, profiles, logs, discarded patches, immutable public builds and the original reproduction harness are preserved in the [local raw archive](/Users/wesner/Workspace/mi-evidence-archive/test-results/r20-loadtime/). The [artifact index](artifacts.json) identifies its verified file manifest. Discarded experiment sources are preserved in the [reproduction archive](/Users/wesner/Workspace/mi-evidence-archive/docs/reports/r20-loadtime/repro/). This local archive is not part of a fresh checkout or CI. The retained report uses small selected JSON and images; raw artifacts are not added to Git.

The original archive is preserved unchanged. The extension has a separate [verified archive](/Users/wesner/Workspace/mi-evidence-archive/test-results/r20-loadtime-b/) listed in [artifacts](artifacts.json). It includes the current harness, temporary diagnostic sources, all failed captures and every runtime trial. Restore its raw root to `test-results/r20-loadtime/` before using the commands below; restore `repro-r19-extension/` to `test-results/r19-perf/` and temporary helpers from `repro-extension-tools/` to their original `tools/qa/` paths when reproducing those diagnostics.

The harness has an explicit remainder command, so qualified cells need not be collected again. Once other local CPU/browser jobs are paused and more time is authorized, restore the archived ignored directory to `test-results/r20-loadtime/` and copy its `repro-r19/` files into `test-results/r19-perf/`. The owned diagnostic servers have been stopped. Start the pinned snapshots in a separate terminal:

```sh
node test-results/r19-perf/restore-batch59.mjs
PERF_CANDIDATE_ROOT=test-results/r20-loadtime/public-qualified \
node test-results/r19-perf/snapshot-serve.mjs
```

Then collect the missing cells:

```sh
node test-results/r20-loadtime/refresh-report.mjs
node test-results/r20-loadtime/run-remainder.mjs
node test-results/r20-loadtime/refresh-report.mjs
# Only once all 20 cells have complete passing measurements:
node test-results/r20-loadtime/qualify-cold.mjs
```

`run-remainder.mjs` verifies served entry hashes and game-source hashes before selecting only UNMEASURED cells. `run-final-matrix.mjs` owns each exclusive reservation and applies the unchanged evaluator. The report refresher combines disjoint reservations, rejects repeated cells/profiles, and requires the frozen bundle identities. The stricter `qualify-cold.mjs` asserts all 20 cells and all 800 unique profiles before a complete PASS can be recorded.

The threat control and failed trials can be reproduced using the retained commands and patches. No acceptance threshold, seed or observation window was changed. A runtime repair still needs a complete fresh audit with useful budget headroom; incomplete or single-window diagnostics cannot substitute for it.
