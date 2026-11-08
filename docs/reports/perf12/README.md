# perf12 — batch 60 performance vs live batch 59

**perf pending: 15/15 original matrix cells, 9/9 event windows, 1/9 added native route cells.**

The orchestrator ended the quiet-window wait because PO testing and seven concurrent lanes will keep the Mac busy for the next hours. All completed final measurements pass. Eight added route cells and the complete-frame SSR cost diagnostic remain **perf pending**.

Fresh public candidate source `619896aefe614af28199c192bacd8ee22a624545`, bundle `index-DajticFx.js`, SHA-256 `75e4d4d1bcb154003f80d47419da594c4f4801cb46e81535277f23ab33bc69e0`. Control: live PROD batch 59 mirror, bundle `index-Dk-iL-FG.js`, SHA-256 `61043483d030ec6be950a50c4de5d2d3d1301106df7a6ac18c2eaa0b1bbf29e0`.

## Verdict table

Loads are cold/warm seconds. Frame values are milliseconds, PROD → candidate.

| Scope | Cell / moment | PROD cold / warm s | Candidate cold / warm s | p95 ms P → C | Max ms P → C | Verdict |
|---|---|---:|---:|---:|---:|---|
| webgpu | L1 low | 1.960 / 1.878 | 1.961 / 1.913 | 16.7 → 16.7 | 33.4 → 33.4 | PASS |
| webgpu | L3 low | 3.040 / 3.026 | 3.041 / 2.977 | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| webgpu | L4 low | 3.256 / 3.011 | 3.257 / 3.094 | 16.7 → 16.7 | 416.7 → 33.4 | PASS |
| webgpu | L5 low | 2.624 / 2.544 | 2.656 / 2.560 | 16.7 → 16.8 | 33.4 → 33.4 | PASS |
| webgpu | L7 low | 2.758 / 2.727 | 2.808 / 2.694 | 16.7 → 16.8 | 50.1 → 33.4 | PASS |
| webgpu | L10 low | 3.276 / 3.160 | 3.492 / 3.427 | 16.7 → 16.7 | 33.4 → 16.8 | PASS |
| webgpu | L1 high | 1.960 / 1.806 | 1.911 / 1.856 | 16.7 → 16.7 | 33.4 → 33.3 | PASS |
| webgpu | L3 high | 2.725 / 2.689 | 2.856 / 2.778 | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| webgpu | L4 high | 3.574 / 3.458 | 3.723 / 3.608 | 16.8 → 16.8 | 50.0 → 33.4 | PASS |
| webgpu | L5 high | 2.490 / 2.390 | 2.523 / 2.488 | 16.7 → 16.8 | 33.4 → 33.4 | PASS |
| webgpu | L7 high | 3.490 / 3.324 | 3.406 / 3.406 | 16.7 → 16.8 | 49.9 → 50.0 | PASS |
| webgpu | L10 high | 3.008 / 2.957 | 3.241 / 3.089 | 16.8 → 16.8 | 100.1 → 50.0 | PASS |
| webgl2 | L1 low | 2.211 / 2.060 | 2.193 / 2.127 | — | — | PASS |
| webgl2 | L4 low | 3.309 / 3.202 | 3.375 / 3.359 | — | — | PASS |
| webgl2 | L7 low | 2.991 / 2.889 | 3.042 / 2.975 | — | — | PASS |
| Moment | L1 handover/outbreak low | — | — | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L1 handover/outbreak high | — | — | 16.7 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L7 pickup low | — | — | 16.7 → 16.7 | 16.8 → 16.7 | PASS |
| Moment | L7 first rocket low | — | — | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L7 pickup through first rocket low | — | — | 16.8 → 16.7 | 16.8 → 16.8 | PASS |
| Moment | L7 pickup high | — | — | 16.7 → 16.7 | 16.7 → 16.7 | PASS |
| Moment | L7 first rocket high | — | — | 16.7 → 16.7 | 16.7 → 16.7 | PASS |
| Moment | L7 pickup through first rocket high | — | — | 16.7 → 16.7 | 16.7 → 16.7 | PASS |
| Moment | L10 charge through completion (+2 s) high | — | — | 16.8 → 16.8 | 100.1 → 50.0 | PASS |

