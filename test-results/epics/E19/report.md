# E19 — Level 1 acceptance closure (`lane/l1-closure`)

## Status

`in-progress`. AC23's final vision scores and P0/P1 judgment are reserved for Opus by the orchestrator. The nine captures and lane checklist are in [review.md](review.md). Automated final verification is running; totals will be recorded below when it finishes. No push, main merge-out, or deployment was performed.

## Changes / commits

- `f837ea59`: make 20-seed full-mission spread and robust-start default tests; add AC23/AC24 tags, real-input bicycle completion, and populated scene budget checks; set E19 in-progress for the reserved vision judgment.
- `24b964fd`: fix route capture framing/story-beat waits and show the exact ending caption before the fade.
- `52d90d26`: merge main through `asset-fix-2` (`9d9ade25`), including bike saddle/rack fixes and the repacked distance LODs.
- `73e72706`: calibrate bot timing and separate genuine forecourt bait from the unopposed growth/robustness contract.
- `ee304378` / `43261cb7`: final rendering and test harness changes. High world LOD0 radius changes from 45 m to 8 m; LOD2 starts at 24 m with 2 m hysteresis. Small props use a radius-scaled distance (`min(1, radius / 5)`). Art is unchanged. Read-only batch triangle diagnostics attribute geometry cost. The low tier and crowd renderer retain their existing policy.
- `d3dc9ec9`: implement the PO's player-controlled bay entry, existing authored shell/open leaves, repeated firefighter invitation, and updated spec/bot/e2e paths. `76df5941` fixes the doorway test's invalid scenery spawn; `fe979fd0` records actual entry during the ending frame-budget measurement.
- `dda7c2e7` names the actual remote perimeter fixture; `9f1bec55` deletes bulky traces after passing transition budgets; `041ad61e` adds instant presentation framing and resumes real-input travel after combat; `0e442b83` routes the evade bot around obstacles and captures a fresh invitation. `b4512244` frames the real ending transition, `b4e265b5` checks the radio subtitle text, `c1e2a5da` forwards the existing instant camera mode, `a92c4d8d` syncs main’s fair validation locks, and `e497c518` allows next-level asset loading after Continue.
- `62f0b624` guards already-completed escape setup; `12c06c1d` observes the actual eye-glow phase; `ad7c0703` keeps the assisted route moving without combat; `98cd6a4e` records evade outcomes; `e75f84e0` lets invitation text fade in; `c8515bee` identifies idle offenders; `69aa10be` fixes the healthy L1 pet blocking its owner.
- Default verification runs the three native GPU scene checks and serialized transition checks. Smoke's Node section obtains the sim lock separately from its browser section, so it releases the slot before browser queue waits.
- Real-input travel stops when the objective completes (its story trigger may stop movement before the requested distance). Assisted spread/horde/bay cameras frame the existing actors without repositioning them.

## PO ending change (2026-10-07)

The courier now enters the fire station with normal player input. There is no final story beat, auto-walk, input lock, scripted invulnerability, hidden player/corgi, camera takeover or fade. A firefighter stands beside the open right bay, waves, and says **Get in!** every four seconds while the courier is within fourteen metres. The delivered human `civilian.hey` bark accompanies it; a recorded **Get in!** voice is not available. Infected AI and combat keep running until the courier crosses the entry volume, centred 1.2 metres inside the actual door with a 0.5 m radius. The shutter closes and the ordinary result panel displays the existing exact caption immediately after entry.

The previous ending teleported the player through a collider filling the station footprint, and its door/trigger anchors were on the apron. The lane corrects those anchors, uses the asset's existing authored collision shell, and lifts its existing sectional leaves before static batching. No art geometry is changed. Sim and browser paths now walk through the aperture, and a dedicated regression checks repeated calls, no automatic movement/protection, live chasers, and completion only inside. E19 §3 beat 10 and AC22 were updated at the PO's explicit request. Final validation/captures below reflect this change as each battery completes; the remaining older results are provisional until rerun. The evade-only bot now chooses connected escape destinations rather than steering an away-vector into the garage wall (**122.52 s, zero attacks/deaths/kills, 50 damage** in the final default seed-3 check; [evade-bot.json](evade-bot.json)); the browser route reissues real clicks after combat/respawn.

## Civilian idle regression

The first complete post-ending verification finished with **133 passed / 3 failed** in **27 passing / 2 failing files** (92 files / 491 checks skipped by selection). The evade route and subtitle-object assertion were corrected as above. The third failure was AC05: seed 1's civilian 48 stood for **1,989 ticks (33.15 s)** while its own healthy dog (49) stopped just ahead and body-blocked every walking destination. Changing destinations could not free it. The lane makes healthy **L1** pets follow beside/behind their owner with enough speed to keep up; body separation is retained, and earlier non-L1 pet behavior is unchanged.

