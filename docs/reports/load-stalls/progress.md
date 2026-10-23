# P1-107: measured acceptance complete

- Runtime `6b05bca7f`, bundle `index-B2vU0WX6.js`; baseline runtime `9698a393c`.
- All 20 configurations pass: L1/L4/L7/L8/L10 × WebGPU/WebGL2 × low/high, 20 fresh browser profiles before and after each (800 observations). Every candidate median is faster; worst candidate load is 5.676 s.
- Maximum recorded post-card frame is 116.7 ms across 13,529 cold-load frames. Four L10 lamp-boundary replays add 85,470 playable frames, max 33.9 ms, no hitches.
- Typecheck/lint/build pass. Full remote unit/level suite passes: 443 files / 2,446 tests; 3 files / 9 tests skipped. All 31 smoke checks pass.
- Independent raw-data audit passes; source hashes, native backends, errors, exact distributions, movement segments and build identities are checked by `evidence/audit.py`. Candidate preview must be available on port 4222 when rerunning it.
- L8 WebGPU high improves from 24.270/24.571/24.627 s to 3.931/3.967/4.000 s (median/p90/max).
- The earlier indexed revision failed its L10 GL/high N=20 budget at 6.526 s; the full failed batch is preserved under `evidence/after-indexed-failed/`. The rig-pose revision fixes that measured miss.
- The original one-off L1 10–16 s trigger remains unproven. A separate deployed-13g diagnostic trace batch is running; it is excluded from acceptance distributions.

See [root cause](root-cause.md), [all distributions](distributions.md), and `evidence/final-audit.json`. The budget remains 6,000 ms.