## Added route coverage

| Native minute | Tier | p95 ms P → C | Max ms P → C | Sampled path m P → C | Verdict |
|---|---|---:|---:|---:|---|
| L10 R4 military crossing | low | — → — | — → — | — → — | perf pending |
| L10 R4 military crossing | high | — → — | — → — | — → — | perf pending |
| L10 R6 southern forecourt | low | — → — | — → — | — → — | perf pending |
| L10 R6 southern forecourt | high | — → — | — → — | — → — | perf pending |
| L10 complex approach | low | — → — | — → — | — → — | perf pending |
| L10 complex approach | high | — → — | — → — | — → — | perf pending |
| L9 open drive | low | — → — | — → — | — → — | perf pending |
| L9 open drive | high | — → — | — → — | — → — | perf pending |
| Wet L1 / SSR active | high | 16.7 → 16.7 | 33.3 → 33.3 | 0.0 → 0.0 | PASS |

## Causes and fixes

The initial public load sweep on `f3e603fb` fails four absolute limits: L7 high WebGPU cold **6.657 s**, and low WebGL2 L1/L4/L7 cold **7.460 / 6.028 / 9.110 s**. PROD is slower in every one of those cells; inherited cost does not waive the candidate’s 6 s limit. The twelve completed initial near-scene captures are retained; the next heavy-scene admission was deliberately stopped before a capture began to validate the repair with a complete final matrix.

The separate L1 cold CPU profile reproduces **6.586 s** and attributes **1768.7 ms** of sampled time to `getProgramParameter`, including **1453.3 ms** through the nested transparent draw. Pipeline attribution identifies first-use post-processing programs and actual pet/character surfaces outside the earlier scene compilation. These diagnostics locate work; none supplies a verdict.

The repair discovers cold pipelines in the real warm-up render contexts, queues their native links asynchronously, then replays the complete draws after linking. The final foreground readiness draw does the same for surfaces exposed by unfreezing. Scene geometry, every warm-up variant and both instancing paths remain present. Gameplay restores the original backend methods. This changes loading preparation; no model, population, effects, quality tier or acceptance limit is reduced.

One cause commit: `619896ae` — Prepare cold warm-up pipelines before their first real draw. Focused WebGL2 cold diagnostics move synchronous links **14→2 (L1), 10→5 (L4), 13→8 (L7)** while conserving total linked programs **107 / 118 / 105** on both sides. All **2,074 asset-version paths** are unchanged. Shared GPU contract checks cover waiting, complete replay, frame renewal and hook restoration. The residual synchronous programs are reported; no claim of zero cold shader work is made.

An earlier material-state prototype hit an uninitialized framebuffer-copy error; its revision was discarded. A corrected version of that prototype added unused preparation without reducing the synchronous link count and was also discarded. Only the direct warm-up draw repair above is committed. Failed and diagnostic attempts remain identified in the command ledger.


### SSR complete-frame cost — perf pending

Partial paused wet L1 high on/off diagnostic: per-pass inventory only; nested timestamp sums overlap and supply no whole-frame cost or performance verdict.

Complete-frame SSR cost diagnostic remains unmeasured. Nested pass sums overlap and do not supply a whole-frame cost.

## Method and limits

Apple M4 / macOS 26.5.1 (25F80), Chromium 153.0.8010.12 / Playwright 1.63.0. Headless native Metal WebGPU and ANGLE Metal WebGL2, 1280×720, DPR 1, seed 1. Timing commands enter through `tools/perf/quiet-run.sh`, with exclusive browser admission, host load below 3 at admission, no busy foreign work and one context at a time.

