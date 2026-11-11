# s44: Mac/Linux simulation determinism

Completed for the measured matrix: native completion policy, seed 3, low quality; every exact per-tick hash agrees between Mac arm64 and Hetzner Linux x86-64 (Node 26). No browser was used. No stats or tuning constants changed.

## First divergence and cause

Before the fix, L8 seed 3 / low first differs at tick 16: NPC 357 (`npc.cashier`) yaw is -1.96054960208661 on Mac versus -1.9605496020866102 on Linux; angular velocity differs by about 2e-15. Math-call tracing proves identical `atan2(2.8226244624553942, -0.826766841716009)` inputs return 1.8557332691559076 versus 1.8557332691559079 in `faceMotion`. `cos(2.3178760837493564)` also returns -0.6794991472853462 versus -0.6794991472853461. The old state hash rounds to 1e-4 and hides these differences; final hashes can reconverge, so only comparing endpoints is insufficient.

The root cause is host-dependent native transcendental math. The fix uses fixed IEEE-754 arithmetic for confirmed simulation-facing paths: locomotion, NPC/follower facing, vehicle quaternion conversion, L4 convoy route interpolation, weather, resident walks, attracted-point sampling and ranged spread. `deterministicMath.ts` adapts the permissively licensed Sun/openlibm atan/sine/cosine kernels, preserving attribution. Split pi/2 reduction and correction terms keep the sampled error versus native Mac math at about 1e-16 for sine/cosine and below 5e-16 radians for atan2. The initial simple series altered L3/L6 audit outcomes; it was replaced with the more accurate kernels, and the complete final audit restores all original flag counts.

Further first differences isolated during tracing included the zookeeper's stand/look (184), follower facing (203), L4 convoy (420), player/corgi facing, resident walk yaw (5858), leader-heading sine feeding follower acceleration (5968), attracted-point goal X (6569), and ranged spread aim Z (6961). Unrelated experimental AI and traffic edits were reverted.

## Cross-platform sequence hashes after the fix

Each SHA-256 covers every `tick:exactHash` line, not just the final state. Full Mac/Linux traces under `test-results/sim-hashes/final3{,-linux}/` were compared tick by tick. The committed Linux receipts are in `tests/nightly/sim-determinism.baseline.json`; [evidence.json](evidence.json) records the matrix and final audit counts.

| Level | Matching tick samples | SHA-256 of exact sequence (both platforms) |
| --- | ---: | --- |
| L8 | 7200 | `6d079765407cb433d9ab900a7dd9911284a0c40030cf6df61183c5da62bc21c3` |
| L1 | 1200 | `111315ee0840cbe649c2b0dadb8d08e78b24f28972464141d945cb1e7f3a9ea2` |
| L4 | 1200 | `89d406ae70db7e13d0a7a31425273a18f6e0c35b0c64b775e5c76c6ee0a63e29` |
| L9 | 1200 | `d8aaf1bcbaf4d7faaf4fd9fd3a540a5ecdb95a522b66acab4febc5ef41393298` |
| L10 | 1200 | `40606c9dd67f0d5fe52048728d21ff7831455c9e19ac7f83178d7d8010fdd191` |

Before: exact hashes differ at L8 tick 16. After: all 7,200 L8 samples agree; all 1,200 samples agree for each coverage level. The hash tool includes entities (positions, health, locomotion), mission/progression, RNG/AI, combat, controls, weather, interactions, destruction and props. This is evidence for the specified seed/tier/policy windows, not a claim about every possible seed or full campaign duration.

## Tool and nightly regression

```
node --import tsx/esm tools/sim-runner/hash-level.ts --level L8 --seed 3 --quality low --policy complete --ticks 7200 --out test-results/mac-L8.json
sh tools/remote/run.sh "$PWD" --pull test-results/linux-L8.json -- node --import tsx/esm tools/sim-runner/hash-level.ts --level L8 --seed 3 --quality low --policy complete --ticks 7200 --out test-results/linux-L8.json
```

`--compare <receipt>` reports the first differing tick and saves its full snapshot; `--from <tick>` hashes only a diagnostic window while still simulating every preceding tick. `HASH_DUMP_TICK`/`HASH_DUMP_PATH` capture a chosen state; `HASH_MATH_TRACE` records native math calls in the sampled window.

The existing nightly sim-budget test now verifies the Linux sequence receipts before measuring performance, using `simDeterminism.ts`. No test case was added: collection remains 150/150 cases and 44/45 files. The exact-sequence helper passed independently on Mac against the refreshed Linux baseline. The full nightly suite/performance measurement was not run; no browser or performance claims are made.

## Final checks

- `npm run typecheck` and `npm run lint`: passed.
- `sh tools/remote/run.sh "$PWD" -- npm test`: passed, 27 files; 106 passed, one skipped; 159.6 s / 240 s budget.
- `node --import tsx/esm tools/qa/threat-audit.ts`: final complete audit, 17 flags, expected exit 1. Counts before → after: L1 0→0, L2 1→1, L3 1→1, L4 4→4, L5 1→1, L6 4→4, L7 6→6, L8 0→0, L9 0→0, L10 0→0. No audit thresholds changed.
- `node --import tsx/esm tools/qa/check-fixtures.ts`: all 15 committed QA checkpoints load and advance successfully. Fixture bytes are unchanged and none were repacked. Future simulated exact hashes intentionally differ from pre-fix execution; the existing rounded hash API is unchanged.
- No specs, reference assets, forbidden directories, or gameplay stats were changed.
