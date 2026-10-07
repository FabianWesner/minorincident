# E19 — Level 1 acceptance closure (`lane/l1-closure`)

## Status

`in-progress`. AC23's final vision scores and P0/P1 judgment are reserved for Opus by the orchestrator. The nine captures and lane checklist are in [review.md](review.md). The final default verification on merged main `959de30b` plus lane fixes was stopped at the orchestrator’s explicit wrap-up request, after the robust-start matrix finished at 18:05:28. It is **incomplete**: no final aggregate totals were produced. No new batteries were started after that request. No push, main merge-out, or deployment was performed.

## Changes / commits

- `f837ea59`: make 20-seed full-mission spread and robust-start default tests; add AC23/AC24 tags, real-input bicycle completion, and populated scene budget checks; set E19 in-progress for the reserved vision judgment.
- `24b964fd`: fix route capture framing/story-beat waits and show the exact ending caption before the fade.
- `52d90d26`: merge main through `asset-fix-2` (`9d9ade25`), including bike saddle/rack fixes and the repacked distance LODs.
- `73e72706`: calibrate bot timing and separate genuine forecourt bait from the unopposed growth/robustness contract.
- `ee304378` / `43261cb7`: final rendering and test harness changes. High world LOD0 radius changes from 45 m to 8 m; LOD2 starts at 24 m with 2 m hysteresis. Small props use a radius-scaled distance (`min(1, radius / 5)`). Art is unchanged. Read-only batch triangle diagnostics attribute geometry cost. The low-tier distance policy is unchanged. The later main merge supplies its separately validated crowd and projected-size prop policies.
- `d3dc9ec9`: implement the PO's player-controlled bay entry, existing authored shell/open leaves, repeated firefighter invitation, and updated spec/bot/e2e paths. `76df5941` fixes the doorway test's invalid scenery spawn; `fe979fd0` records actual entry during the ending frame-budget measurement.
- `dda7c2e7` names the actual remote perimeter fixture; `9f1bec55` deletes bulky traces after passing transition budgets; `041ad61e` adds instant presentation framing and resumes real-input travel after combat; `0e442b83` routes the evade bot around obstacles and captures a fresh invitation. `b4512244` frames the real ending transition, `b4e265b5` checks the radio subtitle text, `c1e2a5da` forwards the existing instant camera mode, `a92c4d8d` syncs main’s fair validation locks, and `e497c518` allows next-level asset loading after Continue.
- `62f0b624` guards already-completed escape setup; `12c06c1d` observes the actual eye-glow phase; `ad7c0703` keeps the assisted route moving without combat; `98cd6a4e` records evade outcomes; `e75f84e0` lets invitation text fade in; `c8515bee` identifies idle offenders; `69aa10be` fixes the healthy L1 pet blocking its owner.
- `c3cc2315` records interim evidence; `7de238e9` merges latest main (`959de30b`) with its crowd/prop/streaming/audio/campaign fixes while retaining the open bay and distance policy; `7ec57d7b` aligns a merged model-LOD assertion with that policy.
- `0ef71ef1` fixes the merged safe-parking regression: the bicycle frame was clear of scenery but its new nav blocker covered the dismounted rider, trapping real click travel at the annex. Parking candidates now leave the rider’s capsule clear; the new regression fails on original main parking and passes with the fix. No limits or solid-frame collisions were removed.
- Default verification runs the three native GPU scene checks and serialized transition checks. Smoke's Node section obtains the sim lock separately from its browser section, so it releases the slot before browser queue waits.
- Real-input travel stops when the objective completes (its story trigger may stop movement before the requested distance). Assisted spread/horde/bay cameras frame the existing actors without repositioning them.

## PO ending change (2026-10-07)

The courier now enters the fire station with normal player input. There is no final story beat, auto-walk, input lock, scripted invulnerability, hidden player/corgi, camera takeover or fade. A firefighter stands beside the open right bay, waves, and says **Get in!** every four seconds while the courier is within fourteen metres. The delivered human `civilian.hey` bark accompanies it; a recorded **Get in!** voice is not available. Infected AI and combat keep running until the courier crosses the entry volume, centred 1.2 metres inside the actual door with a 0.5 m radius. The shutter closes and the ordinary result panel displays the existing exact caption immediately after entry.