The focused AC05 check passed after the fix (one selected test, six skipped), covering 20-seed population/appearance/speed checks and three 60-second calm-morning windows. The ≤3 s idle gate was retained. Evidence: `idle-diagnostic.json` / `idle-fixed.json`. Final full verification is being repeated after this production change; earlier full-run numbers are calibration/diagnostic evidence until refreshed.

## Timing calibration (20 seeds, no bot cheats)

| Profile | Completed | Median | Range | Deaths |
| --- | --- | --- | --- | --- |
| Complete, bicycle | 20/20 | 97.98 s (test upper-middle: 98.10 s) | 94.25–110.07 s | 0 |
| Newbie, on foot | 20/20 | 109.51 s (test upper-middle: 109.53 s) | 107.92–114.73 s | 0 |

Evidence: [complete-bots.json](complete-bots.json), [newbie-bots.json](newbie-bots.json). The unassisted real-input bicycle route passed after the PO ending change: **211.35 simulation seconds, 3 deaths, 28 kills, 434.8 damage** ([unassisted-result.json](l1v2/unassisted-result.json)). The harness reissues genuine clicks after combat/respawn; no god mode, teleports or objective completion cheats are used. God mode is used only on the separate visual capture route.

## Scenario correction / measured forecourt behavior

The genuine idle player stays at the forecourt after delivery with no teleport. To survive the whole observation window it is immortal. Infected continue selecting it as the closest visible human, creating an indefinite aggro sink. Original growth gates fail: upper-middle counts are **8 at +120 s and 10 at +240 s**, and **9/20** seeds reach 12 at +120 s. The initial 20-seed diagnostic runs are [forecourt-spread.json](forecourt-spread.json); the default verify retains seed 7 as the genuine forecourt regression ([forecourt-idle.json](forecourt-idle.json)), alongside the full 20-seed unopposed battery. This avoids duplicating a long quantitative battery for a fixture whose growth contract has deliberately changed; each newly infected entity is checked against a turning bite, and director/route spawns must remain zero.

The quantitative growth fixture now explicitly moves only the observer to the northwest perimeter (-82, -52) at the exits, without advancing mission objectives. It retains the original ≥15/+120 s, ≥25/+240 s, and ≥18/20 floor gates, with provenance and zero director spawns. The isolated 20-seed bite-chain proof remains unchanged. Robust start tests all **100 seed/victim combinations**, lethally removing each of the five initial exit infected in turn and requiring an actual bite within 60 s with the same remote observer.

Final unopposed counts: conventional medians **29/+120 s** and **43/+240 s** (test upper-middle **29/43**), with **18/20** seeds at least 12 at +120 s; ranges **9–37** and **15–57**. Evidence: [unopposed-spread.json](unopposed-spread.json). All **100/100** seed/victim combinations produced an actual bite within the 60 s window ([robust-start.json](robust-start.json)).

## Performance

Main's asset merge was measured before changing policy: morning **2,784,379** and accident **1,684,819** submitted triangles still exceeded 1.5M. Keeping the entire view at LOD0 hid the benefit of the new authored distance LODs. The lane fixes selection distances rather than art.

Native Metal WebGL2 samples (12 s minimum, resumed simulation):

| Spot | Population at setup | Peak triangles | Peak draws | p95 frame | GC heap |
| --- | --- | --- | --- | --- | --- |
| Morning | 60 civilians | 1,150,554 | 384 | 10.5 ms | 83.29 MB |
| Accident | 59 civilians, real smoke beat | 1,112,063 | 318 | 10.6 ms | 83.84 MB |
| Horde | 59 civilians + 30 infected | 1,470,099 | 389 | 13.7 ms | 84.72 MB |

The post-pet-fix native GPU/capture recheck passed **6/6** (capture plus all **5/5** budget checks), using `E2E_PORT=3317 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L1.spec.ts tests/perf/l1-spots.spec.ts tests/perf/l1-transitions.spec.ts --project=chromium --workers=1 --grep 'assisted visual|T-E19-24|M1-22'`. The earlier focused recheck also passed all **5/5** budget checks: three populated scenes and two transition devices. Desktop/mobile peak ending frames were **27.7/29.4 ms**. `E2E_PORT=3317 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L1.spec.ts tests/perf/l1-spots.spec.ts tests/perf/l1-transitions.spec.ts --project=chromium --workers=1 --grep 'unlock|assisted visual|T-E19-24|M1-22'` produced **6 passed / 1 failed** overall: Continue and all budgets passed, but the assisted route stalled in combat. After removing combat from that god-mode visual setup, the separate assisted capture rerun passed **1/1**. A prior busy run failed morning/horde p95 at **21/45 ms** with identical triangles/draws; its samples are preserved in `contention/` and no gate was relaxed. JSON proof and budget images are at the E19 root. The tests sample peak draw/triangle counters throughout the window, collect GC heap, and require high tier, ≥300 simulation ticks, p95 ≤16.7 ms, draws ≤600, triangles ≤1.5M and heap ≤400 MB. Transition samples separately require every measured frame ≤50 ms.

