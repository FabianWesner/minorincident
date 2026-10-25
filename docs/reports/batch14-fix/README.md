# Batch14 regression fixes

- L7: distant follower goals snapped back to the same building wall; connected crowd routes fix the stall. L6 now carries story injury explicitly instead of classifying slow pedestrians as injured. [Route proof](l7-route.json).
- Same 22-survivor L6-end save, base / zebra / fix: survivor casualties 22 / 21 / 19 (fatal bites); player deaths 1 / 0 / 3. Individual causes and checkpoint revivals are recorded in the [comparison](l7-comparison.json).
- Alive/drawn infected samples: 548/548, 542/542, 837/837; frame p95 16.7 / 16.8 / 16.8 ms (max 83.4 / 83.4 / 116.7 ms). No missing draws or texture render-cost regression was observed.
- L10: nearest-clear staging could trap the Mega inside a factory pocket; staging now requires a body-clear approach at the authored distance. Aim assistance preserves deliberate rocket lead, removing a measured 1.6 m miss at 9 m. [Staging](l10-staging.json), [combat vectors](l10-projectile-aim.json).
- Physical-input probes won on base/fix with zero deaths but bypassed staging; the actual failed-save replay now finishes in 201 s with zero deaths. [Replay](l10-failed-save-replay.json). This does not establish a bot-only fault.
- Also fixed expired stagger blocking resumed input, L4 guidance pointing through furniture, and L3 evacuation hiding which officer was approaching. Seven new regression cases passed; existing thresholds are unchanged. [Tests](regression-tests.json).
- Exact unattended campaign: 10/10 finished, no skipped objectives, P0=0, P1=0; L7/L10 deaths 0/0; L7 evacuated 17/21 survivors. [Campaign JSON](summary.json), [completion](campaign-completion.json).
- Remote: 490 files / 2,687 tests passed (existing 3 files / 9 tests skipped); typecheck/lint passed. Smoke passed 6 simulation + 31 browser tests; invariants passed 28 simulation + 12 WebGPU tests. Zebra textures and heroine retained on `lane/batch14-fix`. [Gates](gates.json).
