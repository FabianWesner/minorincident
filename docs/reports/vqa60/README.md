# vqa60: Opus visual QA of batch 60 before an interim deploy

Main `78a7a613` (after `lane/r9-kite58`), QA-hooks build (`npm run build:qa`). Baseline: PROD batch 59 = tree `2741447`, built with the same QA hooks in a temporary worktree (removed afterwards), so b59 and b60 run the same tools side by side. 2026-11-08 09:50–10:55 CET. Findings only, no game code changed.

## Verdict: GO for an interim PROD deploy (PO 11-03 rule)

- **No regression against PROD b59** in any A/B: L1, L2, L4, L5, L6, L8, L9, L10 start views match at WebGPU low and WebGL2 high, zoom 1 and 1.5. The E25 emitter re-export and light anchors change nothing visible on accepted levels. The L2 fire-engine cab with its crew reads the same.
- **No new defect on the player, the companion or a vehicle the player uses.** The one player-figure finding (L9, launcher held while lying) is a leftover of a pre-UAT fix. PROD shows the launcher through the whole crawl, so b60 is better.
- **Clear gains over PROD:**
  - **L7:** 24/24 boarded in 132 s (WebGPU low), and 23/24 and 21/24 in two WebGL2 high runs. vqa59 had 4/24, 0/24 boxed in, and a cap. The bus block from vqa59 did not happen.
  - **L10:** the overland walk now passes burning cars, camps, tanks and quarantine posts.
  - **L8:** the APC holds its spot while boarding.
- **Not strict-acceptance PASS for L6.** Both real-input L6 runs stall at the exit, and PROD b59 stalls the same way (see P2 below). The PO should look at it during UAT; it does not block an interim deploy.

## Findings

| Sev | Level | Finding | Evidence (`test-results/vqa60/`) |
|---|---|---|---|
| P2 (inherited, same on PROD) | L6 exit | **The retreat ends in a long stall at the exit stairs (x 242–262).**<br>• WebGL2 high, male: the courier stands on the exit-platform ring for 70 s (t11243–t15428). The objective says "Stay with the group · 0 m" while the banner says "Survivor under attack! Turn back!". No survivor is in frame or on the minimap, and the run ends `cannot-finish`. Neither the ring nor the minimap tells the player where to turn back to.<br>• WebGPU low, female: "Bring the survivors into the night · 1/1 out · 24 m". The driver pushed D+S into a wall corner at (249.4, 11.2) for 145 s.<br>• A probe at that spot (`l6exit/probe-249.4-11.2.json`) shows +x and −z blocked, while +z (up the stairs) and −x are free. That case is a driver limitation, not a trap.<br>• **PROD b59 with the same driver and config also stalls there:** "Stay with the group", `cannot-finish` after 97 s (`b59-runs/l6-b59-gl-high-1`). | `l6-gl-high-1/captures/…-L6-t13938.jpg`, `l6-gpu-low-15/captures/…-L6-20120-cannot-finish.jpg`, `sheet-l6-gl-high-end.jpg` |
| P2 (fix incomplete; PROD is worse) | L9 crash | **The courier lies with the rocket launcher across her body for about 2.3 s after the bridge collapse.** This is at "Crawl clear of the wreck · 20 m", before the crawl clip starts (t6643–t6783 and t7097–t7200). It shows in both runs and with both couriers.<br>• `2ee1abc9` hides held props only while `scriptedClip === 'crawl'`, so the crash-landing pose still shows the gun.<br>• Q-304 says lying/downed figures show no gun. | `l9-gl-high-1/captures/l9-gl-high-1-L9-t6735.jpg`, `crop-l9-crawl-start.jpg`, `l9-gpu-low-15/captures/…-L9-t7200.jpg` |
| P3 (1 of 3 runs) | L7 corridor | **"Wait for us! Stay with the group." held the driver about 55 s at (61, 31)** (t4223–t7500, 86 → 93 → 92 m), with "Group 22/23 nearby · Waiting for a survivor (19–33 m away)". Most of the column waited on the far side of a fence line. This feels like babysitting one straggler (Q-328).<br>• Runs 2 and 3 were clean: 3 and 0 "waiting" observations, against 28 here.<br>• b59 with the same config also had 3. | `l7-gl-high-1/captures/…-L7-t6378.jpg`, `sheet-l7-gl-high.jpg` |
| P3 (inherited) | L8 opening | **No objective text for the first 60 s** (t21–t3602) while the group stands at the bus. The courier has nothing to do. b59 is the same (A/B start views have no objective box). | `l8-gpu-low-15/log-…jsonl`, `sheet-l8-gpu-low.jpg` |
| P3 (inherited) | L10 R6 corridor | **The southern forecourts are a flat dark-navy plane with no texture**, so the crossing bus and truck sit on a "void". The scenes help, but the floor still reads empty. Same in b59. | `ab/L10-cross-r6s-z1-webgl2-high-b60.jpg`, `ab-l10b-low.jpg` |
| P3 | L10 R3 | In Scene Lab stills, the "still burning" police car shows no flame or glow at its catalog spot. Burning cars do show flames in real play (`l10-gl-high-1/captures/…-L10-t10773.jpg`), so this is probably a still-frame artifact. | `ab/L10-cross-r3-z1-webgpu-low-b60.jpg` |
| P3 (inherited, design) | L5 search | The real-input driver finds 2/5 hidden survivors and then stands still, because hiding places are found by sound (Q-302). b59 behaves the same. This is not a game defect. | `l5-gpu-low-15/…cannot-finish.jpg`, `b59-runs/l5-b59-gpu-low-15` |

