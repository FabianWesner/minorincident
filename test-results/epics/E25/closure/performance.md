## Performance before / after

Headless Chrome, Metal WebGL2, one worker; quiet-run held both browser slots and required load <3 with no other headless Chrome. Phone frame checks use the existing 4× CPU throttle and DPR. Baseline: 10/10 L1–L5 checks on main. Final: 16/16 combined level, lighting and effects checks. No budgets, caps or assertions changed and no effects were removed. Conditions: `closure/perf-conditions.jsonl` and `closure/perf-final-conditions.jsonl`; raw baseline/final JSON: `closure/perf-before/` and `closure/perf-after/` (all under E25).

High level checks assert p95 ≤14 ms. Phone level checks assert p50 ≤33.333 ms and record p95. Existing transition limits remain unchanged, including L2/L3 50 ms and L4's existing 80 ms phone transition limit.

| Level / spot | Tier | Before p50 / p95 ms | After p50 / p95 ms | Result |
| --- | --- | --- | --- | --- |
| L2 peak | high | 7.0 / 9.2 | 7.0 / 9.4 | PASS |
| L2 peak | low | 25.7 / 31.3 | 24.1 / 29.5 | PASS |
| L3 attack | high | 4.9 / 7.3 | 5.2 / 8.1 | PASS |
| L3 boulevard | high | 5.0 / 8.0 | 5.9 / 8.9 | PASS |
| L3 street | high | 6.2 / 8.7 | 7.0 / 9.5 | PASS |
| L3 attack | low | 17.0 / 34.0 | 21.1 / 32.0 | PASS |
| L3 boulevard | low | 16.5 / 34.1 | 20.5 / 28.1 | PASS |
| L3 street | low | 18.7 / 34.3 | 22.2 / 28.1 | PASS |
| L4 war | high | 5.4 / 7.3 | 5.8 / 7.6 | PASS |
| L4 collapse | high | 8.1 / 9.8 | 7.4 / 9.4 | PASS |
| L4 war | low | 19.0 / 34.4 | 16.4 / 33.9 | PASS |
| L4 collapse | low | 20.5 / 33.6 | 21.2 / 32.5 | PASS |
| L5 group walk | high | 5.1 / 7.7 | 5.4 / 8.3 | PASS |
| L5 group walk | low | 13.5 / 19.3 | 14.6 / 21.3 | PASS |

L1 is the existing structural photo-spot gate; it does not assert frame percentiles.

| L1 | Before max draws / triangles | After max draws / triangles | Result |
| --- | --- | --- | --- |
| high | 112 / 802,451 | 112 / 802,451 | PASS |
| low | 90 / 321,149 | 90 / 321,149 | PASS |

Lighting light-lab/night-street and mega/chain effects also pass on both tiers; their raw `perf-high/low.json` and `closure/perf-light-lab-high/low.json` include lighting counters and unchanged pool caps.
