# perf7 — targeted release performance fixes

**Performance FAIL: 7/8 targeted cells pass; L10 confirmation fails. All required gates pass. Goal not met.**

Candidate: `5f790f7`, fresh `MI_BUILD_CACHE=off npm run build`, public bundle `index-BIBEe6kP.js`. Live PROD: batch 54, `index-DSZ-4VAt.js`, SHA-256 `c23aa36a5b56cc4dc64d97a63125ad66008b5727f20cd6e841143c73e1cc54e4`. The new mirror has 2,756 files and exactly matches the perf6 deployment ledger. No runtime fallback files were substituted.

## Verdict table

Cold/warm loads are seconds. Native frame values are milliseconds, PROD → candidate. This rerun covers the failed metrics and one passing load control; previously passing gameplay cells are outside its scope.

| Metric / cell | PROD cold / warm s | Candidate cold / warm s | Native p95 / max ms P → C | Verdict |
|---|---:|---:|---:|---|
| WebGPU L5 low | 2.526 / 2.443 | 2.573 / 2.494 | — | PASS |
| WebGPU L7 low | 2.475 / 2.394 | 2.541 / 2.478 | — | PASS |
| WebGPU L7 high | 2.890 / 3.194 | 2.788 / 2.671 | — | PASS |
| WebGPU L10 high | 3.124 / 2.872 | 3.008 / 2.922 | 16.8 / 66.7 → 16.8 / 99.9 | FAIL confirmation |
| WebGL2 load L5 low | 2.794 / 2.671 | 2.825 / 2.705 | — | PASS |
| WebGL2 load L6 low | 1.975 / 1.890 | 2.024 / 1.941 | — | PASS |
| WebGL2 load L10 low | 3.443 / 3.459 | 3.543 / 3.410 | — | PASS |
| WebGPU L5 high (control) | 2.406 / 2.323 | 2.506 / 2.390 | — | PASS |

For L10, the table shows the worse of the two unprofiled candidate captures.

All selected loads satisfy both ≤6 s and ≤PROD+0.5 s for cold and warm. The previously inherited WebGL2 absolute failures did not recur in this host session. These context-cold loads share host GPU/driver caches; they do not certify clean-driver-cache startup.

## What changed and what the measurements establish

### L10 corpse placement and GC

**Status: FAIL.** The confirmation reproduced a 99.9 ms frame at 42.1 s (tick 62622, charge 2595). The first 50 ms capture is not a stable fix.

The first scratch-reuse attempt still reached 150 ms versus 50.1 ms PROD. Buffer-capacity reuse, budgeting only between whole bodies, and a shared numeric evaluator were insufficient on their own: interim native maxima remained 100–150 ms. An attempted captured-coordinate cache made no measurable allocation improvement and was reverted. These attempts remain in [attempts.json](attempts.json).

The selected implementation:

- Reuses hull, query, neighbor, layer and winning-candidate scratch, retaining backing capacity and stable query/height ordering.
- Uses one numeric evaluator and publishes validated candidate coordinates into a pose record. Legacy rejected-candidate fallback behavior is retained.
- Yields between candidate roots within a 2 ms search budget. Other bodies retain their current presentation while queued; explicit readiness drains the queue. Only one search owns shared scratch. Moving/replaced/airborne bodies invalidate suspended work, and the courier exclusion is rechecked after resuming.
- Avoids blocker entry-pair and empty roof-list allocations, removes the navigation margin closure, and retains navigation sweep substeps in numeric locals. The exact legacy circle test is retained at its boundary.

The selected native capture is 90.197 s with zero loading/level/result boundary frames: p95 **16.7 ms**, maximum **50.0 ms**. The original first minute also has a 50.0 ms maximum; 40–60 s is 50.0 ms; after 60 s is **33.3 ms**. The fresh PROD capture is 66.7 ms maximum. Candidate is also below the initial same-job PROD maximum of 50.1 ms, so the result does not rely on the earlier noisy 116–133 ms PROD captures. Both native source paths and exact commands are recorded in [provenance.json](provenance.json) and [runs.json](runs.json).

A predeclared second unprofiled 90-second candidate capture records p95 **16.8 ms**, maximum **99.9 ms**, and 0 non-gameplay frames. Confirmation FAILS the extra requirement of no ≥66 ms frame; its complete trace is retained alongside the first capture, rather than selecting the faster run.

CDP allocation sampling (16 KiB interval, including collected objects) falls from **12.75 GB to 10.22 GB**, approximately **20%** over the same 60-second native route. The shared evaluator alone reduced its self-allocation stacks from about 2.37 GB to 0.96 GB. Allocation sampling and tracing shift GC timing: the final allocation diagnostic still recorded a 133.4 ms frame. That diagnostic is **excluded from acceptance**; this is a measured native improvement, not a hard upper bound on GC pauses or every possible workload. [allocation.json](allocation.json) retains ranked stacks and profile hashes; [diagnostics.json](diagnostics.json) and [proofs.json](proofs.json) retain phase/GC and CPU-window evidence.

No bodies, simulation entities, visual tiers, textures, or spawn budgets were reduced. The final diagnostic has 973 nonhidden dead infected, 43 airborne bodies and 946 frozen crowd instances. Public QA render counters are compiled out; their zero values are not used as evidence of missing actors. Native post-60-second coverage continues the charge/combat route; it did not activate `cureFront`. Epilogue layout behavior is covered by the placement equivalence cases, rather than claimed as native cure-front coverage.

### L10 checkpoint saving

