# Batch 112 real-input browser QA — review in progress

Candidate `cc2f7476c7e7834d5060b07a2b654a5d1cb1c873`. All requested level/tier capture runs are collected. **Not yet a complete acceptance pass:** L4 tank strike/roar/slam foot planting and full L9 route naturalness remain visually unqualified; ordinary off-screen scream arrow review is open.

## Method and validation

Unchanged physical keyboard/mouse playtest driver, ordinary mortal combat, debug level entry except L1 new game, headless WebGPU, HIGH runs before LOW, one browser at a time through the pool / `tools/e2e-lock.sh`, ports 5019/5020 and reservations capped at ten minutes. No source or playtest edits. Navigation/map assists are retained in raw logs. No zombie tuning or corpse lifetime changes.

QA build, typecheck and lint pass. Required `sh tools/remote/run.sh "$PWD" -- npm test` passes on 46.225.66.90: 27 files, 105 passed / one skipped, 150-case inventory retained, 134.9 seconds against 240 seconds. Earlier sandbox bind denials and runner unavailability were resolved; they produced no gameplay evidence. One L7 admission failed `external-exclusive`; guarded retry succeeded.

Raw logs/captures remain under `test-results/playtest/b112-*`. [qa.json](qa.json) is below 200 KB. Only this README, JSON and one small reviewed [contact sheet](contact-sheet.jpg) belong in git.

## L9 evacuation matrix

| Run | Defense complete tick | All living evacuated observed | Delay | Maximum grabbed age | Outcome |
| --- | ---: | ---: | ---: | ---: | --- |
| HIGH road 1 | 11441 | 11502 | 1.02 s | 0 | L10, 221 s, no skips/issues |
| HIGH road 2 | 11166 | 11974 | 13.47 s | 180 ticks | L10, 235 s, no skips/issues |
| HIGH shortcut | 9643 | 9668 | 0.42 s | 0 | L10, 190 s, no skips/issues |
| LOW road | 13690 | 14299 | 10.15 s | 0 | L10, 287 s, no skips; bridge warnings |

Timing uses simulation ticks / 60 and first-observed census bounds. `census.evacuated` confirms native truck evacuation; `aboard` alone also includes APC passengers and must not establish truck boarding. All four runs use `PLAYTEST_L9_EVAC_AUDIT=1`; maximum grab age comes from its per-tick audit.

Opened and reviewed the contact sheet, road-2 ticks 11635–11983 at approximately 2 fps: survivor runs toward trucks, count advances, departure follows. No obvious teleport is visible. Dense infected/APC occlusion prevents ruling out subtle sliding or running through infected. Other reviewed sequence paths are recorded below. LOW bridge warnings recover, but driver/product cause remains unproven.

## Findings and driver gaps

- **P2 provisional — L3 close target takes no damage during driver attacks.** Tick 10983, `test-results/playtest/b112-l3-high/captures/campaign-L3-10983-enemy-unhittable.jpg`. Reviewed image shows tight bridge crowd; aim/occlusion versus product hit logic remains unresolved.
- **P2 provisional — LOW L9 bridge navigation delay.** Ticks 15571 and 15765; `test-results/playtest/b112-l9-low-road/captures/campaign-L9-15571-stuck-navigating.jpg` and `campaign-L9-15765-stuck-at-ring.jpg` in the same directory. Run later completes; root cause unproven.

Driver gaps: opening empty-HUD navigation warnings in L4/L2; four-minute caps emit automatic P0 cannot-finish labels despite being intentional sample ends. Those labels are not established product P0s. L8 follow warning recovers. L1/L7 complete naturally before four minutes. L5 sample does not reach survivor rescue. L4 crowd/tank obscure soles. Ordinary off-screen scream arrow helpfulness/clutter is not established yet. No confirmed P1 or P3 product finding.

## Collected observations

### HIGH L9 matrix collected

Both road runs and the shortcut completed with zero skips and zero driver issues (221 / 235 / 190 seconds). Road 1 last living native evacuation is observed +1.02 s after Defense complete; road 2 +13.47 s. The earlier road-2 +0.48 s figure used `aboard`, which also includes APC passengers, and is invalid as truck boarding proof. The JSON now uses `census.evacuated`. Maximum recorded grab ages are 0 / 180 ticks for the roads. Road 2 visual sequence reviewed under `test-results/b112-review/road2.jpg`: running survivor and advancing boarding are visible; dense crowd occlusion prevents ruling out subtle sliding or brief infected penetration. Shortcut frames await review.

### L4 HIGH zoom 1.5 sample

Collected 240 seconds of ordinary real-input combat with no objective skips (`test-results/playtest/b112-l4-high-z15`). Reviewed `test-results/b112-review/l4.jpg`, ticks 5993–11507: busy plaza fighting, multiple large Alphas, corpses and explosive pressure; visually lively and dangerous. These wide samples do not establish planted soles during every strike/roar/slam at the tank. Driver gaps: empty opening HUD warns at tick 1253; the four-minute no-skip cap stops on the newly entered cellar route at tick 14236 and emits an automatic cannot-finish label. Neither establishes a product P0. Exact captures are in that run’s captures directory. Tank attack sequence review remains pending.

### L1 HIGH zoom 1

