# perf6 — public release performance vs live PROD batch 54

**Perf verdict: FAIL. Matrix complete: 34/41 comparisons pass; 7 fail.**

Candidate is fresh `MI_BUILD_CACHE=off npm run build` from main `c60d88e`, public bundle `index-CsuHqSQb.js`. PROD is the live `https://minor-incident.com/` deployment, verified as batch 54 by `index-DSZ-4VAt.js` (SHA-256 `c23aa36a5b56cc4dc64d97a63125ad66008b5727f20cd6e841143c73e1cc54e4`). Both sides are remeasured; older timings are not reused.

## Method and limits

Apple M4 / Mac16,10 / 16 GiB / macOS 26.5.1 (25F80), headless Chromium 153.0.8010.12 / Playwright 1.63.0, native Metal WebGPU and ANGLE Metal WebGL2, 1280×720, DPR 1, seed 1. One context at a time through `tools/perf/quiet-run.sh`; caller-owned local previews on 4901/4902. Cold is a fresh isolated browser context; warm is its reload. GPU/driver caches are shared host state, so this is one cold/warm pair per cell, not worst-of-N or a clean-driver-cache certification.

The deployed public bundles have no QA API. Menu loads use the original public bytes. Gameplay uses the same current-source test-control module on both public builds, attached to the existing Game instance by one local bootstrap insertion when `testApi=1`. This supplies the ordinary complete-bot InputFrames and existing game methods; gameplay/render implementation and content remain each public bundle’s own. The adapter settles boot audio and promotes speculative L1 through the native load method before route preparation. Public render probes are compiled out, so zero `crowdFigures()` probe results do not mean zero drawn actors. World counts, source tier, backend, native route state and frame traces are retained.

Pass rules: candidate cold **and** warm ≤6 s and ≤PROD+0.5 s; native p95 ≤PROD+1 ms; maximum allows one additional 60 Hz frame, retaining 50.0/50.1 ms quantization. New ≥66 ms spikes fail. An inherited ≥66 ms maximum within the relative rule is explicitly labelled below; A/B PASS does not certify the absolute transition budget. L1/L8 withhold only the terminal interaction/exit movement to retain the level for the full minute. No counts or quality settings were reduced.

## Unified verdict table

Loads are seconds. Frame columns are milliseconds, PROD → candidate. Every WebGPU cell includes cold/warm real menu-click loads and a full native gameplay minute. Named moments include both L1 full-route maxima as well as the shutter windows, in addition to the historical moment set.