The old candidate diagnostic spent about 104 ms in `saveCampaign`, including 75 ms in save-store encoding. PROD's older store does not compress the full 5.5-million-unit checkpoint; the native quota benchmark shows that full payload fails storage. Its faster failed write is not an acceptable persistence target.

Identical current/retry snapshots now use a versioned checkpoint record that stores one snapshot and reconstructs independent copies on load. Both snapshots, campaign state and retry durability are retained. Existing plain/gzip saves remain readable; a compact-record quota failure falls back to the established gzip codec. Different snapshots retain the gzip path.

The final gameplay diagnostic writes successfully in **50.9 ms total**, including **19.1 ms** in the store. Reload verifies both 1,133-entity snapshots at tick 63677, charge 3600. Stored size is 2,769,952 units instead of a 5,538,715-unit JSON record. The isolated native store benchmark is 10.5–12.6 ms; it also verifies Unicode, losslessness, independent snapshots and successful gzip fallback under a forced 1.6-million-unit quota. The fast path applies to identical snapshots; other large records can still incur compression cost.

### L5 load-card delay

The original perf6 HUD→card tail (886 ms versus 441 ms) did not reproduce in the fresh before diagnostic. There were no `saveCampaign` calls during that measured L5 load, so synchronous save compression was not established as its cause.

The diagnostic did expose objective-ring geometry replacement in the first post-warm view update. The loading path now updates the marker before scene warm-up, so the actual radius/buffers are prepared under the card. This fixes a concrete readiness gap. Whole-view timings around that update are not attributed solely to geometry. The final cold/warm L5-low pair is 2.573/2.494 s versus 2.526/2.443 s PROD. The original 445 ms tail difference remains consistent with first-use driver/cache variance; it is not claimed as fully explained by the marker change.

### L7 compile/readiness regression

The original 7.543 s cold failure did not reproduce before editing; the new initial high-tier cold pair was 2.990 s versus 2.924 s. However, its warm load still failed: 3.422 s versus 2.805 s, with the civilian readiness wait dominating the difference.

The existing mission phase was already `playing` during initial preparation, causing initial civilian batches to enter the streaming hidden-compile queue. The high-tier diagnostic found four serialized hidden compiles, approximately 264 ms, before the full scene warm-up. An explicit scene-prepared state now lets initial batches attach for the full warm-up; later streaming still uses the serialized hidden-compile path.

The before high-tier shader diagnostic has 262/263 material graphs and 205 GPU pipelines on PROD/candidate, with no new material graph after card closure. It did not isolate gold contour, bar cap, blast fade, corpse source or smoke variants as a candidate-only late first-use list. The evidence supports removing redundant readiness/compilation work; it does not attribute the entire original 3.9 s cold excess to that 264 ms queue. Shared worker/driver readiness variance also appeared on PROD. The final L7-high pair is 2.789/2.671 s versus 2.891/3.194 s; L7-low is 2.541/2.478 s versus 2.475/2.394 s.

## Remaining work

L10 remains unresolved. A matched PROD/candidate allocation comparison is the next step to isolate remaining excess GC pressure; then the remaining hot path and both native captures must be rechecked. The brief caps this job at 2.5 hours, leaving insufficient time for another fix/build/measurement/gate cycle. Completing L10 requires a time-box extension.

## Validation

| Gate | Result |
|---|---|
| Typecheck | PASS, both TypeScript configurations |
| Lint | PASS |
| Unit | 107 tests / 27 files PASS |
| Scene gate | 50/50 PASS |
| Threat, run alone | PASS; 0 acceptance fail flags |

Placement proof: 400 direct plus 400 frame-budgeted exact pose/order comparisons against `1782d04`, including 160 dense-pile cases, 240 parked hulls, scripted/moving hulls, courier exclusion, epilogue and three airborne checks. Navigation proof: 12,000 exact movement and clearance comparisons against `2e2d3b3`, with 24 walls, eight dynamic blockers, ignored blockers and both capsule policies. No registered test-count increase: 150/150 budget remains unchanged. See [proofs.json](proofs.json).

## Method, evidence and limits

Apple M4, native Metal WebGPU / ANGLE Metal WebGL2, headless Chromium, 1280×720, DPR 1, seed 1. One browser context at a time under `tools/perf/quiet-run.sh`; no competing build, tests, or CPU job during performance captures. Low-tier loads, WebGL2 loads and the final allocation diagnostic form one sequential exclusive batch. `qa:threat` runs alone. Hardware records and admission conditions are retained.

Menu loads use original public bytes. Native gameplay uses the perf6 bootstrap-only exposure of the existing Game to the same test-control adapter on both builds; ordinary native bot InputFrames drive the route. Engine/rendering/content remain each public bundle's own. The final request audit has no 404s. Source/build hashes, mirror ledger, harness sources, commands, conditions, full selected loads/native traces, failed attempts and diagnostic excerpts are committed as JSON. Raw profiles and images are represented by hashes and selected evidence, then removed.

Pass rules: cold and warm each ≤6 s and ≤PROD+0.5 s; native p95 ≤PROD+1 ms; native maximum permits one additional quantized 60 Hz frame, with a new ≥66 ms spike failing when PROD is below 66 ms. The original minute and extended 90-second window are both retained. This is a single-machine targeted rerun with shared host caches and explicit confirmation, not a full matrix, driver-cache reset, or universal latency guarantee.

[Matrix](matrix.json) · [Loads/phases](loads.json) · [Native frames](native.json) · [Diagnostics](diagnostics.json) · [Allocation](allocation.json) · [Gates](gates.json) · [Provenance](provenance.json) · [Cleanup](cleanup.json)
