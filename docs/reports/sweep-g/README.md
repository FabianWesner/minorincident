# sweep-g — global acceptance sweep

In progress on base `f807c966c610489eb1f8fb4182f164485bd5dc87`. Scope: G-06–G-26, with G-25 crash reproduction first, then G-22 announcement contact and G-13 follower pace. G-01–G-05 performance and G-27 are excluded by the brief. No deploy or push.

The complete unchanged criteria and starting gaps are in [scope.json](scope.json). A short settings repro is not full G-25 console qualification.

Current evidence: QA production build and typecheck passed; current-source L4 ordinary low/high settings switches completed with zero console errors, verified 1024/2048 shadow maps and continuing sim/render. Full physical L4 low/high routes completed through the cellar and into L5 with zero console/page errors and zero objective skips. All 53 route captures and two settings-repro captures were inspected and hashed. The mortal L4 high route also completed (10 deaths/respawns, zero console/page errors, no objective skips). L1 low and L2 low completed cleanly; the remaining-level console matrix is running. No whole global row is newly closed yet.

Remaining: finish the assigned row actions, inspect and hash every capture, commit each row, rerun both tiers for every level touched by a game change, and run typecheck/lint/unit/threat gates. The final threat gate must run alone with zero flags. Raw captures are deleted after review.

G-25 evidence: [L4 low](G-25-L4-low.json), [L4 high](G-25-L4-high.json), [verified settings repro](G-25-quality-verified.json), [low capture observations](G-25-L4-low-captures.json), [high capture observations](G-25-L4-high-captures.json). Images remain under `test-results/`; they are not committed.

[Mortal L4 high receipt](G-25-L4-high-mortal.json) and [26 capture observations](G-25-L4-high-mortal-captures.json) cover the original mortal trigger context. [Cleanup manifest](capture-cleanup.json) records all 145 reviewed raw images deleted so far. The ten deaths are driver-run telemetry, not a difficulty sign-off.

Baseline console batch paused safely between routes before game fixes: nine complete level/tier cells (eight WebGPU, L3 high WebGL2), plus the mortal L4 high run and two settings probes, all with zero console/page errors. 193 generated raw images were inspected and deleted; see per-cell capture manifests. These are source `095bc361…` baseline receipts, not final-source G-25 closure. The final registered matrix still needs all 20 WebGL2 level/tier cells.

G-13: current high Dale pace fails (93.59% search, 94.58% metro). Exact intentional far-follower waiting passes: 0.748% low, 0% high; both read-only traces match canonical state hashes and medians. One pace-floor trial was reverted after high pace regressed to88.43% and Mia turned in both tiers. See [diagnosis](G-13-diagnosis.json) and [rejected trial](G13-after/REJECTED.json).
