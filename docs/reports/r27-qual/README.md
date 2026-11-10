# r27-qual — 20-load paired cold-load qualification, main 3e6d4a6e (batch 61) vs PROD 1938e59a (batch 60)

Measurement only, no game code changed, no push, no deploy. Data: [summary.json](summary.json).

**Result: L9 FAILS the rule in all 3 measured cells (candidate +6.4 % to +9.6 % warm median, +4.7 % to +10.3 % cold). L8, L10 and the L7 control PASS (within +-1.6 %). Post-card max frame and in-play frames are unchanged. No page errors.**

## Method (as r24-qual)

PROD rebuilt from 1938e59a (`index-UV4D6dsz.js`), candidate = `npm run build` of 3e6d4a6e (`index-dtWpWMki.js`); every load verified to use the expected bundle. Same static server for both (no-cache + ETag), ports 4871 candidate / 4872 PROD. Native Apple M4 Metal, headless 1600x900, `tools/perf/cold-load-time.ts` with `LOAD_FRESH_BROWSER=1` (fresh Chrome profile and disk cache per load) under `tools/perf/quiet-run.sh`, 20 pairs (40 loads) per cell, alternating order P C C P ... Temporary PROD worktree removed. "Warm" = load following a load of the same build, "cold" = load after a build switch (r24 finding); the first load of each cell is excluded from both. Rule: candidate median <= PROD median x 1.05. PO decision 2026-11-10: judged on the median, first fresh-profile load ignored.

## Results (ms)

| Cell | Warm PROD med / p90 / max | Warm cand med / p90 / max | Warm delta | Cold PROD med / max | Cold cand med / max | Cold delta | Verdict |
|---|---|---|---:|---|---|---:|---|
| 1. L9 webgl2 low | 3790 / 3824 / 3824 | 4099 / 4125 / 4142 | +8.2 % | 5641 / 5807 | 5950 / 10291 | +5.5 % | FAIL |
| 2. L9 webgl2 high | 3840 / 3958 / 3958 | 4207 / 4291 / 4306 | +9.6 % | 5673 / 5758 | 5941 / 6058 | +4.7 % | FAIL (warm) |
| 3. L9 webgpu high | 3624 / 3657 / 3657 | 3857 / 3890 / 3924 | +6.4 % | 3640 / 3740 | 4015 / 7056 | +10.3 % | FAIL |
| 4. L8 webgl2 low | 3074 / 3092 / 3092 | 3065 / 3091 / 3107 | -0.3 % | 3982 / 4025 | 4024 / 4391 | +1.0 % | PASS |
| 5. L8 webgl2 high | 3324 / 3389 / 3389 | 3316 / 3373 / 3390 | -0.3 % | 4190 / 4256 | 4208 / 4258 | +0.4 % | PASS |
| 6. L10 webgl2 high | 3358 / 3441 / 3441 | 3384 / 3459 / 3475 | +0.8 % | 3842 / 3958 | 3859 / 3875 | +0.4 % | PASS |
| 7. L10 webgl2 low | 3609 / 3642 / 3642 | 3633 / 3642 / 3658 | +0.7 % | 4134 / 4192 | 4067 / 4125 | -1.6 % | PASS |
| 8. L7 webgl2 low (control) | 3074 / 3108 / 3108 | 3083 / 3092 / 3141 | +0.3 % | 3574 / 3757 | 3582 / 3890 | +0.2 % | PASS |

Post-card max frame (first frames after the loading card closes): 16.7 ms in every cell, both builds. Page errors 0, failed loads 0.

L9 low/high and the L9 warm numbers are tight (p90 close to median on both sides), so the +250 to +370 ms gap is a real, stable shift, not noise; the L7/L8/L10 controls in the same session sit at +-1 %. The cold-state outliers (cand 10291 ms L9 low, 7056 ms L9 webgpu) are single loads right after a switch; medians are unaffected.

## In-play frames (20 s of W/D movement after Begin mission, webgl2 high, 5 pairs, ~1190 frames per load)

| Level | PROD p95 (median of 5) | cand p95 | PROD max (worst of 5) | cand max (worst of 5) |
|---|---|---|---|---|
| L9 | 16.8 ms | 16.8 ms | 50 ms | 50.1 ms |
| L8 | 16.8 ms | 16.8 ms | 50.1 ms | 50.1 ms |

Identical on both sides (the 50 ms max is a 3-frame hitch at the start of play, present in PROD as well). No in-play regression in L8 or L9 (idle-walk window only; it does not reach the L9 APC-light or boarder-wave situation that 760fc686 fixes).

## Likely cause of the L9 FAIL

Batch 61 `Lighting.ts` (760fc686, r27-l9apc) puts `L9-crossing` on the stable shadow-light list (moon and headlight spot both stay live, `activeSunShadow`/`activeSpotShadow` filter). That is the only change that touches L9 load-time rendering; L8/L10 (which already used the stable list) and L7 are unchanged. Plausible mechanism: the L9 materials now compile with both shadow-casting lights at level load instead of one, which costs about 0.25-0.4 s. It buys back the 5.4 s mid-play frame (about 110 shader programs rebuilt when the APC lights die). The sim-side L9 commits (board, pile, bus stop) do not touch rendering. Not bisected (no code or extra builds in this lane); a bisect of 760fc686 vs its parent on L9 webgl2 low (one cell, about 5 min) would confirm. Options for the orchestrator: accept (trade 5.4 s play frame for +0.3 s load, PO call), or prewarm/precompile the stable lights during the loading card.

## Not measured

L8/L10 webgpu, L9 in-play on low and webgpu, any bisect. L9 gameplay window did not include APC/boarder-wave situations.