## Targeted checks

| Item | Result | Evidence |
|---|---|---|
| **Followers never block the courier, without popping** (r8-nobox) | **PASS.**<br>• L7 start, input-frame walk into the column, 4 directions × 1.5 s. The courier covers 26.3 m in 6 s in b60 (26.1 m in b59), so she is never held.<br>• The largest per-tick move of any follower or companion within 4 m is 0.137 m (the corgi running), and there are no jumps over 0.15 m. b59 measures 0.142 m.<br>• No popping in the real-input frames either. | `ab/receipt-gl.json`, `ab/receipt-gpu-high-b60.json`, `ab/L7-push-end-*` |
| **L7 boarding / rocket knockdown / yield** | **PASS:** 24/24 in 132 s; 23/24 in 218 s; 21/24 in 138 s. The bus queue reads well and the corgi stays clear of the door. Rocket blasts throw infected without whiting out the frame. | `sheet-l7-gpu-low.jpg`, `l7-gpu-low-15/captures/…-L7-t7032.jpg` |
| **L8 APC hold** | **PASS:** the APC stays on its ring under fire, the courier boards last, and 8–10 humans are rescued in 116–121 s. The generator light reads well. | `sheet-l8-gpu-low.jpg`, `l8-gpu-low-15/captures/…-L8-t5928.jpg` |
| **L9 crawl weapon / seated gear** | The crawl itself shows no held weapon (`…-L9-t7513.jpg`); see the P2 for the moment before it. The APC drive and bridge collapse look whole, with no floating wheels. | `sheet-l9-gpu-low.jpg`, `sheet-l9-crash.jpg` |
| **L10 crossing scenes** (7 catalog spots in the production level, b59 vs b60, WebGPU low/high and WebGL2 high, zoom 1/1.5; plus 2 real-input overland runs) | **PASS:**<br>• Before, every spot was empty grass. Now the spots show a camp, a burned police car, a tank with a lit sandbag stop, a quarantine post with a generator lantern, a burned evac bus, and a truck stop.<br>• Nothing floats or sinks, there is no z-fighting, and no piece covers the courier.<br>• In real play, a burning car, camps, a tank with a fire and infected appear along the walk. | `ab-l10-low.jpg`, `ab-l10b-low.jpg`, `sheet-l10-cross-glhigh-b60.jpg`, `sheet-l10-gl-high.jpg`, `sheet-l10-gpu-low.jpg` |
| **L10 corridor → console → Mega** (tracked checkpoint, WebGPU low and WebGL2 high) | **PASS (visual):**<br>• The defence wave is huge and readable, and the corpse piles read as bodies. A corpse on the platform stairs looks natural.<br>• No Mega waypoint is shown, as designed.<br>• The driver stops at "Kill the Mega Alpha" (it does not hunt), so the Mega fight was not seen; L10-11 stays the known open P2. | `sheet-l10t-gpu-low.jpg`, `l10t-gpu-low-15/captures/…-L10-t21431.jpg` |
| **L6 render** (follower pips, underground headwear) | **PASS:** cyan pips sit above the survivors, and headwear does not glow underground. | `sheet-l6-gpu-low.jpg`, `ab-plain2-low.jpg` |
| **L1/L2/L4/L5 regression vs b59** (lights on re-exported models, L2 cab) | **No change.** Start views match pixel-for-pixel by eye at WebGPU low and WebGL2 high, zoom 1 and 1.5. The L2 ride at +12 s is the same as b59. | `ab-plain1-low.jpg`, `ab-plain1-glhigh.jpg`, `ab-plain2-glhigh.jpg` |
| **L5 pressure vs b59** (WebGPU low, preset, same seed and driver) | **Parity.** The mean number of live infected within 15 m per 30 s window is 0.6/1.4/2.6/1.4/6.9/2.6/4.6/1.9 in b60 against 0.8/2.2/1.2/3.0/6.4/2.3/4.0/1.0 in b59, and 51% vs 66% of observations have an infected within 15 m. The b59 run lasted longer (383 s vs 318 s) before both stalled at 2/5 found. | `l5-gpu-low-15/`, `b59-runs/l5-b59-gpu-low-15/` |

