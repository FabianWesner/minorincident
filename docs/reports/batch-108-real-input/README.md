# Batch 108 real-input QA — reject for intermittent HIGH evacuation delay

Candidate `4f50ecb9`. **P1: one HIGH road run remains 3/4 aboard at least 28.50 seconds after “Defense complete.”** It eventually hands over to L10. Other completed samples board before defense ends or within approximately 9–13 seconds. The first shortcut attempt stalls before the bay; its recorded retry completes normally. The requested moving HIGH zoom-1 screamer matrix is **not approved**: real-play video exists for L6/L9/L10, but the reviewed zoom-1 samples do not establish ordinary violet-ring noticeability in all three levels.

## Method and validation

Normal combat and physical keyboard/mouse input through the existing playtest driver; debug level-menu entry, with map/navigation assists logged by the driver. No immortal or route-only runs, spawned enemies, HP changes, objective skips, source fixes, or edits to `tools/playtest`. HIGH first, LOW afterward; WebGPU renderer receipts in each accepted run. One headless browser at a time under `tools/e2e-lock.sh`, reservations capped at ten minutes, preview port 4999. Ignored wrappers request native Playwright video, optionally set the level-load seed while forwarding the other load arguments, and collect read-only telemetry. Native recording was needed because pooled recording requests delivered no local video artifact. Aborted wrapper startup attempts are excluded from results.

Typecheck and full lint passed. Exact required remote `sh tools/remote/run.sh "$PWD" -- npm test` passed on runner 46.225.66.90: 150-case inventory retained, 105 passed/one platform skip, 27 files, 129.6 seconds within 240 seconds. Initial sandbox build/cache/socket/Git restrictions and initial runner unavailability were resolved before the accepted runs. Only this README, [qa.json](qa.json) below 200 KB, and one small [reviewed contact sheet](contact-sheet.jpg) belong in the commit. Raw captures, videos, logs and wrappers remain under ignored `test-results/b108/`. No deployment, push or main-branch move.

## L9 evacuation matrix

| Sample | Tier / zoom | Result | Boarding relative to defense complete |
| --- | --- | --- | --- |
| `l9-high-road-webgpu` | HIGH / 1.5 | 207 s, zero deaths/skips, L10 loading handover | **FAIL:** first defense-complete tick 8859; still 3/4 at 10569, +28.50 s |
| `l9-high-shortcut` | HIGH / 1.5 | Stopped at 480 s, no skips | Unmeasured: boarder-removal approach stall near (436.9, −1.6), tick 28356 |
| `l9-shortcut-observed` retry | HIGH / 1.5 | 197 s, zero deaths/skips, playable L10 handover | PASS: defense HUD tick 9142; four evacuated first observed at 9922, +13.00 s; all four humans HP 100 |
| `l9-seed2-valid` road | HIGH / 1 | 202 s, zero deaths/skips, playable L10 handover | PASS: 4/4 at tick 9193 with 16 s defense remaining |
| `l9-low-road` | LOW / 1.5 | 225 s, zero deaths/skips, L10 loading handover | PASS: defense HUD 11058; bridge-driving phase at 11601, +9.05 s |

Seed 2 is selected by the ignored level-load wrapper; the campaign metadata retains its original seed 1. It is a level-world seed override, not a new campaign seed. An additional HIGH road zoom-1 native video run completes in 213 s without deaths/skips; it supplies warning-motion review rather than replacing the timing failure.

**P1 timing finding:** raw receipt `test-results/b108/l9-high-road-webgpu/log-campaign.jsonl`, tick 10569. The first and last HUD observations bound the delay; exact last boarding was not recorded in this run. Context capture `captures/campaign-L9-t8116.jpg` shows the earlier hatch defense at full courier HP; `captures/campaign-L9-t10817.jpg` shows the later departure cinematic. Neither screenshot alone proves the 28.50-second timing bound; the timestamped HUD log does. The prolonged healthy-courier wait reads as babysitting. Eventual handover excludes a permanent softlock in this sample.

The first shortcut's P0 `cannot-finish` / `mandatory-crossing-stalled` labels describe the driver's failure, not an established product P0. Capture `test-results/b108/l9-high-shortcut/captures/campaign-L9-28356-cannot-finish.jpg` and the issue JSON/log preserve its location and prompt. The unchanged route's successful retry shows the stall is intermittent or input-dependent; root cause is unproven.

### Grabs, rescues and trucks

Read-only `l9-shortcut-observed/observer.jsonl` catches Rosa #670 grabbed (first sampled tick 7492, attacker #840), then later returning to flee at 8737 with HP 100. Okafor #671 is last sampled grabbed at 9382 and fleeing at 9397; Mia #672 is last sampled grabbed at 9277 and fleeing at 9292, both HP 100. All four humans #669–672 are aboard/full health by 9922. The dog's separate roster entry is excluded from the four-human count. No identity-level combat-hit attribution was recorded, so **guard-versus-courier rescue attribution remains unverified**. Do not infer that guards freed them solely from the absence of damage.

The reviewed follow zoom-1.5 defense views show a clear APC lane, guard line, and portions of the staging area. No new truck/furniture intersection was identified in those views. **All-three-truck barrier/sign/fence clearance is not conclusively verified** because the follow camera crops/occludes parts of the trucks; s129's separate placement fixture is historical evidence, not this report's real-play clearance pass. L9's dramatic APC departure is visually striking in the sampled cinematic; this does not establish a universal “stunning” verdict or performance qualification.

## Screamer warning in real play

