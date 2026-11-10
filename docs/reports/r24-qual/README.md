# r24-qual — 20-load paired cold-load qualification, main 6b4f68c7 vs PROD 2741447

Branch `lane/r24-qual`. Measurement only, no game code changed, no push, no deploy. Per-load numbers and class statistics: [summary.json](summary.json).

**Result: all 8 measured cells PASS (candidate median <= PROD median x 1.05), in both load states described below. All 8 cells requested (priority 1-4) were measured with 20 paired loads per side; none were skipped.**

## Method

- PROD = batch 59 rebuilt from `2741447` (entry bundle `index-Dk-iL-FG.js`, same name as live), candidate = `npm run build` of main `6b4f68c7` (`index-DJP68qvy.js`). Every load verified to use the expected bundle. Temporary PROD worktree removed after the build.
- Same static server for both (no-cache + ETag, original bytes), ports 4871 (candidate) / 4872 (PROD). Native Apple M4 Metal, headless Chromium 1600x900, `tools/perf/cold-load-time.ts` with `LOAD_FRESH_BROWSER=1` (fresh Chrome profile and disk cache per load), via `tools/perf/quiet-run.sh` exclusive admission, one reservation (about 4-5 min) per cell, 20 pairs = 40 loads per cell. Pair order alternates (PROD,cand / cand,PROD) so the sequence is P C C P P C C P ... No invalid reservation (all exit 0, no retries), no page errors, post-card max frame 17 ms in every cell.

## Important finding: two load states (explains the "first load" spikes of r22/r23)

Within a cell the loads are bimodal, and the mode is set by the previous load: a load that follows a load of the **other build** is slow ("switch" state, cold driver/shader state for a new binary), a load that follows the same build is fast ("same" state). Example L8 webgl2 low: PROD 6307, 6591, 3059, 6409, 3091, ...; candidate 6590, 3074, 6342, 3042, ... This is the same effect as the "first fresh-profile load" spike seen in r22, and it hits PROD and candidate alike. Plain medians over the whole interleaved set therefore depend on which mode is in the majority and are not meaningful for L8/L10 (the literal all-loads medians are in summary.json, e.g. L10 -20 %, L8 low -27 %: these are artefacts). The valid comparison is within a state: 10 same-build loads per side (9 for PROD, whose very first load of the cell is excluded) and 10 switch loads per side, each side having the same count in each state.

## Results (ms; rule: candidate median <= PROD median x 1.05)

"Warm" = same-build state, "cold" = after a build switch.

| Cell | Warm PROD med / p90 / max | Warm cand med / p90 / max | Warm delta | Cold PROD med / max | Cold cand med / max | Cold delta | Verdict |
|---|---|---|---:|---|---|---:|---|
| 1. L7 webgl2 low | 2973 / 3075 / 3075 | 3057 / 3059 / 3075 | +2.8 % | 3042 / 3075 | 3159 / 3207 | +3.8 % | PASS |
| 1. L7 webgl2 high | 3539 / 3591 / 3591 | 3558 / 3590 / 3640 | +0.5 % | 4308 / 4490 | 3608 / 3692 | -16.2 % | PASS |
| 2. L10 webgl2 high | 3209 / 3293 / 3293 | 3359 / 3393 / 3426 | +4.7 % | 5225 / 5676 | 4876 / 5359 | -6.7 % | PASS (thin margin warm) |
| 3. L8 webgl2 low | 3076 / 3127 / 3127 | 3075 / 3107 / 3108 | -0.0 % | 6408 / 6591 | 6224 / 6774 | -2.9 % | PASS |
| 3. L8 webgl2 high | 3374 / 3391 / 3391 | 3341 / 3442 / 3458 | -1.0 % | 6666 / 6774 | 6424 / 6473 | -3.6 % | PASS |
| 4. L10 webgl2 low | 3525 / 3561 / 3561 | 3609 / 3643 / 3676 | +2.4 % | 5567 / 5710 | 5117 / 5660 | -8.1 % | PASS |
| 4. L7 webgpu low | 2756 / 2808 / 2808 | 2782 / 2841 / 2874 | +0.9 % | 2748 / 2942 | 2791 / 2825 | +1.6 % | PASS |
| 4. L7 webgpu high | 3342 / 3374 / 3374 | 3342 / 3376 / 3408 | 0.0 % | 3415 / 3442 | 3357 / 3393 | -1.7 % | PASS |

Cold-state p90 values are in summary.json (`switch.*.p90`).

Notes:

- **L7 webgl2 low / high**: +2.8 % / +0.5 % warm, +3.8 % / -16.2 % cold: both under 5 %. r23 measured +3.1 % / +4.0 %; this run agrees on low and is better on high. The high cell shows the candidate does not pay the cold-state penalty that PROD pays (PROD cold 4308 vs warm 3539; candidate 3608 vs 3558), consistent with the r23 handover/audio prefetch overlap.
- **L10 webgl2 high**: +4.7 % warm (r23 +5.0 %, r22 +6.4 %) passes but the margin is only 0.3 points and a noisy session could flip it. The candidate wins in the cold state (-6.7 %). L10 webgl2 low +2.4 % warm.
- **L8 (rule question for the PO)**: the "every load < 6000 ms" rule fails on PROD too. In the cold state every L8 webgl2 load is 6.2-6.8 s on both sides (PROD max 6591 low / 6774 high, candidate max 6774 low / 6473 high); in the warm state all L8 loads are 3.0-3.5 s. The **first fresh-profile load of the cell** is PROD 6307 (low) and 3575 (high) in this run. The candidate's first loads (they follow a PROD load, so cold state) were 6590 (low) and 6457 (high). Medians are equal or better than PROD in both states, so L8 is not a candidate regression. The slow state looks like the cost of the first launch after a different binary (driver/OS shader cache), not of a particular build; the rule needs to be a median/p90 within a stated state, or the first load of each reservation must be treated as a warm-up. L7 webgl2 high PROD also shows a 7041 ms first load, L10 webgl2 first loads are 5.3-5.7 s (all under 6 s).
- **Max load, candidate**: L7 webgl2 3692 (high) / 3207 (low), L7 webgpu 3408 / 2874, L10 webgl2 5359 / 5660, L8 webgl2 6473 (high) / 6774 (low).
- Foreign CPU work: quiet-run admitted every reservation, no exit 75, so no run had to be repeated. The load average recorded during loads (up to 13 on one webgpu cell) comes from the measured browser and its GPU process.

## Cells not measured

None of the requested cells. Not requested and not measured: L1, L4, L8/L10 webgpu, frame-time runs.

## Caveat

The method alternates builds every second load, so half the loads of each side are in the cold state by construction. Earlier reports used PROD then candidate in separate blocks, which puts only the first load of each block into that state. Both states are reported above; the warm columns correspond to the earlier block method.