The previous ending teleported the player through a collider filling the station footprint, and its door/trigger anchors were on the apron. The lane corrects those anchors, uses the asset's existing authored collision shell, and lifts its existing sectional leaves before static batching. No art geometry is changed. Sim and browser paths now walk through the aperture, and a dedicated regression checks repeated calls, no automatic movement/protection, live chasers, and completion only inside. E19 §3 beat 10 and AC22 were updated at the PO's explicit request. Evidence below identifies completed measurements and their source provenance. Latest merged captures and GPU measurements precede the final bicycle-only parking fix; they were not refreshed after it. The evade-only bot now chooses connected escape destinations rather than steering an away-vector into the garage wall (**112.40 s, zero attacks/deaths/kills/damage** in the final default seed-3 check; [evade-bot.json](evade-bot.json)); the browser route reissues real clicks after combat/respawn.

## Civilian idle regression

Before the latest main merge, the first complete post-ending verification finished with **133 passed / 3 failed** in **27 passing / 2 failing files** (92 files / 491 checks skipped by selection). The evade route and subtitle-object assertion were corrected as above. The third failure was AC05: seed 1's civilian 48 stood for **1,989 ticks (33.15 s)** while its own healthy dog (49) stopped just ahead and body-blocked every walking destination. Changing destinations could not free it. The lane makes healthy **L1** pets follow beside/behind their owner with enough speed to keep up; body separation is retained, and earlier non-L1 pet behavior is unchanged.

The focused AC05 check passed after the fix (one selected test, six skipped), covering 20-seed population/appearance/speed checks and three 60-second calm-morning windows. The ≤3 s idle gate was retained. Evidence: `idle-diagnostic.json` / `idle-fixed.json`. The focused check also passed after the latest main merge: **1 passed / 6 skipped**, 29.82 s (`idle-merged.json`). The final full verification was stopped as requested; earlier full-run numbers remain historical diagnostic evidence.

## Timing calibration (20 seeds, no bot cheats)

| Profile | Completed | Median | Range | Deaths |
| --- | --- | --- | --- | --- |
| Complete, bicycle | 20/20 | 99.21 s (test upper-middle: 99.27 s) | 97.72–101.92 s | 0 |
| Newbie, on foot | 20/20 | 116.63 s (test upper-middle: 116.77 s) | 108.78–122.23 s | 0 |

Evidence: [complete-bots.json](complete-bots.json), [newbie-bots.json](newbie-bots.json). The unassisted real-input bicycle route passed after the PO ending change: **230.35 simulation seconds, 4 deaths, 28 kills, 551.27 damage** ([unassisted-result.json](l1v2/unassisted-result.json)). The harness reissues genuine clicks after combat/respawn; no god mode, teleports or objective completion cheats are used. God mode is used only on the separate visual capture route.

## Scenario correction / measured forecourt behavior

The genuine idle player stays at the forecourt after delivery with no teleport. To survive the whole observation window it is immortal. Infected continue selecting it as the closest visible human, creating an indefinite aggro sink. Original growth gates fail: upper-middle counts are **8 at +120 s and 10 at +240 s**, and **9/20** seeds reach 12 at +120 s. The initial 20-seed diagnostic runs are [forecourt-spread.json](forecourt-spread.json); the default verify retains seed 7 as the genuine forecourt regression ([forecourt-idle.json](forecourt-idle.json)), alongside the full 20-seed unopposed battery. On the final merged tree, genuine forecourt seed 7 records **5/9/13/15** infected at +0/+60/+120/+240 s, **20 bites**, zero deaths; the earlier 20-seed forecourt numbers are explicitly historical diagnostics. This avoids duplicating a long quantitative battery for a fixture whose growth contract has deliberately changed; each newly infected entity is checked against a turning bite, and director/route spawns must remain zero.

The quantitative growth fixture now explicitly moves only the observer to the northwest perimeter (-82, -52) at the exits, without advancing mission objectives. It retains the original ≥15/+120 s, ≥25/+240 s, and ≥18/20 floor gates, with provenance and zero director spawns. The isolated 20-seed bite-chain proof remains unchanged. Robust start tests all **100 seed/victim combinations**, lethally removing each of the five initial exit infected in turn and requiring an actual bite within 60 s with the same remote observer.

Final unopposed counts: conventional medians **32.5/+120 s** and **44.5/+240 s** (test upper-middle **33/45**), with **20/20** seeds at least 12 at +120 s; ranges **15–41** and **34–53**. Evidence: [unopposed-spread.json](unopposed-spread.json). All **100/100** seed/victim combinations produced an actual bite within the 60 s window ([robust-start.json](robust-start.json)).

## Performance