All native videos are under the corresponding run's `video/` directory. L9 HIGH zoom 1 `l9-native-video` includes ordinary scream telegraphs at 6264 and 6612. Reviewed video 118–122 s at 4 fps (`review/l9-scream-sequence.jpg`) shows hatch combat but no conspicuous local violet cue. No completed scream-noise event is captured in that run. Source visibility/interruption prevents classifying this as a demonstrated rendering defect or moving-camera pass.

The HIGH zoom-1.5 shortcut retry supplies **actual ordinary source-cue evidence**: `review/l9-shortcut-scream.jpg`, video 142–148 s at 4 fps, around telegraphs 8221–8461. Brief violet double strokes appear above the source near the upper-left HUD, distinct in color and shape from red ground attack rings. They remain brief and compete with the crowd and HUD. This is seated hatch combat at zoom 1.5, **not** the requested moving zoom-1 acceptance sample. No scream-noise event is present in the uncapped observer; the production VFX can also emit the cue as a telegraph retires, so absence of noise is not proof that no visual pulse appeared.

L6 HIGH zoom-1 `l6-video` records 240 s, four deaths, and eight Alpha-roar captures. The 130–136 s sequence at 2 fps (`review/l6-sequence.jpg`) shows movement, firing, and conspicuous red warnings on a dark tunnel floor. A further `l6-long-video` 480 s sample records 18 deaths and again exhausts its screenshot budget on Alpha roars. The observed screamer-type Alpha uses `alpha.roar`; it does not establish ordinary violet-ring readability. The courier is identifiable in the reviewed lit tunnel sequence, but repeated deaths establish substantial pressure rather than harmlessness. The initial “Look around the shelter” wait triggers a driver stuck warning; it is an authored calm/timer phase and is not independently classified as a navigation defect.

L10 HIGH zoom-1 `l10-video` records 360 s, 13 deaths, eight Alpha-roar captures, and the residential checkpoint. Reviewed 125–131 s at 2 fps (`review/l10-sequence.jpg`) shows axe combat and red circular/charge warnings clearly; repeated nearby fighting blocks progress to the ordinary fringe screamer. It feels punishing and repetitive in this driver sample, not harmless. A 480 s seed-2 repeat records 18 deaths and 15 Alpha roars in the uncapped observer, with no ordinary scream; runtime seed 2 is confirmed in those receipts. No ordinary moving-ring pass is claimed without an observed event and reviewed sequence.

A focused HIGH zoom-1 shortcut repeat (`l9-moving-zoom1`) completes in 203 s without deaths/skips. The ignored wrapper sends one logged second of physical KeyW at nearby scream tick 7601. Courier/APC position remains effectively unchanged, so the input does **not** establish moving-camera coverage. Reviewed 133–145 s at 4 fps (`review/l9-zoom1-source.jpg` and `review/l9-zoom1-source-later.jpg`) contains crowded hatch combat and red warnings without a conspicuous local violet cue. This is a bounded visibility observation, not proof of a missing render effect.

**Disposition:** the new source cue is visible and distinct when encountered in the supplemental real L9 hatch sequence, but L6/L9/L10 moving HIGH zoom-1 noticeability remains an explicit acceptance gap. Scene-fixture evidence from s130 is not substituted for real play.

## L4 HIGH three-minute spot

`l4-video` records the full 180-second sample at HIGH zoom 1: west and north breach fighting, 998 army-MG attack inputs, seven deaths, no objective skips. Reviewed 110–122 s at 1 fps (`review/l4-sequence.jpg`) shows a dense mixed crowd of ordinary infected and Alphas, sustained combat, and accumulating bodies. **“Just two Alphas / almost no fight action” was not reproduced.** This short spot does not qualify the full level or every wave.

**P2 courier crowd readability:** in the thickest reviewed frames the courier is difficult to distinguish among large bodies, health bars, red warnings and foreground vehicles. Capture `test-results/b108/l4-video/captures/campaign-L4-t8139.jpg` (tick 8139), with the 110–122 s sequence as motion context. The crowd is active and dangerous, not boring or harmless; the brief early empty-HUD pause is separate from the battle. No new geometry glitch was established by this sample. Corpse persistence was not modified.

## Driver gaps and limits

- The first-eight-warning screenshot cap can be exhausted by Alpha roars; later ordinary events then lack dedicated still captures. Continuous video and the later uncapped wrapper observer partly address this, without patching the driver.
- Pooled video requests delivered no local artifact; admitted native headless recording works. Startup attempts with an incorrect seed wrapper were aborted before gameplay and excluded.
- The driver can stall shaking off boarders before L9's bay; normal L10 axe combat repeatedly dies near the farm entrance. These limit acceptance coverage and are not automatically product softlocks.
- No guard/courier hit attribution for released evacuees; no complete all-truck follow-camera clearance proof; no ordinary screamer moving zoom-1 pass in L6/L9/L10. These remain open and are not represented as passing results.

The report rejects batch 108 on the reproduced P1 and retains the P2 crowd-readability finding. It does not approve the outstanding screamer and placement criteria.

## Final report audit

The requested four-slot L9 matrix was attempted, with the stalled shortcut additionally repeated to completion; timing receipts and real L10 handovers are retained. L6/L9/L10 have actual normal-combat videos and reviewed frame sequences; the absent/missed ordinary cues and ineffective movement probe remain fail-unproven acceptance results. L4 has its full three-minute spot and reviewed crowd sequence. All checked levels have bounded feel/glitch observations above. The two severity-ranked findings have evidence paths/ticks. The sole committed sheet was opened and inspected, JSON is below 200 KB, and validation passed. This is a completed rejection report with explicit acceptance gaps, not full batch approval.