| Scope | Cell / moment | PROD cold / warm s | Candidate cold / warm s | p95 ms P → C | Max ms P → C | Verdict |
|---|---|---:|---:|---:|---:|---|
| WebGPU | L1 low | 3.277 / 1.978 | 1.977 / 1.946 | 16.8 → 16.8 | 150.0 → 33.3 | PASS |
| WebGPU | L1 high | 1.777 / 1.740 | 1.828 / 1.805 | 16.7 → 16.8 | 66.7 → 66.7 | PASS A/B; inherited ≥66 ms |
| WebGPU | L2 low | 5.242 / 2.776 | 2.857 / 2.745 | 16.7 → 16.7 | 33.3 → 16.8 | PASS |
| WebGPU | L2 high | 2.807 / 2.707 | 2.890 / 2.739 | 16.8 → 16.8 | 50.0 → 50.1 | PASS |
| WebGPU | L3 low | 2.792 / 2.678 | 2.774 / 2.727 | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| WebGPU | L3 high | 2.457 / 2.427 | 2.559 / 2.439 | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| WebGPU | L4 low | 3.576 / 2.778 | 3.556 / 2.926 | 16.7 → 16.7 | 416.7 → 49.9 | PASS |
| WebGPU | L4 high | 3.373 / 3.224 | 3.390 / 3.240 | 16.8 → 16.8 | 50.1 → 33.5 | PASS |
| WebGPU | L5 low | 4.991 / 2.428 | 5.543 / 2.545 | 16.7 → 16.7 | 33.3 → 50.0 | FAIL: cold load |
| WebGPU | L5 high | 2.408 / 2.293 | 2.460 / 2.339 | 16.8 → 16.8 | 33.4 → 33.4 | PASS |
| WebGPU | L6 low | 4.494 / 1.795 | 4.991 / 1.778 | 16.8 → 16.7 | 33.4 → 16.8 | PASS |
| WebGPU | L6 high | 2.157 / 2.072 | 2.172 / 2.123 | 16.7 → 16.8 | 33.3 → 33.3 | PASS |
| WebGPU | L7 low | 6.575 / 2.362 | 2.609 / 3.529 | 16.8 → 16.8 | 300.0 → 33.4 | FAIL: warm load |
| WebGPU | L7 high | 3.658 / 2.743 | 7.543 / 2.856 | 16.7 → 16.8 | 49.9 → 50.0 | FAIL: cold load |
| WebGPU | L8 low | 6.492 / 3.096 | 3.191 / 3.143 | 16.7 → 16.7 | 166.5 → 166.7 | PASS A/B; inherited ≥66 ms |
| WebGPU | L8 high | 3.323 / 3.289 | 3.389 / 3.258 | 16.7 → 16.7 | 33.4 → 33.4 | PASS |
| WebGPU | L9 low | 4.575 / 3.094 | 4.406 / 3.159 | 16.7 → 16.8 | 33.4 → 33.4 | PASS |
| WebGPU | L9 high | 2.924 / 2.742 | 2.907 / 3.004 | 16.7 → 16.8 | 50.0 → 49.9 | PASS |
| WebGPU | L10 low | 4.960 / 3.193 | 3.275 / 3.175 | 16.8 → 16.8 | 416.7 → 233.2 | PASS A/B; inherited ≥66 ms |
| WebGPU | L10 high | 2.990 / 2.892 | 3.024 / 2.906 | 16.8 → 16.8 | 50.1 → 116.6 | FAIL: max > PROD+1 frame, new >=66 ms spike |
| WebGL2 load | L4 low | 8.092 / 3.205 | 5.776 / 3.173 | — | — | PASS |
| WebGL2 load | L4 high | 3.976 / 3.474 | 3.825 / 3.571 | — | — | PASS |
| WebGL2 load | L5 low | 7.359 / 3.040 | 7.776 / 2.793 | — | — | FAIL: cold load |
| WebGL2 load | L5 high | 2.840 / 2.577 | 2.908 / 2.640 | — | — | PASS |
| WebGL2 load | L6 low | 6.591 / 1.974 | 6.909 / 1.994 | — | — | FAIL: cold load |
| WebGL2 load | L6 high | 2.458 / 2.323 | 2.522 / 2.353 | — | — | PASS |
| WebGL2 load | L10 low | 7.443 / 3.557 | 7.893 / 3.509 | — | — | FAIL: cold load |
| WebGL2 load | L10 high | 3.541 / 3.107 | 3.542 / 3.143 | — | — | PASS |
| Moment | L1 full accident-to-shutter route low | — | — | 16.8 → 16.7 | 16.8 → 33.3 | PASS |
| Moment | L1 full accident-to-shutter route high | — | — | 16.8 → 16.7 | 66.7 → 66.7 | PASS A/B; inherited ≥66 ms |
| Moment | L1 shutter closure (-0.5/+2 s) low | — | — | 16.8 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L1 shutter closure (-0.5/+2 s) high | — | — | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L3 fresh handgun/armory, full 60 s low | — | — | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L3 fresh handgun/armory, full 60 s high | — | — | 16.7 → 16.8 | 50.0 → 50.1 | PASS |
| Moment | L3 old tick 1031 ±60 ticks low | — | — | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L3 old tick 1031 ±60 ticks high | — | — | 16.7 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L10 charge 43/60 low | — | — | 16.7 → 16.8 | 16.8 → 33.3 | PASS |
| Moment | L10 charge 43/60 high | — | — | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L10 charge 55/60 low | — | — | 16.7 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L10 charge 55/60 high | — | — | 16.7 → 16.8 | 16.7 → 33.2 | PASS |
| Moment | L3 station-defense matrix route high | — | — | 16.7 → 16.7 | 16.8 → 16.8 | PASS |