Main's first asset merge was measured before changing policy: morning **2,784,379** and accident **1,684,819** submitted triangles still exceeded 1.5M. Keeping the entire view at LOD0 hid the benefit of the new authored distance LODs. After merging latest main, its 45/90 m policy was measured again: morning **1,776,301**, accident **1,396,590**, horde **2,595,107** triangles, despite passing frame times. Evidence: `merged-45m/` and `merged-45m-budgets.log`. The lane retains 8/24 m selection and radius-scaled prop distances alongside main’s projected-size prop checks. No art is changed.

Native Metal WebGL2 samples (12 s minimum, resumed simulation), after the latest main merge:

| Spot | Population at setup | Peak triangles | Peak draws | p95 frame | GC heap |
| --- | --- | --- | --- | --- | --- |
| Morning | 60 civilians | 738,440 | 360 | 11.2 ms | 85.69 MB |
| Accident | 59 civilians, real smoke beat | 830,748 | 323 | 11.2 ms | 85.76 MB |
| Horde | 59 civilians + 30 infected | 895,977 | 363 | 14.1 ms | 87.07 MB |

`E2E_PORT=3317 sh tools/e2e-lock.sh npx playwright test tests/perf/l1-spots.spec.ts --project=chromium --workers=1`: **3/3 passed** (`merged-final-budgets-recheck.log`). An earlier simultaneous build caused a preview 404; that attempt was **2 passed / 1 failed** and was repeated after the build. The latest merged entry/regression batch passed both transition checks, Continue, assisted capture and E18 desktop, but initially failed the unassisted route at the parked bicycle (**5 passed / 1 failed**). The bicycle game fix makes the separate unassisted rerun pass **1/1**. Refreshing these measurements together on the final tree is deferred following the orchestrator’s stop request.

Desktop/mobile peak ending frames were **29.8/30.6 ms**. The worst of all seven desktop transitions was **45.8 ms**; mobile **30.6 ms**. All remain ≤50 ms. A historical busy run failed morning/horde p95 at **21/45 ms**; its samples remain in `contention/`, and no gate was relaxed. The populated tests sample peak draw/triangle counters throughout the window, collect GC heap, and require high tier, ≥300 simulation ticks, p95 ≤16.7 ms, draws ≤600, triangles ≤1.5M and heap ≤400 MB. Transition samples require every measured frame ≤50 ms. Passing bulky Chrome traces are discarded; raw samples and compact JSON remain.

### Earlier-epic regression comparison

Before the latest main merge, E18's 200-infected desktop gate failed during the shared-Mac run, both with the original rendering policy (**31.1 ms p95 / 6.0 ms p50**, 1,258,893 triangles) and the lane policy (**28.4 ms p95 / 5.7 ms p50**, 1,258,845 triangles). Those diagnostic JSON/logs are retained. After merging main's horde renderer fixes, the same desktop check **passes: 9.0 ms p95 / 3.3 ms p50**, 200 infected, 718 sim ticks over 12 seconds ([e18-merged.json](e18-merged.json), `merged-entry-and-regression.log`). No threshold was relaxed. This supersedes the earlier desktop failure; it does not establish an exhaustive campaign performance pass. WebGPU and physical-device measurements were not rerun; §6 reserves WebGPU for manual checking.

## Exact validation commands / results

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `SIM_WAIT=60 sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=4`: **269 passed in 82 files**.
- `E2E_PORT=3317 npm run test:smoke`: **5 simulation checks + 22 browser checks passed**.
- `SIM_WAIT=60 E2E_PORT=3317 npm run verify -- E19`: **INCOMPLETE, stopped by request** after the 100-case robust-start matrix. Typecheck, lint and build passed. Complete/newbie 20-seed results, evade, genuine forecourt, unopposed 20-seed spread and robust 100-case artifacts were written; the full Node file and verification totals were not finalized. Remaining Node checks and both browser phases were not reached (`verify-interrupted-by-orchestrator.log`, `verification-state.json`).
- `SIM_WAIT=60 sh tools/sim-lock.sh npx vitest run tests/sim/npc/l1-civilians.test.ts --maxWorkers=1 -t '50-60 civilians' --reporter=default --reporter=json --outputFile=test-results/epics/E19/idle-merged.json`: **1 passed / 6 skipped** after merging latest main.
- `npm run build`: passed within the interrupted default verification.
- `E2E_PORT=3317 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L1.spec.ts --project=chromium --workers=1 --grep 'unassisted'`: **1 passed** after the parking fix (`merged-bike-fixed.log`).
- `E2E_PORT=3317 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L1.spec.ts tests/perf/l1-transitions.spec.ts tests/perf/e18-desktop.spec.ts --project=chromium --workers=1 --grep 'unassisted|assisted visual|unlock|M1-22|T-E18-09'`: **5 passed / 1 failed** before the parking fix; the failed unassisted case passes in the separate fixed run above. E18 desktop, Continue, assisted captures and both transition devices passed.
- `SIM_WAIT=60 sh tools/sim-lock.sh npx vitest run tests/sim/bicycle-pavement.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=test-results/epics/E19/bike-parking-fixed.json`: **3 passed**. The new selected regression fails on original main parking, with the rider inside its blocker (`bike-parking-before.json`).

