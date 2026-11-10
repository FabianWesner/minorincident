# r28-l9load: win back the L9 load time that r27-l9apc cost

Lane r28-l9load (Sonnet 5.5), 2026-11-10, based on main 3ef8a77b. Method scripts: `pair.sh` (alternating a b b a loads, one fresh Chrome per load, under `tools/perf/quiet-run.sh`) and `analyze.mjs`; both use `tools/perf/cold-load-time.ts`. "Warm" = load after a load of the same build, "cold" = after a build switch (r24-qual finding). Native Apple M4 Metal, headless 1600x900, ports 4881/4882, one browser at a time.

## 1. Cause confirmed

Paired, L9 webgl2 low, 10 loads per side, 760fc686 (`cand`) vs its parent 931305b1 (`base`), the only difference being `src/render/Lighting.ts`:

| | warm median | cold median |
|---|---:|---:|
| parent 931305b1 | 3834 ms (3775 .. 3959) | 5475 ms |
| 760fc686 | 4317 ms (4076 .. 4358) | 5841 ms |

+12 % warm in this session, so r27-qual's reading holds: putting L9-crossing on the stable light list is the cost. Per-stage view (`view:warm-up`, `L1 shader compilation`): all the extra time sits in the load warm-up compile (+120 ms shader compilation, +56 ms other chunk work, +10-30 ms second pass). Stages before warm-up are identical.

## 2. Ablations (webgl2 low, 8 pairs each, warm medians vs the parent measured in the same run)

| variant | warm | vs parent | note |
|---|---:|---:|---|
| spot shadow warm skipped at load (inactive map not warmed) | 4458 vs 3917 | +14 % | worse, the cost just moves; also would build casters mid-play. Dropped |
| spot `castShadow = false` for L9 | 4023 vs 3908 | +3 % | removes headlight shadows, visible change. Dropped |
| spot filter 1 tap (was 9) | 4091 vs 3974 | +3 % | |
| spot 1 tap + L9 compile lanes 12 (as L10) | 4174 vs 3925 | +6 % | no gain from more lanes. Dropped |
| spot 1 tap + moon 1 tap (ablation only) | 3825 vs 3891 | -2 % | shows the 9-tap moon filter in every graph is the other half |
| **spot 1 tap + moon 4 taps (shipped)** | see below | | |

## 3. Fix

`src/render/Lighting.ts` only. L9 keeps the stable light list (moon + headlight spot both resident, so no rebuild when the APC lamps die) but uses cheaper shadow filters for that preset:

- moon: 4 hardware-compared taps at +-1 texel (bilinear compare), equal weights, covering the same +-2 texel penumbra as the old weighted 3x3 grid (`quadSunShadow`);
- APC headlight (512 px map): 1 tap (`liteSpotShadow`);
- both keep the `activeShadowFilter` wrapper (inactive map costs no taps). L10 and all other presets are untouched.

Every one of the ~110 L9 programs now carries 5 instead of 18 shadow taps, which is what buys the time back. No new render path, no precompile, no change to when anything compiles.

## 4. Re-measurement: final build vs PROD batch 60 (1938e59a rebuilt), 10 warm + 10 cold loads per side, concurrent in the same session

| Cell | PROD b60 warm med | candidate warm med | delta | b60 recorded median (r27-qual) x 1.05 | cold PROD / cand |
|---|---:|---:|---:|---:|---|
| L9 webgl2 low | 3842 | 3925 | +2.2 % | 3980 | 5790 / 5709 |
| L9 webgl2 high | 3874 | 4059 | +4.8 % | 4032 | 5758 / 5823 |
| L9 webgpu high | 3658 | 3808 | +4.1 % | 3805 | 3656 / 3942 |

All three are inside the paired 5 % rule (before: +8.2 / +9.6 / +6.4 % in r27-qual). Caveat: webgl2 high is thin (4.8 %), and against the old recorded b60 absolute medians it is 27 ms over on high and 3 ms over on webgpu, because this session's PROD ran 1-2 % slower than r27-qual's. An intermediate variant (spot 1 tap only, moon unchanged) measured +5.3 / +3.8 / +5.0 % against the same PROD. If the PO wants more margin on high, the next lever is the moon filter on high (3 taps), or an L9-only look at what else the loading card does. Page errors 0 in every load.

## 5. Probe (tools/scenelab/r27-l9-boarders.ts, `?loadProfile=2`, real time)

| run | APC lamps die (worst frame) | boarder wave (worst frame) | runtime node builds | page errors |
|---|---|---|---|---|
| low / WebGL2 | 16.8 ms | 167 ms (one 167 ms frame in idle and one in the wave, both with 0 builds) | 0 | 0 |
| high / WebGPU | 16.8 ms | 50 ms | 2 single `ShadowMaterial` builds in the wave (17 ms frames), same as r27-l9apc's "after" row | 0 |

No frame over 200 ms, zero builds when the lamps die: the mid-play rebuild did not come back. The 167 ms frames on WebGL2 are the earlier-seen unexplained single hitch class (no builds); not caused by this change (the same probe on the parent code is not available here).

## 6. Visual

Probe end frame, high/WebGPU (`test-results/r27-l9apc/boarders-high-webgpu-r28/end.png`, git-ignored): lamp-post, bench and APC shadows read clean, no stipple or edge banding. Not A/B-compared against the old 9-tap sheet: **Browser QA needed** (level L9, night, close zoom 1.5 and default, high and low, WebGL and WebGPU): moon shadow edge softness on props/buildings and the APC headlight shadow on foliage, versus PROD.

## 7. Checks

See the lane report for tsc / lint / render-contracts / `npm run test:gate` results.
