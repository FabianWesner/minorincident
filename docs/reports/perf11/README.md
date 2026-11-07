# perf11 — batch 59 performance vs live batch 58

**FAIL: 14/15 matrix cells and 9/9 named event windows.** Candidate source `ff25c4564cedab37d22a024cf325ff0d589dd8e0`. All results below come from the full unprofiled paired run.

Candidate: fresh `MI_BUILD_CACHE=off npm run build`, bundle `index-DgMj9Bal.js`, SHA-256 `18c0c4e692fa898fdf92f4ad18bcbc2379cb8e065d2cc6269db05aac2556defb`. Control: fresh [live PROD](https://minor-incident.com/) batch 58 mirror, bundle `index-CdXy3RC5.js`, SHA-256 `7d885c228ca34b0ad77a95db36111b4c36786262b58dbbd2339a530f8383e3da`.

## Verdict table

Loads are cold/warm seconds; frame values are milliseconds, PROD → candidate. All WebGPU cells cover at least 60 seconds of native gameplay; both L1 tiers and L10 high cover at least 90 seconds.

| Scope | Cell / moment | PROD cold / warm s | Candidate cold / warm s | p95 ms P → C | Max ms P → C | Verdict |
|---|---|---:|---:|---:|---:|---|
| WebGPU | L1 low | 1.977 / 1.945 | 1.977 / 1.947 | 16.8 → 16.7 | 33.3 → 33.2 | PASS |
| WebGPU | L3 low | 3.144 / 3.061 | 3.092 / 3.026 | 16.7 → 16.7 | 16.8 → 16.8 | PASS |
| WebGPU | L4 low | 3.276 / 3.160 | 3.260 / 3.160 | 16.7 → 16.7 | 33.3 → 33.4 | PASS |
| WebGPU | L5 low | 2.708 / 2.678 | 2.743 / 2.626 | 16.7 → 16.8 | 50.0 → 33.4 | PASS |
| WebGPU | L7 low | 2.859 / 2.778 | 2.859 / 2.627 | 16.7 → 16.8 | 50.0 → 50.0 | PASS |
| WebGPU | L10 low | 3.310 / 3.212 | 3.325 / 3.227 | 16.7 → 16.8 | 50.0 → 83.4 | FAIL |
| WebGPU | L1 high | 1.910 / 1.807 | 1.895 / 1.873 | 16.8 → 16.7 | 33.4 → 33.4 | PASS |
| WebGPU | L3 high | 2.740 / 2.708 | 2.741 / 2.690 | 16.7 → 16.7 | 33.3 → 33.4 | PASS |
| WebGPU | L4 high | 3.643 / 3.643 | 3.775 / 3.627 | 16.8 → 16.7 | 33.4 → 50.0 | PASS |
| WebGPU | L5 high | 2.558 / 2.476 | 2.593 / 2.478 | 16.8 → 16.8 | 50.1 → 49.9 | PASS |
| WebGPU | L7 high | 3.442 / 3.428 | 3.475 / 3.393 | 16.7 → 16.7 | 66.7 → 50.0 | PASS |
| WebGPU | L10 high | 3.110 / 3.127 | 3.093 / 3.094 | 16.8 → 16.7 | 66.7 → 50.0 | PASS |
| WebGL2 load / G-01 | L1 low | 2.244 / 2.145 | 2.159 / 2.279 | — | — | PASS |
| WebGL2 load | L4 low | 3.409 / 3.359 | 3.392 / 3.289 | — | — | PASS |
| WebGL2 load | L7 low | 2.976 / 2.871 | 2.958 / 2.891 | — | — | PASS |
| Moment | L1 handover/outbreak low | — | — | 16.8 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L1 handover/outbreak high | — | — | 16.8 → 16.7 | 33.4 → 33.4 | PASS |
| Moment | L7 pickup low | — | — | 16.8 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L7 first rocket low | — | — | 16.8 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L7 pickup through first rocket low | — | — | 16.8 → 16.8 | 16.8 → 16.8 | PASS |
| Moment | L7 pickup high | — | — | 16.7 → 16.7 | 16.8 → 16.7 | PASS |
| Moment | L7 first rocket high | — | — | 16.7 → 16.7 | 16.8 → 16.7 | PASS |
| Moment | L7 pickup through first rocket high | — | — | 16.7 → 16.7 | 16.8 → 16.7 | PASS |
| Moment | L10 charge through completion (+2 s) high | — | — | 16.8 → 16.7 | 66.7 → 50.0 | PASS |

## Findings and fixes

- L10 low webgpu: max > PROD+1 frame, new >=66 ms spike.

The first matrix on `0f85e3c8` had **14/15 cells and 8/9 windows passing**. Its L1 high candidate frame reached **83.3 ms** at recorded tick **4973**, about **41.670 s** into the capture during handover, versus 33.3 ms on batch 58. That unprofiled frame has no CPU timeline. Separate profiles at the same handover point locate long tasks in first-use WebGPU attribute/buffer creation. The focused control trace reproduces a **100.0 ms** frame: the clinic annex's **2,894,204-vertex** static body uploads **81.0 MB**, spending **85.7 ms** in those uploads.

A real-browser preparation probe finds **62 early LOD swaps with no GPU warm callback**, including clinic LOD0, after the scene is prepared but before the deferred five-second stream begins. GPU preparation now registers when scene warm-up completes. Swap pacing registers when deferred streaming begins. The fixed probe has **zero** unwarmed early swaps.

The fixed focused trace has **zero new clinic uploads during handover**, no long tasks and a **33.3 ms** maximum. Its full 2,894,204-vertex body is still drawn with the same attribute layout. This identifies and removes the preparation gap without reducing model detail or actor population. The original failure, profiled work, unprofiled recheck and one deliberately interrupted intermediate diagnostic remain in the evidence; the final verdict uses the new full paired matrix above.

Source commit (one cause):

- `ff25c456` — Install LOD warm-up callbacks before early camera requests.

L7 living follower counts below come from a read-only roster census in the existing six-second gameplay snapshots. These counts describe the route actually timed; no actors were removed to make either side cheaper.

| L7 tier | Side | Living followers start → end | Range / samples |
|---|---|---:|---:|
| low | prod | 24 → 24 | 24–24 / 11 |
| low | candidate | 24 → 24 | 24–24 / 11 |
| high | prod | 24 → 24 | 24–24 / 11 |
| high | candidate | 24 → 24 | 24–24 / 11 |

The corpse support change was inspected because it adds up to 15 support queries per candidate and extra fallback queries. The L4/L10 timings above include native deaths, existing corpse fields and L10 streaming/charge. The new L7 opening and follower survival run in each bundle’s own simulation. No population, effects, model warm-up, LOD coverage or quality setting was reduced. A pass here is specific to these captures, rather than a guarantee that every route or driver start is hitch-free.

## Remaining failure

L10 low retains a **83.4 ms** candidate maximum at **+60.256 s**, tick **64528**, charge **3600**. No causal fix is credited for this unprofiled hitch. It fails the unchanged maximum-frame rules.

The separate CPU-profiled 70-second candidate diagnostic peaks at **50.0 ms**, tick **61232**. It records long tasks and input-cleanup timing for attribution and does not replace the original capture. The original maximum's exact cause remains unproven.

The performance verdict is **NO-GO** under the requested pass rules. [L10 frame and diagnostic attribution](tail-attribution.json).

## Validation and evidence

Functional checks run after all timing captures. A separate quiet reservation for validation was canceled before any command started after a two-minute admission wait; the four checks then ran directly. [Admission record](validation-admission.json).

- `npm run typecheck`: PASS (13.4 s).
- `npm run lint`: PASS (9.4 s).
- `npm run test:unit`: PASS (39.9 s).
- `npm run verify -- E18`: PASS (50.1 s).

The evidence integrity audit recomputed every load/frame verdict and event window from the retained evidence: **PASS, 618 checks**. `verify -- E18` is the repository’s current change gate; this report does not claim all historical E18 device criteria were rerun.

All **2,758 mirrored files (536,971,901 bytes)** were rehashed, along with **2,074 embedded asset-version paths**. Runtime requests must return 200/304 and match the mirror ledger. The crawl’s non-deployed source/template and SPA fallback refusals are retained separately in `mirror.json`. The final live identity check verifies the pinned bundle still has the original hash.

[Matrix and event indices](matrix.json) · [Initial failing matrix](initial-matrix.json) · [Initial loads](initial-loads.json) / [frames](initial-native.json) · [Warm-up attribution and geometry census](attribution.json) · [CPU attribution](cpu-attribution.json) · [L10 tail attribution](tail-attribution.json) · [Diagnostic frames](diagnostic-native.json) · [Independent unprofiled recheck](rechecks.json) · [Public loads and network receipts](loads.json) · [Native frame/event traces](native.json) · [Validation](validation.json) · [Gate receipts](gate-receipts.json) · [Independent audit](audit.json) · [Source/build and executable harness provenance](provenance.json) · [Commands](runs.json) · [Quiet admission](conditions.json) · [Mirror ledger](mirror.json) · [Mirror rehash](mirror-audit.json) · [Asset versions](asset-version-audit.json) · [Runtime request audit](request-audit.json) · [Final live identity](live-control-final.json) · [Raw hashes](raw-manifest.json) · [Cleanup](cleanup.json) · [Checksums](evidence-manifest.json).

## Method and limits

Apple M4 / macOS 26.5.1 (25F80), Chromium 153.0.8010.12 / Playwright 1.63.0; headless native Metal WebGPU and ANGLE Metal WebGL2, 1280×720, DPR 1, seed 1. Every timing command enters through `tools/perf/quiet-run.sh`, with exclusive browser admission, one-minute host load below 3, no busy foreign work and one context at a time. Cold means a fresh isolated context; warm is its reload. GPU/driver caches remain shared, so isolated cold differences do not establish a causal optimization.

Public loads measure original public bytes from level-button click to loading-card closure. G-01 checks Begin mission on L1 low WebGL2 cold. Gameplay uses the perf10 bootstrap-only Game exposure and the same current-source test-control adapter on both public bundles; each retains its own simulation, rendering and content. The complete bot supplies ordinary InputFrames; god mode prevents courier death during timing. L1 withholds only terminal exit movement to keep the level loaded. L7/L10 begin automatically. The added L7 follower census reads 24 roster entries during existing snapshots; it does not alter either simulation. No CPU-profiled or diagnostic capture supplies a verdict.

L1 covers handover through infected exit plus two seconds. L7 pickup covers 100 ms before collection through 250 ms after; first rocket covers 100 ms before firing through 250 ms after the first native detonation; the combined window spans pickup through that impact. L10 covers charging through first completion plus two seconds. Every full frame interval overlapping a window is included.

Unchanged pass rules: candidate cold and warm each **≤6 s and ≤PROD+0.5 s**; p95 **≤PROD+1 ms**; maximum **≤PROD+one 60 Hz frame** (16.7 ms plus 0.1 ms quantization tolerance); a new **≥66 ms** maximum fails when PROD is below 66 ms. Inherited hitches remain identified in the matrix.

## Cleanup and reproduction

All 2,905 owned raw files and the owned production build were deleted. Owned preview servers are stopped, browser reservations are released and the shared browser pool is left running. No deploy or push.

Restore the harness sources embedded in `provenance.json` under their recorded paths; adjust absolute native imports for another checkout. Restore the pinned control with `node test-results/perf11/restore-batch58.mjs`: it rehashes every file against `mirror.json` and uses the retained original index, refusing unavailable or changed bytes. Build the recorded source with `build-public.mjs`, start `serve.mjs` on 4901/4902, then run `BROWSER_POOL_JOB_ID=perf11 MI_SLUG=perf11 node test-results/perf11/final-batch.mjs` and `python3 test-results/perf11/summarize.py final`. Exact commands, environments, bundle hashes, source identity and harness sources are retained.
