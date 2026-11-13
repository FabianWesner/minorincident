# s98 — native typical-player calibration

## Result

Added a native `typical` policy for L6, L7 and L9. It uses ordinary input frames, routes toward mission objectives, refreshes decisions at 10 Hz, and introduces limited human error: 10 Hz decision refresh, occasional L6 aim offset and fire gaps, a short wait before some L6 hatch interactions, and slower L9 throttle. The L7 policy also skips the automatic axe counter when crowded; normal weapon timing still limits fire rate. L7 now lets the ordinary player respawn lifecycle continue in the native runner and records actual elapsed ticks, deaths and survivors rescued. No gameplay data changed.

The calibration is between native complete and real-input outcomes on the measured axes. L6 is still dangerous under this policy: **mean deaths are 6.3 and mean saved share is 21.8%**. Both exceed the requested warning thresholds (>3 deaths average and <25% saved). The orchestrator should decide whether to change balance; this lane makes no balance change.

## Calibration

Times below are simulation seconds. Native L6 figures use the current worktree’s 12-second pressure interval (`src/data/l6.ts`); s97’s report describes a later 8-second interval, so its numbers are not mixed into this comparison.

| Level | Native complete | Native typical | Real-input QA receipts | Calibration |
|---|---|---|---|---|
| L6 | 0 deaths avg; 218.1 s avg; 69.0% saved avg | 6.3 deaths avg; 322.4 s avg; 21.8% saved avg | s96 HIGH: 5 deaths, 349.6 s, 1/29 saved (3.4%); s94 LOW completed in 383 s with 5 deaths; other s94/s96 runs had 8–16 deaths and some did not finish in 480–529 s | Typical sits between complete and real-input outcomes on deaths, time and the retained saved-share measure. It crosses both orchestrator warning thresholds. |
| L7 | 0 deaths; 117.2 s; 24/24 rescued | 3 deaths; 156.2 s; 22/24 rescued | Successful QA runs: 0–6 deaths, 157–302 s; s94 LOW departure capture shows 18 survivors boarded (that receipt does not retain the matching starting denominator) | Typical time and deaths fall within the QA span; 22/24 is below native complete. Survivor counts have different retained denominators. |
| L9 | 0 deaths; 184.9 s; 4/5 evacuated | 0 deaths; 205.5 s; 4/5 evacuated | Clean completions: 0 deaths, 130–214 s (s94 HIGH/LOW and z1.5); earlier LOW retry loops reached 15 deaths. The receipts do not preserve a comparable evacuated-survivor count. | Typical completion time is inside the clean real-input span. Deaths and saved count remain at the complete-policy edge because QA has no matching clean-run count. |

L7 complete and typical were measured with seed 1. L9 complete and typical used seed 1 on the authored `road` route with `detour:false`; the native runner’s default detour stalled at the approach objective after 600 s, so that diagnostic is retained in [evidence.json](evidence.json) and excluded from the calibrated pair. L6 uses seeds 1–3 at both tiers. HIGH and LOW had identical simulation outcomes in this native harness.

## L6 typical: HIGH/LOW, seeds 1–3

| Tier | Seed | Complete | Deaths | Saved | Saved share | Time (s) | First hatch closed (tick) | Full post-closure 30 s windows | Final partial window |
|---|---:|---|---:|---:|---:|---:|---:|---|---:|
| HIGH | 1 | Yes | 11 | 8/29 | 27.6% | 391.7 | 16576 | 2, 6, 55 | 0 attacks / 16 s |
| HIGH | 2 | Yes | 3 | 7/29 | 24.1% | 264.6 | 9300 | 16, 12, 31 | 0 attacks / 10 s |
| HIGH | 3 | Yes | 5 | 4/29 | 13.8% | 310.9 | 11936 | 14, 46, 39 | 0 attacks / 13 s |
| LOW | 1 | Yes | 11 | 8/29 | 27.6% | 391.7 | 16576 | 2, 6, 55 | 0 attacks / 16 s |
| LOW | 2 | Yes | 3 | 7/29 | 24.1% | 264.6 | 9300 | 16, 12, 31 | 0 attacks / 10 s |
| LOW | 3 | Yes | 5 | 4/29 | 13.8% | 310.9 | 11936 | 14, 46, 39 | 0 attacks / 13 s |
| **Mean** | — | **6/6** | **6.3** | **6.3/29** | **21.8%** | **322.4** | — | **Every full window had ≥2 starts** | — |

The window counts are starts targeting the courier or a starting survivor. Short final tails are listed separately and are not full 30-second windows. The complete-policy comparison and every raw row, including window boundaries, are in [evidence.json](evidence.json).

## Validation

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `node --import tsx/esm tools/qa/l6-pressure.ts` with `L6_POLICIES=typical`, HIGH/LOW, seeds 1–3 — PASS as a measurement run; 6/6 completed, and the data thresholds are explicitly flagged above.
- `sh tools/remote/run.sh "$PWD" -- npm test` — PASS on 46.225.66.90: 27 files, 106 tests passed / 1 skipped, unchanged 150/150 inventory; 218.9 s within the 240 s budget. Earlier sandbox/network attempts were superseded by this successful run. Local `npm test` also passed 27 files / 107 tests in 98.1 s.
- No browser run, gameplay-data change, deploy, push or main movement.

## Real-input sources and limits

QA spans come from [s94 evidence](../s94-b91high/evidence.json) and [s96 evidence](../s96-b92qa/evidence.json), scoped to L6/L7/L9 runs. Those reports contain incomplete and retry-assisted routes as well as clean completions; the table distinguishes them instead of treating failed attempts as completion time. L9 survivor counts and a same-run L7 starting denominator are absent from those receipts, so those axes cannot be claimed as fully calibrated against real-input play.