## Failure attribution and diagnostics

- **L5 low WebGPU cold:** initial 5.543 s vs 4.991 s; +0.551 s, 51 ms beyond the relative allowance. HUD completion → loading-card closure is 886 ms candidate vs 441 ms PROD, accounting for 445 ms of the 551 ms difference; scene warm-up adds 82 ms. A separate CPU-profiled diagnostic measured 2.654/2.667 s candidate vs 2.623/2.578 s PROD. Both build 272 material graphs; the final instrumented GPU fence is approximately 16 ms on each. This localizes the original excess to the final first-frame/fence tail and is consistent with first-use driver/cache cost; a candidate-only source cause is unproven. The initial FAIL is retained.

- **L7 low WebGPU warm:** initial 3.529 s vs 2.362 s; +1.167 s. Civilian preparation is 1.708 s vs 0.655 s, with actor readiness 1.253 s vs 0.206 s; the overlapping actor wait explains about 1.05 s. The separate profile reproduced the long civilian wait on **PROD** (1.572 s) while candidate was 0.801 s; total warm loads were 3.389 s PROD and 2.782 s candidate. The same delivered civilian worker bundle is used on both sides, and traced prebuilt worker jobs complete in roughly 0.25 s. The profile shows a main-thread idle wait rather than an extra CPU bake hotspot. The stalled asynchronous readiness dependency remains unresolved; this is reported without a speculative code change or replacing the original FAIL.

- **L7 high WebGPU cold:** initial 7.543 s vs 3.658 s; +3.885 s, also above the 6 s absolute limit. Compilation is 3.446 s vs 1.107 s; scene warm-up is 4.217 s vs 1.847 s, civilian readiness 1.962 s vs 1.251 s, and HUD completion → card closure approximately 881 ms vs 106 ms. The separate high-tier diagnostic is 3.081/3.076 s candidate vs 3.003/2.994 s PROD. This localizes the excess to first-use shader/driver work and asynchronous actor readiness; no candidate-only source cause was isolated. The original FAIL is retained.

- **L10 high WebGPU gameplay:** 116.6 ms vs 50.1 ms: relative maximum and new ≥66 ms rules fail. The 43/60 and 55/60 charge windows themselves pass. Late spikes occur at charge ~47–55 s and after charge reaches 60. A candidate CPU diagnostic repeats the same simulation ticks: the 250 ms profiled frame at tick 63232 contains ~124 ms GC and ~111 ms aggregate `CorpseLayout.place`; another 83.3 ms frame contains ~68.8 ms placement. At charge-complete tick 63682, the 133.3 ms profiled frame contains ~109 ms `saveCampaign`, including ~78 ms save encoding/write and ~48 ms fflate deflation. These profiled maxima are excluded from the table. Unbounded navigation is ≤1 ms and frozen-pose bakes ≤1.9 ms in that diagnostic. The paired diagnostic records comparable ~1,130-entity / 5.5 MB JSON saves, but candidate encoded storage is 1.47 MB vs PROD 1.00 MB. Fix70 (`ed1858d`) widened dense-pile search from 5 to 20 rings (epilogue 10 to 22), explaining the new placement cost; save compression already uses level 1. Preserving pile spread, all bodies and synchronous checkpoint persistence requires broader work than a verified small fix. Exact CPU-window samples and per-body timings are retained.

