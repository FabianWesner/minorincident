# Batch 92 focused real-input QA — HOLD

Target: **PROD `4f3dfdf9`**. Worktree `64594b3f` matches its `src/`, `public/`, and `package.json`. **HOLD because required coverage remains incomplete.** No confirmed gameplay P1 or P2 was established; this does not clear unchecked areas.

[Evidence index](evidence.json) · [Opened contact sheet](contact-sheet.jpg)

## Required coverage

| Requirement | HIGH evidence | LOW evidence | Disposition |
| --- | --- | --- | --- |
| L10 timing at 60–70 active infected, corridor/dispersal and finale; equal load | Peak 59 in farms; no qualifying frames | Peak 46 across LOW probes; no qualifying frames | **Open.** Later regions/finale not reached. |
| Journey attackers every ≤45 s; visible pop-in/sprinters spawning on screen | Partial farm route only | Partial farm route only | **Open.** Neither full cadence nor spawn visibility proved. |
| Hunting Mega rifle/shotgun/nail gun damage; sustained ~35% floor and recovery after ~1 s | Rifle damage, floor and recovery proved | Rifle floor and recovery proved | **Partial.** Shotgun and nail gun not tested against Mega. |
| Full farm-road crop/ground-cover sweep | Two opened roadside views show no crops on displayed asphalt | Farm combat view opened, no systematic road sweep | **Open.** No crop-on-asphalt finding confirmed. |
| Mega does not jump far backward after death/checkpoint retry | Farm retry coordinates retained; lateral staging and some backward road movement observed | Retry samples retained locally | **Qualified/open.** No finale retry or full-route proof. |
| L6 HIGH completion with first hatch closed; group attacked every 30 s | Full completion and closure in one run; all ten full post-closure 30 s windows had group attacks in a separate run | Exit reached; no full completion within 480 s; exact cadence observer failed in this run | **HIGH conditions evidenced separately.** No single uninterrupted completion/cadence claim. LOW completion remains open. |

## Hunting Mega

HIGH normal rifle hits dealt 300 damage against the 3000-HP pursuer. Sustained fire reached **1050 HP (35%)** at tick 3412; hits at 3472, 3774 and 3953 dealt zero at that floor. Later positive hits again returned to 1050, demonstrating recovery between hits. In a separately observed HIGH sequence, HP rose 2400 → 2406 at **61 ticks / 1.017 s since the last hit**, then increased on subsequent ticks.

Actual LOW rendering was verified after restoring the save and changing quality through pause/settings UI. The LOW rifle-only run made 114 rifle attacks in 180 s with four deaths. It reached **1050 HP** at tick 5744; the next hit at 5805 dealt 6 and returned to 1050. Its observer also captured recovery beginning **61 ticks after the last hit** (2700 → 2706). These are hunting-phase measurements, not the armored finale.

Key raw directories: `test-results/playtest/s96-b92qa-l10-high-cycle/`, `s96-b92qa-l10-high-measured/`, and `s96-b92qa-l10-low-rifle/`. Compact hit/recovery examples are in the evidence index.

## Frame intervals

The required 60–70 load was not reached. Supplemental presentation intervals at **exactly 40 live infected** are below. These are farm encounters, include combat/deaths, and exclude initial quality-settling ticks. They do not establish corridor/dispersal or finale performance.

| Tier/run | Frames at exactly 40 | Mean | P95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| HIGH mixed | 88 | 16.666 ms | 16.700 ms | 16.800 ms |
| LOW actual | 351 | 16.714 ms | 16.800 ms | 33.400 ms |

rAF intervals describe presentation cadence, not isolated render CPU/GPU time. The frame observer counts living, visible, admitted entries in the infected manager's active list. The established ledger's broader living-active count also stayed below 60 in the inspected HIGH runs.

## L6

The opened HIGH result card confirms **349.57 simulation seconds**, five deaths, one survivor out of 29, and 28 lost/turned. Driver wall time was 370 s with one logged navigation assist and no objective skips. First hatch closed at tick 15376; later hatches at 17457 and 18990. The experience was costly and dangerous, not a clean escort.

A separate HIGH shotgun run established first closure at tick 8996 and recorded 450 group attack starts. Successive full post-closure 30 s windows counted **13, 2, 22, 30, 37, 25, 35, 28, 32, 25**; the final 23.1 s counted 24. The first two full windows had no player deaths; later windows included deaths. That run reached the exit but did not complete within 480 s (14 deaths). These two runs are separate evidence and must not be merged into one uninterrupted completion.

LOW reached the exit but did not finish in 480 s (16 deaths, one navigation assist). Its established ledger recorded 391 group windups in retreat and 133 at exit. The first timestamp observer had an empty event stream despite those ledger counts; its zero window counts were discarded. A mission-bound observer was subsequently validated in HIGH. The scripted shelter rest explains the automatic navigation warning.

## Retry observations and visual review

HIGH death/respawn Mega coordinates include **(1089.93, −24.78) → (1057, 80)** and **(1238.43, −22.41) → (1297, 25)**. The first is about 33 m backward along the road plus substantial lateral staging. This limited farm sample does not prove the full no-far-backtrack requirement, and no confirmed retry P2 is asserted.

All four contact-sheet sources and the completed sheet were opened. HIGH roadside samples show clear asphalt in the displayed area, adjacent ground cover, a marked weapon and pursuing infected. LOW shows the farm death loop and retained bodies. The HIGH L6 panel is the actual result card. No full road sweep or spawn pop-in acceptance is inferred from these stills.

## Method, validation and remaining work

Read `docs/qa/po-checklist.md` and the s94 report. HIGH was exercised before LOW; later HIGH repeats gathered missing instrumentation. Sessions used WebGPU, zoom 1.5, the browser pool/e2e lock, headless, at most one browser, unique ports 4961/4962, and reservations below ten minutes. Movement/fire used physical WASD, mouse and keys; no god mode, teleport, manual weapon grant, objective skip, spawn injection, or gameplay-state tuning was used. Only genuinely reached saves were copied/resumed. Authored checkpoint reconstruction was inspected and rejected because it completes preceding objectives.

Temporary QA copies under `/private/tmp` corrected the driver's unsupported `Digit19` selection using physical Q cycling, applied actual quality through menu input after resume, added read-only observers, and varied normal carried-weapon tactics. Repository game/tool source is unchanged. Repeated farm attempts stopped near the molotov/nail-gun approach; automatic stuck/unhittable warnings were not promoted to gameplay defects without stronger evidence. Actual molotov throws were eventually verified, but did not establish route passage.

Production build, QA build, typecheck and lint passed. The unchanged prescribed remote `npm test` passed on **46.225.66.90**: 27 files, 106 tests passed, one skipped, **217.3 s within 240 s**, with 150/150 budget collection. Initial sandbox/listener and runner-startup failures were resolved before successful sessions. No deployment, push, main movement, or game fix was performed.

Remaining gates: reach the later journey and finale normally; measure 60–70 live infected at both qualities; complete the ≤45 s arrival and opened spawn-visibility audit; test shotgun/nail gun against the hunting Mega; sweep every farm road; finish retry coverage; and complete any remaining LOW/L6 coverage. **The focused QA goal is not complete.**
