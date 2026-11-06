# perf7b — remaining L10 high WebGPU hitch

**PASS — both native confirmations and all requested gates pass.** Candidate `9af4c3a`, public bundle `index-CI0_a6tt.js`. This follows the [part 1 report](../perf7/README.md); the seven merged load fixes are outside this follow-up's measurement scope.

## Verdict

Milliseconds; two predeclared, unprofiled 90-second candidate captures, each in a fresh browser context. Both include the original minute, the charge-complete checkpoint, and another 30 seconds. The requested baseline maximum is 66.7 ms and its one-frame limit is 83.4 ms. A fresh 90-second PROD control is also retained, with a 50.1 ms maximum. Both candidate runs also satisfy the tighter fresh-PROD + one-frame comparison and have **zero ≥66 ms frames**.

| Capture | Duration s | p95 ms | Max ms | First minute max ms | After 60 s max ms | ≥66 ms frames | Verdict |
|---|---:|---:|---:|---:|---:|---:|---|
| Fresh PROD control | 90.166 | 16.8 | 50.1 | 50.1 | 16.8 | 0 | Control |
| Candidate 1 | 90.129 | 16.8 | 50.1 | 50.1 | 16.8 | 0 | PASS |
| Candidate 2 | 90.200 | 16.8 | 50.0 | 50.0 | 16.8 | 0 | PASS |

At **tick 62622 / charge 2595**, candidate frames are **16.7 / 16.6 ms**. Both runs have zero page errors and zero loading/level/result-boundary frames. Each preserves 1,133 entities in both current and checkpoint snapshots; the encoded save length is 2,769,952 characters.

## Attribution and changes

The requested tick 62622 / charge 2595 was sampled explicitly. The original large pause did not recur at that exact simulation tick: GC timing moved across runs. Tracing from page load caught a **107.1 ms major GC at 44.44 s**, inside the main RAF callback before the instrumented simulation/view phases. A matched detailed trace later isolated a 93.3 ms pause: approximately **40.4 ms waiting for cleanup** (38.3 ms external-string-table work on a background thread) and **43.1 ms external weak-global-handle processing**. Ordinary marking was 1.8 ms and evacuation 2.7 ms. These nested intervals are not added together. Assault admission, roof queries and material builds had no matching long span.

A native macOS sample was attempted; Chromium's internal symbols are stripped, so its nearest-export labels are not treated as resource attribution. Diagnostics are excluded from acceptance.

The selected fixes are:

- **Corpse search:** reject heights that cannot improve the current winner before route sweeps and support samples. Initial admission, fallback geometry, search order and all bodies remain. A moving courier invalidating a yielded winner restarts the bounded search. In 400 direct real-navigation cases, sweeps fall 14,611 → 1,616, clearance checks 387,251 → 23,011 and support samples 211,127 → 31,060, with identical poses. Including frame-budgeted cases gives 800 exact comparisons. Sampling falls **10.29 → 9.46 GB / 60 s** (8%); this alone still produced 100 / 99.9 ms native frames and is not credited as a complete fix.
- **HUD native strings:** retain requested values for UI-owned attributes and inline styles instead of reading native DOM strings back every frame. The before counter observes 504,666 CSS reads and 532,552 attribute reads in 20 seconds. The cache counter has zero CSS reads and 2,412 attribute reads. Minimap world-coordinate attributes are now compiled into QA builds only; rendered pin positions, flags and all 256 threat-pin slots remain. The final counter confirms **0 CSS reads / 2,414 attribute reads** over 20 seconds, zero public coordinate attributes, and all **518 pooled minimap nodes** retained at high tier.
- **Checkpoint copy:** reuse the existing `cloneData` plain-data copier for the live campaign copy. The actual 5,538,715-character payload benchmark is 7.6–8.1 ms versus 14.2–21.1 ms for `structuredClone`; contents and independent current/checkpoint snapshots are checked. The final native charge-complete saves take **38.2 / 38.1 ms** in total, including snapshot capture and storage write.

The clear-segment and argument-scratch experiments did not remove the native hitch and were reverted. All failed native captures remain in [attempts.json](attempts.json), including the HUD-only 66.7 ms late frame. An incomplete search capture and incomplete diagnostic are explicitly marked aborted. The typed-array-constructor counter failed before gameplay and is recorded as an instrumentation failure. One earlier launch timed out because the preview held the prior build’s file index; it was retried after restarting the server.

No entity, corpse, spawn, visual tier, resolution, texture or geometry budget was reduced. No dependencies or specs changed.

## Validation

| Gate | Result |
|---|---|
| Typecheck | PASS, both configurations |
| Lint | PASS |
| npm test, max 4 workers | PASS, 107 tests / 27 files |
| scene:gate | PASS, 50/50 |
| qa:threat, run alone | PASS, 0 acceptance flags |

Additional proofs: 800 exact placements with real walls and parked/moving hulls, another 800 comparisons against the original layout, a moving-courier bound-invalidation case, and **2,000 identical DOM state comparisons** including fractional CSS rounding. QA coordinate probes remain present in QA builds. The public build passes hook exclusion.

## Method and retained evidence

Apple M4, headless Chromium 153.0.8010.12, native Metal WebGPU, high tier, 1280×720, DPR 1, seed 1. One context at a time under `quiet-run`; no concurrent tests/builds during performance captures. Threat runs alone. Public gameplay uses the same bootstrap-only Game exposure and common adapter on candidate and the verified live batch-54 mirror. PROD bundle SHA-256 is `c23aa36a5b56cc4dc64d97a63125ad66008b5727f20cd6e841143c73e1cc54e4`. All **2,756 mirror files / 536,255,921 bytes** were rehashed and match the part-1 deployment ledger. The final server audit has **2,291 requests**, zero bad responses. All recorded PROD request paths are covered by the mirror.

[Native traces](native.json) · [Summary/table inputs](summary.json) · [Failed attempts](attempts.json) · [GC/resource diagnostics](diagnostics.json) · [Allocation stacks](allocation.json) · [Proofs](proofs.json) · [Gates](gates.json) · [Builds/harness sources](provenance.json) · [Commands](runs.json) · [Quiet admissions](conditions.json) · [Mirror](mirror.json) · [Request/cleanup audit](cleanup.json).

Raw profiles, saves, screenshots and the owned mirror are removed after retaining JSON evidence; owned preview servers are stopped. No deploy or push. This is a targeted single-machine confirmation, not a universal worst-case latency bound.