All browser runs were headless and used the machine-wide lock, maximum two workers, with a private preview port (3317). The verification simulation battery uses one worker under the sim lock. Browser fixtures enforce no unallowlisted console/page/network errors. Earlier attempts exposed the original bot-band failures, forecourt growth failure, over-budget LOD policy, route-harness stop issue, one transient batch of asset 404s, and one low-tier test-boundary typo; final outcomes above supersede those attempts where corrected.

## Every deviation / remaining work

1. **AC02/03 timing:** replace 4:00–6:00 / 4:30–7:00 bot bands with **1:15–3:00 / 1:30–3:30** per staging §6 and the measured 20-seed medians. No delays or level padding were introduced. Human pacing has not been newly measured; narrative beat timings remain human targets.
2. **AC06 observer contract:** quantitative spread uses a remote observer at (-82, -52), away from the forecourt. This point is inside the district bounds (-85..85, -55..55), so the final spec names the actual perimeter fixture rather than claiming it is outside the district. A genuine forecourt idle case is still run and reported, with the initial 20-seed diagnostic retained, rather than claiming its old growth floor passes.
3. **AC07 observer contract:** all five possible initial victims are tested on all 20 seeds, using the same unopposed fixture. This isolates resilience of the outbreak from unlimited player baiting.
4. **Capture framing:** the spread camera follows an actual systemic transforming victim rather than waiting for one at a fixed anchor; it is raised to see over a fence. Horde and bay use a reversed view, and smoke receives four seconds of render-only development. Actors are not teleported. The assisted route supplies the nine visual frames; the separate unassisted bicycle route supplies completion proof.
5. **Vision closure:** AC23 is not self-approved. Opus must score the five designated scenes against the reference and decide P0/P1 findings. Reference sheets became available in the main checkout during the lane run and were inspected read-only. The nonexistent §7.4 citation was corrected to 90-test-concept §7.1. Lighting keyframes are unavailable. The lane supplies A/D/E observations, leaving final scene scores and severities to Opus.
6. **PO ending:** the final scripted run-in/shutter/fade is replaced by normal player-controlled entry, as explicitly requested. Existing art metadata supplies the open bay and collision shell. The generic delivered human bark is used because no recorded **Get in!** voice exists.
7. **LOD selection:** retain 8/24 m with 2 m hysteresis and radius-scaled small-prop distances after remeasuring merged main’s 45/90 m policy above the triangle cap. Art is unchanged. Visual fidelity at the shorter distances remains part of Opus’s review.
8. **Earlier E18 performance:** historical desktop failures are retained; the same gate passes after merging main’s horde fixes. Other earlier-epic checks were not exhaustively rerun; unit and smoke regressions are recorded above.

9. **Validation stop:** at the orchestrator’s explicit 18:06 wrap-up request, no further long batteries were run. The robust matrix had just finished: 100/100 actual-bite cases across 20 seeds. Default verification remains incomplete.

### Remaining measurements / handoff

- Finish default verification on the final tree: remaining Node tests, the isolated 20-seed bite-chain proof, regular headless browser checks and the serialized native GPU phase. The isolated proof passed in the earlier complete Node run and remains in the default suite, but was not remeasured to completion after the latest main merge/bicycle fix.
- Refresh native scene/transition budgets and assisted captures after the final bicycle-only fix if required. Available measurements/captures are from the latest merged renderer immediately before that fix; the unassisted completion, unit and smoke runs are after it.
- Opus’s AC23 scene scores and P0/P1 judgment are pending. Physical-device/WebGPU checks and human pacing were not newly measured; full campaign performance was not exhaustively measured.

`vitest-prior.json` is the historical 133-pass/3-fail run before the corrected failures. The previously tracked `vitest.json` is an older 25-pass baseline, **not** the final run. Neither supplies current aggregate totals. See `verification-state.json` for current completed batteries and deferred phases. E19 is deliberately **in-progress**. No all-green verification claim is made.
