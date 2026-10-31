# Q-212 cold load to Begin

Baseline: main runtime `536cadc04`, public production build, native Apple Metal WebGPU,
1600×900 DPR 1. Each cell is the **worst of five fresh Chrome profiles/cache directories**,
with exclusive `quiet-run.sh` admission, zero menu wait, and the unchanged
`cold-load-time.ts` endpoint. OS/driver caches remain shared. Final measurements are pending.

| Level | High before (s) | High after (s) | Low before (s) | Low after (s) | Budget (s) |
|---|---:|---:|---:|---:|---:|
| L1 | 2.160 | — | 2.143 | — | 3.5 |
| L2 | 4.110 | — | 3.677 | — | 6 |
| L3 | 3.075 | — | 3.010 | — | 6 |
| L4 | 5.959 | — | 4.328 | — | 6 |
| L5 | 5.760 | — | 4.910 | — | 6 |
| L6 | 3.908 | — | 2.960 | — | 6 |
| L7 | 6.094 | — | 3.259 | — | 6 |
| L8 | 5.043 | — | 4.627 | — | 6 |
| L9 | 5.743 | — | 5.926 | — | 6 |
| L10 | 5.278 | — | 5.577 | — | 6 |

The 100-profile baseline has zero browser errors. L3/L4 meet their budgets on both
tiers; L7 high has one over-budget sample (6.094 s, median 3.392 s). Its first shader
compile/fence cost is the main measured cause. The remaining 19 rows pass.

L7 ordinary infected use 14 separate material graphs for 14 batches. The candidate
will reuse the existing L4 feature-keyed pose/atlas binding path for these models.
Before captures retain all 36 fixture bodies across another 30 simulated seconds
on both backends/tiers. Final graph, image, input-minute, smoke and scene checks remain.

Evidence: [baseline summary](evidence/cold-before.json), [100 raw profiles](evidence/cold-before-samples.json.gz),
[quiet admission](evidence/quiet-before.jsonl), [build identity](evidence/identity-before.json),
[L7 diagnostic](diagnosis.md). `npm test` passed 110/110 before measurements; tool typecheck
and lint pass. No new test cases.