### Earlier-epic regression comparison

The E18 200-infected desktop gate failed during the shared-Mac run (25.7 ms p95 in the first attempt). It also failed with the **original rendering policy restored**, at **31.1 ms p95 / 6.0 ms p50**, 1,258,893 triangles. [Baseline proof](e18-baseline.json) and `e18-baseline.log` retain that comparison. The final lane-policy comparison also failed (**28.4 ms p95 / 5.7 ms p50**, 1,258,845 triangles; [current proof](e18-current.json)). No threshold was relaxed; this is a reproducible baseline performance issue, not an all-green regression claim. WebGPU and physical-device measurements were not rerun; §6 reserves WebGPU for manual checking.

## Exact validation commands / results

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=4`: **244 passed in 75 files**.
- `E2E_PORT=3317 npm run test:smoke`: **5 simulation checks + 22 browser checks passed**.
- `E2E_PORT=3317 npm run verify -- E19`: pending.
- `E2E_PORT=3317 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L1.spec.ts --grep 'unassisted|assisted visual' --project=chromium --workers=1`: 2 passed after route fixes; final captures run separately with populated budget checks.
- `E2E_PORT=3317 sh tools/e2e-lock.sh npx playwright test tests/perf/e18-desktop.spec.ts --grep 'T-E18-09' --project=chromium --workers=1`: 1 failed; original-policy comparison also 1 failed, as above.

All browser runs were headless and used the machine-wide lock, maximum two workers, with a private preview port (3317). The verification simulation battery uses one worker under the sim lock. Browser fixtures enforce no unallowlisted console/page/network errors. Earlier attempts exposed the original bot-band failures, forecourt growth failure, over-budget LOD policy, route-harness stop issue, one transient batch of asset 404s, and one low-tier test-boundary typo; final outcomes above supersede those attempts where corrected.

## Every deviation / remaining work

1. **AC02/03 timing:** replace 4:00–6:00 / 4:30–7:00 bot bands with **1:15–3:00 / 1:30–3:30** per staging §6 and the measured 20-seed medians. No delays or level padding were introduced. Human pacing has not been newly measured; narrative beat timings remain human targets.
2. **AC06 observer contract:** quantitative spread uses a remote observer at (-82, -52), away from the forecourt. This point is inside the district bounds (-85..85, -55..55), so the final spec names the actual perimeter fixture rather than claiming it is outside the district. A genuine forecourt idle case is still run and reported, with the initial 20-seed diagnostic retained, rather than claiming its old growth floor passes.
3. **AC07 observer contract:** all five possible initial victims are tested on all 20 seeds, using the same unopposed fixture. This isolates resilience of the outbreak from unlimited player baiting.
4. **Capture framing:** the spread camera follows an actual systemic transforming victim rather than waiting for one at a fixed anchor; it is raised to see over a fence. Horde and bay use a reversed view, and smoke receives four seconds of render-only development. Actors are not teleported. The assisted route supplies the nine visual frames; the separate unassisted bicycle route supplies completion proof.
5. **Vision closure:** AC23 is not self-approved. Opus must score the five designated scenes against the reference and decide P0/P1 findings. Reference sheets became available in the main checkout during the lane run and were inspected read-only. The nonexistent §7.4 citation was corrected to 90-test-concept §7.1. Lighting keyframes are unavailable. The lane supplies A/D/E observations, leaving final scene scores and severities to Opus.
6. **PO ending:** the final scripted run-in/shutter/fade is replaced by normal player-controlled entry, as explicitly requested. Existing art metadata supplies the open bay and collision shell. The generic delivered human bark is used because no recorded **Get in!** voice exists.
7. **Earlier E18 performance:** the desktop gate fails both baseline and lane in this environment; report it rather than claiming all earlier epic checks are green. Other earlier-epic checks were not exhaustively rerun; unit and smoke regressions are recorded above.

The requested final vision judgment is left to Opus; E19 is deliberately not marked done.
