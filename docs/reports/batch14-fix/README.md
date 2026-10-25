# Batch14 campaign fixes

- Base: `lane/batch14` (`2b740072b`); game fixes are committed with regression tests for survivor routing, combat, staging, resume and navigation feedback.
- L7: short follower goals inside buildings snapped back to the current wall forever; connected crowd routing fixes this. L6 now carries the actual injury flag instead of treating slow pedestrians as injured. [Route evidence](l7-route.json).
- Same 22-survivor L6-end save: base / zebra / fix retained 0 / 1 / 3 survivors, with 1 / 0 / 3 player deaths. Per-survivor bite histories and checkpoint-revival context are retained in [comparison](l7-comparison.json).
- L7 on-screen alive/drawn samples: 548/548, 542/542, 837/837; frame p95: 16.7 / 16.8 / 16.8 ms. No missing draws or material render-cost regression was observed.
- L10: finale staging could put the living boss in a clear but unreachable factory pocket; staging now requires a body-clear approach. Hitscan aim assistance also erased projectile lead; assistance now preserves deliberate projectile lead while retaining Default assistance. Resume also clears stale combat stagger when the clock restarts. At the Mega's cruise speed this removed a measured 1.6 m aiming error at 9 m. [Production combat vectors](l10-projectile-aim.json).
- Visible-target, physical mouse/Space/WASD boss probes won on [base](l10-humanlike-base.json) and [fix](l10-humanlike-fix.json) with zero deaths; these east-of-console fixtures bypassed the later-discovered staging fault.
- Exact unattended full campaign: pending final receipt.
- Remote unit+levels, smoke, invariants: pending final receipts; focused 47 tests, typecheck and lint are green.
- Zebra textures and heroine assets are retained; regression tests were added; thresholds, specifications and deployment were unchanged.
