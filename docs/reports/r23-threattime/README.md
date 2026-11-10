# R23 qa:threat runtime on a runner

**Result: target NOT met.** `npm run qa:threat` on a runner still cannot finish in 540 s (600 s budget minus 60 s headroom). The audit now needs about 3,800 core-seconds of simulation on a 4-vCPU runner; a perfect 4-worker packing of that is ~950 s. Scheduling cannot close a 1.75x gap. Branch `lane/r23-threattime`; no acceptance target, level content, seed, window or check was changed.

## Measurements (runners 94.130.181.173 and 2.31.170.171, 4 workers, unbounded `threat-audit.ts` so every stage finishes)

| | Before | After (measured-cost longest-first order) |
|---|---:|---:|
| Package run (budget 600 s) | 601.0 s, exit 124, 12 of 31 stages done | not run under the wrapper (cannot pass) |
| Unbounded makespan | 1050.5 s | **958 s** |
| Sum of stage times | 3,844 core-s | 3,799 core-s |
| Lower bound at 4 workers | 961 s | 950 s |

Per-stage before/after: [stages-before.json](stages-before.json), [stages-after.json](stages-after.json). The `split` field breaks each native stage into simulation, observer overhead and kiting re-run.

Where the ~3,800 core-s go: L5 passive x3 806 (1,200 sim-s each), L7 passive x3 690, L8 skilled 454, L9 skilled 238 (fails after 600 sim-s, see below), L4 x3 391, L10 215, remaining ~1,000 over 20 short stages. Observer overhead is ~170 core-s (4 %), the kiting re-runs ~120 core-s (3 %), world loading ~1 s per stage. The Mac does the same work in ~400 s because its cores are ~2.4x faster than a shared Hetzner vCPU.

## What changed

- `tools/qa/threat/stageJobs.ts`: the longest-first order uses measured per-stage seconds instead of stale guesses (L7 passive seed 1 was ranked 40 s but takes 240 s and started at 809 s; L8 skilled was ranked 70 s, takes 454 s). Makespan 1050 s to 958 s, within 1 % of the packing bound.
- Diagnostics only (not in receipts): per-stage split in `stages.json`, `tools/qa/threat/load-profile.ts`, `flag-bench.ts`, `prof-run.sh`, `prof-summary.mjs`, `compare-receipts.mjs`.

## Hash-equality proof

`node tools/qa/threat/compare-receipts.mjs <before> <after>`: all ten level receipts deep-equal except `wallSeconds` (phases, waves, follower votes, flags, kiting receipts and native state hashes). Native state hashes, identical before and after: L1 b6a625d1, L2 60ec8392, L3 4b7c5ecb, L4 36341341, L5 a7863564, L6 ebe39239, L7 76051a8c, L8 61948ab6, L9 c73eb278, L10 c77ed0f2. Only scheduling and timing instrumentation changed; no simulation code.

## Tried and found useless

- V8 flags with 4 concurrent copies of an L5 passive window (`flag-bench.ts`): `--single-threaded-gc` 43.2-49.7 s vs 44.6-50.4 s base; no gain, identical hashes. Per-copy slowdown from 4-way contention is only ~9 %.
- CPU profile of L5 passive (runner, 150 sim-s, 33 s): flat as in r22 (SpatialHash.query 9.6 %, EventBus.emit 6.6 %, CharacterSeparation 5.6 %, SolidRegistry.commit 3.8 % self / 17 % incl.). No hash-safe 1.75x is hiding there.
- Sharing the kiting re-run with the skilled run needs a world snapshot/restore (kiting changes the inputs after the first encounter); the re-runs are only 3 % of the work anyway.

## Findings for the orchestrator

1. **L9 skilled now fails on main**: `mission-failed`, 600 sim-s tick-budget plus 1,012 `collision-invariant` failures (r16: complete in 217 s). It burns 238 core-s. Real regression or stale bot; needs its own lane.
2. **L8 skilled takes 871 sim-s** (r16: 177 s), 454 core-s. Gameplay change or bot stall.
3. L8 and L9 skilled are 18 % of the work; at their r16 durations the total would be ~3,000 core-s (~750 s). Still over 540 s.
4. Ways to reach 540 s, all outside this brief: (a) fan the stages over two runners, (b) a runner-specific budget of ~1,000 s (the Mac passes at ~400 s), (c) a hash-preserving simulation speedup of ~1.75x across the crowd/contact pipeline, (d) shorter L5/L7 passive windows (forbidden here).

## Verification

`npm run typecheck` and `npm run lint` pass on a runner. `tests/tools/gate-tools.test.ts` has one failure (`reviewSourceDigest` needs Git history; the runner's manifest repo has no commits, as noted in r16); `tests/engine/navigation.test.ts` passes. Full `npm test` not run (lane rule: the orchestrator runs it).