The first added-route reservation expired at the 600 s cap during host preflight while foreign r12 checks were active. No timing child or capture started. The terminal command receipt and wait conditions are retained. The retry waited outside reservations and was stopped by the orchestrator before admission.

Cold means an isolated context; warm is its reload. GPU/driver caches remain shared; the link census supplies the causal evidence. Original public menu bytes measure level-button click to loading-card closure. G-01 checks Begin mission on L1 low WebGL2 cold. Gameplay exposes only the existing Game instance at bootstrap and uses the same current-source test adapter on both public bundles. Each side retains its own native simulation, rendering and content. CPU-profiled diagnostics never supply a verdict. A read-only long-task observer is installed on both sides.

All original WebGPU cells cover at least 60 seconds of native gameplay; both L1 tiers and L10 high cover at least 90 seconds. The complete bot supplies ordinary InputFrames, with courier survival protection. L1 withholds terminal exit movement to retain the level. L7 pickup/rocket and L10 charge run natively. The unexecuted L10 harness is prepared to walk the authored route to each checkpoint, then supply ordinary movement frames along the crossing lines with native combat. The unexecuted L9 harness is prepared to use ordinary steering/throttle on the open route. The wet L1 high scene runs native rain/weather after 4,000 preparation ticks, with SSR active for the candidate minute.

L1 handover/outbreak ends two seconds after infected exit. L7 pickup runs from 100 ms before collection to 250 ms after; first rocket runs from 100 ms before firing through 250 ms after native impact; the combined window spans both. L10 charge includes first completion plus two seconds. Every full frame interval overlapping each window is included.

Unchanged rules: candidate cold and warm each ≤6 s and ≤PROD+0.5 s; p95 ≤PROD+1 ms; max ≤PROD+one 60 Hz frame (16.7 ms plus 0.1 ms quantization tolerance). A new ≥66 ms maximum fails when PROD is below 66 ms. Inherited hitches remain visible. Single paired captures describe these routes and hardware, and do not certify all devices or routes.

## Validation and evidence

- `npm run typecheck`: PASS (12.2 s).
- `npm run lint`: PASS (8.2 s).
- `npm run test:unit`: PASS (45.4 s).
- `npm run verify -- E18`: PASS (47.1 s).

Independent evidence integrity audit: PASS, 554 checks. Overall performance status: perf pending. The E18 command is the repository’s current change gate; this report does not claim a rerun of every historical device criterion.

[Cause profile and link census](attribution12.json) · [Focused load receipts](diagnostic-loads.json) · [Matrix and event indices](matrix.json) · [Loads and network receipts](loads.json) · [Native frames and events](native.json) · [Added route verdicts](extras.json) / [frames](extra-native.json) · [Build](build.json) · [Provenance and executable harness sources](provenance.json) · [Commands](runs.json) · [Quiet admission](conditions.json) / [host waits](host-waits.json) / [orchestrator stop](capture-status.json) · [Validation](validation.json) · [Independent audit](audit.json) · [Mirror ledger](mirror.json) / [rehash](mirror-audit.json) · [Asset versions](asset-version-audit.json) · [Runtime request audit](request-audit.json) · [Final live identity](live-control-final.json) · [Cleanup](cleanup.json) · [Checksums](evidence-manifest.json).

## Cleanup and reproduction

Restore the embedded harness sources from `provenance.json` to their recorded paths, adjusting absolute imports for a different checkout. `restore-batch59.mjs` restores the pinned control from its ledger and stored original index, rejecting unavailable or changed bytes. Build the recorded candidate with `build-public.mjs`, run `serve.mjs` on 4901/4902, and run the recorded commands with `BROWSER_POOL_JOB_ID=perf12 MI_SLUG=perf12`. `summarize.py final`, `package12.py`, and `audit12.py` recompute the retained verdicts.

Owned raw output and candidate build deleted: 5714 raw files, 2772 build files. Owned preview servers stopped and browser reservations released. The shared browser pool remains running. No deploy or push.