## Stunning? Boring, harmless, babysitting?

- **L6:**
  - Stunning: yes underground. The lit shelter, the side-entry breaches and the tunnel retreat with the group are moody.
  - Babysitting: yes at the exit (P2). The run ends with the courier waiting on a ring while a banner tells her to turn back.
- **L7:**
  - Stunning: yes. A column of 24 survivors in the ash night, rocket blasts that throw the horde, and the lit bus at the end.
  - Not harmless: 205–405 kills per run.
  - Babysitting: one of three runs had the 55 s wait.
- **L8:**
  - Stunning: good. The night zoo path with lamp light and the APC with a generator floodlight.
  - Boring: the first minute (no objective).
- **L9:**
  - Stunning: the collapse is a strong beat.
  - Boring: the 100 s drive is long and dark, with sparse infected.
  - Harmless: 0–2 kills.
- **L10:**
  - Stunning: much better than b59 on the overland walk, and the console defence is spectacular.
  - Boring: dark empty stretches remain between scenes, and the R6 forecourt void is still there.

## Not covered

- No WebGL2 low real-input runs; I covered WebGPU low and WebGL2 high at zoom 1.5 and 1.
- No mortal-courier runs; every run used god mode, so damage numbers are not meaningful.
- The L10 Mega fight itself: the driver does not hunt the Mega.
- L3 was out of scope (r9-kite58's L3 finale admission was not checked visually).
- The A/B ran against a local QA-hooks build of tree `2741447`, not minor-incident.com itself (PROD has no test hooks).

## Method

- **Real input:** `tools/qa/vqa60-run.ts` (copy of vqa59-run), shared browser pool, god-mode courier, preset saves, 8-minute level cap.
  - Matrix: L6, L7, L8, L9, L10 × (WebGPU low zoom 1.5, female or male) and (WebGL2 high zoom 1).
  - Extra runs: L10 from the tracked corridor checkpoint on both configs, a second L7 WebGL2 high run, and L5 WebGPU low.
  - The b59 runs for L5, L6 and L7 used vqa59-run in the baseline worktree.
- **A/B:** `tools/qa/vqa60-ab.ts` serves both builds via vite preview and covers:
  - start views of 8 levels;
  - 7 L10 crossing spots;
  - the L2 ride at +12 s;
  - the L7 push probe, with per-tick follower displacement and `jumpList`.

  At most 2 of my contexts ran at once in each phase (3 briefly). No browsers were killed. One A/B batch hit the 10-minute reservation cap and was re-run split.
- **L6 exit probe:** `tools/qa/vqa60-l6-exit.ts` teleports to the stall spot and walks 8 directions by input frames.
- **Summary sheet:** `test-results/vqa60/sheet-vqa60.jpg` (8 cells, 100 KB; docs/reports images are git-ignored since the 11-05 archive rule). All captures stay in `test-results/vqa60/`.
