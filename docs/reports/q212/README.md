# Q-212 cold load to Begin

Baseline: main runtime `536cadc04`, public production build, native Apple Metal WebGPU,
1600×900 DPR 1. Each cell is the **worst of five fresh Chrome profiles/cache directories**,
with exclusive `quiet-run.sh` admission, zero menu wait, and the unchanged
`cold-load-time.ts` endpoint. OS/driver caches remain shared. Final runtime: `73722e6bb`; all 20 rows pass.

| Level | High before (s) | High after (s) | Low before (s) | Low after (s) | Budget (s) |
|---|---:|---:|---:|---:|---:|
| L1 | 2.160 | 2.076 | 2.143 | 2.193 | 3.5 |
| L2 | 4.110 | 4.158 | 3.677 | 3.608 | 6 |
| L3 | 3.075 | 3.093 | 3.010 | 2.927 | 6 |
| L4 | 5.959 | 5.975 | 4.328 | 4.310 | 6 |
| L5 | 5.760 | 5.260 | 4.910 | 4.560 | 6 |
| L6 | 3.908 | 3.809 | 2.960 | 2.927 | 6 |
| L7 | 6.094 | 3.077 | 3.259 | 2.929 | 6 |
| L8 | 5.043 | 5.091 | 4.627 | 4.609 | 6 |
| L9 | 5.743 | 5.326 | 5.926 | 5.475 | 6 |
| L10 | 5.278 | 4.927 | 5.577 | 5.194 | 6 |

The 100-profile baseline has zero browser errors. L3/L4 meet their budgets on both
tiers; L7 high has one over-budget sample (6.094 s, median 3.392 s). Its first shader
compile/fence cost is the main measured cause. The remaining 19 baseline rows pass; all 20 final rows pass.

The change shares the existing L4 feature-keyed pose/atlas material graph for the
seven ordinary infected models. L7's 14 ordinary batches now use one material;
node builds drop by 25 on both backends and tiers. Batch geometry and corpse roots
are identical. All 36 fixture corpses persist for another 30 simulated seconds,
with zero late node builds. Assets, LODs, quality and warm-up coverage are unchanged.
See [diagnosis and limits](diagnosis.md), including L4 high's 24.6 ms margin.

## Reproduction and evidence

Run a public production preview on a private port (here 4326), then:

```sh
node tools/perf/q212-load-sweep.mjs http://127.0.0.1:4326 test-results/q212/after
```

The driver invokes `cold-load-time.ts` through exclusive `quiet-run.sh` for each
row, five fresh browsers/profiles each. Campaign presets unlock the selected level;
quality is pinned through the visible menu. Measurement starts at the actual level
selection click and ends when the loading card closes/Begin becomes available.
The original measurement body is byte-identical after excluding the import and
post-browser cache disposal requested during the run. That cleanup starts at
L3 low; it changes no endpoint, clock or renderer operation. All completed sample
cache directories are removed. No baseline sample or slow tail is discarded.

| Evidence | Before | After |
|---|---|---|
| Summary, medians and maxima | [20 rows](evidence/cold-before.json) | [20 rows](evidence/cold-after.json) |
| Complete sample receipts | [100 profiles](evidence/cold-before-samples.json.gz) | [100 profiles](evidence/cold-after-samples.json.gz) |
| Quiet admission | [conditions](evidence/quiet-before.jsonl) | [conditions](evidence/quiet-after.jsonl) |
| Build and probe identity | [main](evidence/identity-before.json) | [candidate](evidence/identity-after.json) |
| Post-close cache cleanup | — | [timing and hashes](evidence/probe-cache-cleanup.json), [exact patch](evidence/probe-cache-cleanup.patch) |
| Crowd geometry and retention | [captures](evidence/graphs-before/) | [captures](evidence/graphs-after/), [comparison](evidence/graph-comparison.json) |

## Validation

`npm run verify -- E18` passes typecheck, lint and `npm test` (110/110):
[receipt](evidence/verify-final-E18.json). No test cases were added.
The live dense-horde captures are pixel-identical on all four configurations.
Dense settled-pile captures differ at overlaps ([pixel counts](evidence/graph-image-comparison.json));
all corpse roots/layouts and geometry remain identical. A separated seven-appearance
fixture produces **8/8 pixel-identical live/corpse pairs** across both backends/tiers
([comparison](evidence/spaced-image-comparison.json), [before](evidence/spaced-before/),
[after](evidence/spaced-after/)). This is consistent with changed material draw sorting
at overlapping surfaces, rather than a changed atlas or pose. Captures were visually
inspected. The single temporary baseline build has been removed.

All **20 public-build real-input minutes pass**: 72,071 recorded frames, maximum
66.6 ms, zero frames over 200 ms, zero shader modules/render pipelines created after
Begin, zero browser errors, and every mission still playable. Both tiers of every
level were checked. Inputs are `w,d,s,a,w,d`, held ten seconds each, with actual menu
and Begin clicks and no cheats. Quiet reservations split levels into
`L3,L4,L7,L5`, `L1,L2,L6,L8`, `L9,L10` per tier to stay below the ten-minute cap.
[Per-level receipts](evidence/input-minutes.json), [all frame samples](evidence/input-minute-samples.json.gz),
[quiet admission](evidence/quiet-input.jsonl), [20 captures](evidence/input-contact-sheet.jpg).

The final smoke and 48-row scene gate run after timed gameplay finishes.
