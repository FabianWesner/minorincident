# Current performance gate (2026-10-11)

Source `41b57aa2`: **15/16 passed**, no skips/flaky outcomes, 14.3 minutes. L2 phone gate close **51.1 ms exceeds the unchanged 50 ms limit**. The combined gate is red. All four lighting, both explosion/fire/smoke and the other nine level checks pass.

The initial L2 phone reveal hitch was 85.3 ms; after foreground LOD preparation it is 37.5 ms. Final peak p50/p95: 24.8/29.1 ms. Targeted gate maxima 52.0 and 53.5 ms also remain recorded, so this is not claimed as a green transition gate.

Headless Chrome, Metal WebGL2, one worker; quiet-run held both browser slots, required load below 3 and no competing headless Chrome/Vitest before startup. Phone uses the existing 4× CPU throttle and DPR. No budgets, tolerances or assertions changed. Full raw metrics/report: `gates/perf-final-source/`; log: `gates/perf-phone-final.log`; conditions: `gates/perf-conditions.jsonl`; diagnosis: `gates/diagnosis.md`.

Earlier green before/after captures in `perf-before/` and `perf-after/` are historical and do not establish current closure.