- **WebGL2 low cold L5/L6/L10:** candidate 7.776/6.909/7.893 s vs PROD 7.359/6.591/7.443 s. Each passes the relative +0.5 s rule and fails the absolute 6 s rule; warm loads pass. Both builds spend most of the first-visit load in scene/shader warm-up: candidate 5.810/5.515/4.829 s vs PROD 5.680/5.466/4.646 s. L10 also records ~1.36 s of driver warm-up on each. A separate L5 diagnostic drops to 2.871/2.915 s candidate vs 2.839/2.858 s PROD after earlier visits, consistent with first-use compilation/driver-cache cost. This diagnostic is not an acceptance replacement. These inherited absolute-budget failures remain open; moving required compilation into gameplay or reducing content is not a qualified fix.

- **Inherited L8 low hitch:** 166.7 ms candidate vs 166.5 ms PROD. Both occur at native tick 5047, with a late `corpse_pal_picketWhite` material build at approximately +24.1 s. This is inherited under the relative rule and remains an absolute ≥66 ms hitch. Other inherited maxima are labelled in the table and exact material/event timestamps remain in the frame archive.

The 28 requested matrix cells are **21 PASS / 7 FAIL**; all **13 moment rows PASS** under the relative rules. No game fixes have been made in this lane. Diagnostics are excluded from acceptance selection. All initial load failures remain visible even where later diagnostic timings are faster.

## Evidence and reproduction

- [Matrix and complete load phase receipts](matrix.json).
- [Exact native frame/charge traces, route state, sample counts and event/build timelines](frames.json).
- [Exact fresh L1/L3 moment frames and events](moments-sources.json).
- [Load diagnostics, graph/worker/asset timings and CPU profile summaries](diagnostics.json).
- [Exact L10 CPU failure-window samples, attribution and save payload comparison](l10-attribution.json).
- [Independent coverage/verdict audit](audit.json) and [evidence checksums](evidence-manifest.json).
- [Mirrored deployment ledger](mirror.json), [asset-version audit](asset-version-audit.json) and [request/hash audit](request-audit.json).
- [Quiet admissions](conditions.json), [completed run commands](runs.json), [raw-source hashes](raw-manifest.json) and [cleanup receipt](cleanup.json).
- [Build identities, source hashes, instrumentation hashes and reproducible harness sources](provenance.json).

The deployment mirror contains 2,756 files / 536,255,921 bytes. All 2,074 embedded asset-version paths were present and matched their expected SHA-256 prefix. A broad literal crawl also found source/authoring paths and template strings that return the live SPA HTML fallback; these are not substituted for runtime files. All 2,756 mirrored files were rehashed against the downloaded ledger. The combined local server audit contains 74,279 requests with zero missing responses; all 1,248 requested PROD paths are covered by that mirror. The 38,287 selected-load network receipts have zero bad responses or external URLs. Legacy `L1 ...` measure labels are emitted by the common warm-up helper on every level; they do not imply a mixed-level build.

The pruned checkout lacks the historical perf3/perf4 reports. The surviving `docs/reports/fix51-perf2/README.md` and the parent workspace’s perf3/perf4 briefs recover the exact matrix, moment inventory and pass rules. Native/load commands are the existing `tools/qa/release-ab-load.mjs`, `tools/qa/release-ab-browser.mjs strips`, and `tools/perf/fix51-moments.ts`; complete invocation/orchestration sources are retained in provenance.

Production build passed its public-hook exclusion check (19 HTML/JS files). The independent audit verifies all 41 verdicts, 40 ≥60 s native traces (minimum 60.103 s), 112 correctly sourced/tiered menu loads, and all eight fresh L1/L3 source runs. Each L3 run starts at tick 0, completes armory at tick 267 and includes a real handgun shot. The fresh L3 runner uses a 60 s wall-clock loop; the last sampled RAF can precede its endpoint by less than one frame. Two native traces and four fresh-route traces retain an initial clock-origin offset (−0.5 to −4.2 ms) before their first physical frame; excluding those first samples does not change max or p95. All later deltas are positive; each offset is listed in the audit. No gameplay source, counts, quality, specs or dependencies were changed. Static game gates were not rerun for this report-only change. No deploy or push.

Raw outputs and the local mirror are removed after retaining the listed evidence; owned preview servers on 4901/4902 are stopped. See the cleanup receipt.