Completed the level in 143 seconds with no skips or driver issues (`test-results/playtest/b112-l1-high`). Reviewed sheet `test-results/b112-review/l1.jpg`, ticks 947–8092: bright readable streets and clear silhouettes; quiet package delivery escalates to pursuit and melee on returning to the clinic. Pleasant and legible rather than spectacular in the quiet opening, then purposeful pressure. No obvious geometry glitch in inspected frames. This covers the complete level but is shorter than the requested approximate four-minute sample because the mission finished.

### L2 HIGH zoom 1

Collected 241 seconds without skips, ending at the bridge-route sample cap. Reviewed `test-results/b112-review/l2.jpg` ticks 1558–13498: strong fire-engine staging and readable bright streets, then crowd pressure and repeated retreat/return around the market. The repetition feels less engaging than the staging, but driver navigation/deaths confound a product pacing judgment. No obvious geometry glitch in these frames. Driver warnings at ticks 1244/2713/2921 concern axe pickup and empty-HUD navigation; automatic tick-14287 cannot-finish is the four-minute cap, not a verified product P0. Exact issue captures and ticks are retained in qa.json.

### L3 HIGH zoom 1

Collected 240 seconds, no skips. **P2 provisional — close infected takes no damage during driver fire:** tick 10983, `test-results/playtest/b112-l3-high/captures/campaign-L3-10983-enemy-unhittable.jpg` (opened and reviewed). Driver reports #793 at 0.1 m, 60/60 HP after eight seconds of attacks. Capture shows the courier tightly surrounded on a narrow bridge and overlapping red telegraphs. Target selection, muzzle occlusion and product hit logic remain unseparated; this is not proven invulnerability. Bridge crowd pressure reads dangerous and visually dramatic, with clear courier outline, rather than harmless. Repeated confinement is frustrating in this driver sample. Four-minute stop at tick 14270 is a driver cap, not product P0. Broader frame review remains pending.

### L5 HIGH zoom 1

Collected 240 seconds with no skips. Reviewed `test-results/b112-review/l5.jpg`, ticks 1540–13514: atmospheric ash-dark streets, scattered persistent bodies, readable red Alpha warnings, and recurring combat around the fire station. The repeated search/return feels repetitive in this sample; it is not harmless, but survivor rescue/babysitting is unexercised because the driver remains on “Look for anyone still alive.” No obvious geometric glitch in inspected frames. The sole emitted issue is the sample cap at tick 14142 (`test-results/playtest/b112-l5-high/captures/campaign-L5-14142-cannot-finish.jpg`), not a verified product P0.

### L7 HIGH zoom 1

Completed in 183 seconds with zero skips/issues. Reviewed `test-results/b112-review/l7.jpg`, ticks 931–9470: dense dark escort, strong fire-lit departure, readable courier outline. “Wait for us! Stay with the group” at tick 3449 and “Survivor lost behind you” at 4688 make group-speed management conspicuous: this sample feels like babysitting amid real crowd pressure. The fire/departure staging is visually appealing; no obvious geometry glitch in sampled frames. Initial admission failed `external-exclusive` before execution; normal guarded retry succeeded. Full mission is shorter than the approximate four-minute request. No ordinary off-screen scream arrow judgment established by these frames.

### L8 HIGH zoom 1

Collected 241 seconds with no skips. Opened the tick-5252 follow warning capture (`test-results/playtest/b112-l8-high/captures/campaign-L8-5252-stuck-at-ring.jpg`) and `test-results/b112-review/l8.jpg`, ticks 1658–13474. Quiet Nadia following feels like group babysitting; the later crowded plaza ring is more dramatic and dangerous. The warning frame shows Nadia ahead with a visible ring and the courier six metres behind; subsequent frames reach the plaza fight and habitat objective, so a permanent mission stall is not supported. No obvious geometry glitch in inspected frames. Tick-14264 cannot-finish is the four-minute cap; follow-navigation warnings remain driver gaps pending exact cause. No ordinary off-screen scream arrow assessment is established by these frames.

### LOW L9 collected

LOW road completed in 287 seconds with zero skips. Native last-living evacuation observed 10.15 seconds after Defense complete; maximum recorded grab age 0 ticks. Two bridge navigation warnings at ticks 15571/15765 recovered before completion; exact capture paths are retained in qa.json. Driver-versus-product root cause remains unproven. Reviewed L4 consecutive sequence `test-results/b112-review/l4-sequence.jpg` (ticks 8952–9242, roughly 2 fps): crowd/tank occlude feet; full strike/roar/slam sole planting remains unqualified.

### Additional full-size review

Opened L4 `captures/campaign-L4-t9007.jpg` at full size: several Alphas attack among overlapping rings, but tank/crowd occlusion prevents individual sole tracking. Opened LOW L9 `captures/scream-L9-8411-1-1.jpg`: ordinary native scream telegraph at tick 8411, seated hatch phase, no clear violet edge arrow in the wind-up frame. Eight ordinary telegraph windows are logged at 8411/8759/9107/9260/13738/13741/13751/13761; the callback captures do not establish released-noise arrow visibility or moving-courier usefulness. Keep the arrow judgment open rather than treating Alpha roar footage as ordinary scream proof.

### LOW evacuation route review

Opened `test-results/b112-review/low-evac.jpg`, consecutive ticks 13911–14137 at about 3 fps. A survivor runs along the clear foreground lane toward the trucks. Visible travel reads natural: no obvious teleport, foot sliding, or running through the infected pack in this segment. Final entry is partly APC-occluded, so this does not qualify every survivor route or every transient. Violet source rings in this sequence are conspicuous and on screen; they do not qualify off-screen arrow clutter/usefulness.
