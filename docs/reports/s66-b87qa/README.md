# Batch 87 real-input QA — s66-b87qa

**Pre-deploy verdict: HOLD. Coverage is incomplete and two new failures need review.** Game code tested: `91199b68`. No game code or specs changed; no deploy, push or main movement.

Headless WebGL2/Metal, LOW, 1280×720, one browser through `tools/e2e-lock.sh` / browser pool, ports 4867/4868. God OFF (`LUNA_MORTAL=1`). Normal menu and standard campaign level-start save only; no onward fixtures, teleport, bot or invulnerability. All movement, aiming, firing, hatch and driving actions used keyboard/mouse. The stock live harness enables the joint-pose audit probe; no entity/world probe results were used for navigation or aiming. Route decisions used screenshots, objective marker and HUD. A temporary driver also read the *rendered* marker DOM rectangle to send WASD; a later L9 retry replayed recorded real device inputs until contact divergence, then returned to manual views. The step harness pauses between actions, so this is **not a sufficient continuous-motion quality gate**. L9 final retry explicitly set camera.zoom(1); normal view and API 1.5 view were opened. API 1.5 widens the view; three real wheel-up notches then gave about 1.52× close magnification, also opened (turn17, HUD473m). Exact 1.5× close remains unverified. Later L8/L4 retries explicitly start at API zoom 1; L4 also has an opened ~1.52× close view at `l4-armor/.frames/turn-000019-action.jpg`, tick 2994, HP 30: nearby human, armored and butcher figures at the perimeter. L8 close coverage remains incomplete. A later L8 recordVideo request exported no artifact, so it supplies no continuous-motion verdict. Raw evidence and numbered input/action frames stay in `test-results/s66-b87qa/`.

QA build `MI_BUILD_CACHE=off npm run build:qa` passed (11.08s). Initial listener permissions were subsequently resolved. Browser idle release and 595 s reservation caps interrupted several attempts; these are harness limits, not game failures. Code checks were not rerun because this lane changes reports only. Automated invariant/release gates, WebGPU and baseline A/B were not run by this lane.

## Evidence-backed findings

| Verdict | Finding and observed result | Position / tick | Opened capture |
|---|---|---|---|
| **NEW · P1** | Recoverable driving blockage: no meaningful onward progress for 12.23 simulated seconds despite forward/steering input. APC spun/impacted near crowd and roadside props/wall; reverse and further steering eventually recovered. Another bus/roadside trap lasted>10s. Cause is not isolated to zombie impact. | L9 HUD632–639m; ticks8195–8929. Later121–122m trap. | [L9 sheet](l9-partial.jpg), upper-left shows crowd/obstruction and depleted armor; upper-right shows the bay 4/4; middle-left shows close flat-road APC. Later bus/roadside trap raw: `l9-final/bus-trap-turn35.jpg` (opened). |
| **NEW · P2** | Several dead flamingos remain suspended in a tall interpenetrating column beside/above the courier across successive views while live birds keep attacking. | L8 pond Phase2, HUD5m; tick9046 (also8801 and later). | [L8 sheet](l8-partial.jpg), lower-right: vertical pink corpse pile; lower-left: live flock approach at8616. |
| **FIXED — limited scope** | Rail stall has an explicit countdown, hatch instructions and restart cue. Countdown18→15→10→6→2, then “Engine restarted — drive! (W)”; W reduced distance78→40m. | L9 rail, tick9278 countdown;10408 restart;10642 onward. | [L9 sheet](l9-partial.jpg), bottom-left: hatch defence HUD. Restart raw frame `l9-final/.frames/turn-000050-action.jpg` was opened earlier; bottom-right now shows L10 arrival. |
| **FIXED — limited scope** | Hatch shows upper torso and weapon. F closes it; health 40 remained through the remainder of that defence. | L9 rail, HUD79m; tick9278. | L9 bottom-left: visible upper body above roof (new run tick8984). |
| **FIXED — warning only** | Bus attack receives a visible warning and red attack lane: “School bus lining up a ram · dodge now!1s”. Clean dodge/defeat remains unverified. | L9 HUD157m, action43 of first run; exact tick not retained. | Opened raw `l9/bus-telegraph-turn43.jpg`: warning HUD and red lane behind APC. |

Raw paths above are relative to `test-results/s66-b87qa/` unless linked into this report. NEW means a newly observed issue; no baseline evidence establishes a regression. Authored rail defence lasts 20 s and is explicitly announced; the separate unannounced driving blockages exceed the 10 s P1 threshold. After crawl completion, the objective was blank for roughly 8–12 s before automatic L10 loading; transition completed, no softlock.

## Required checks and honest limits

| Requested check | Result |
|---|---|
| L9 start→bay→bridge→end | **COMPLETE** from normal start: rail restart, bay 4/4 at tick 13006 (HP100), bridge cinematic, crawl 20→17→7→0m (tick 14888), then automatic L10 transition and arrival (L10 tick 60). No death in final run. |
| L9 driver over soldier at start | Not verified sufficiently to issue FIXED. |
| L9 hull flicker, flame through hull, wheels on ramp/fall | Wheels and hull present on flat-road views; brief glazing/flame overlap ambiguous. Bridge approach tick 14018 shows hull and visible wheels together (middle-right sheet). Collapse tick 14057 shows vehicle partly occluded by falling deck; tick 14078 vehicle is hidden while brute remains. No clean visible vehicle fall was captured, so ramp/fall rendering and temporal flicker remain unresolved. |
| L9 keeps driving over zombies; ordinary rams cost no armor | Long stretches maintain onward movement with contacts. Armor losses near mixed props, attackers and boarders are confounded. No isolated armor-billing pass. Driving recovery issue above remains. |
| L9 barriers fly and persist | Displacement seen; settled persistence not verified. |
| L8 flamingo gait | **Arena defeated** in `l8-last`, tick 11207, health 92, following one death and normal retry. Short bursts and sideways movement avoided rushes; allied support recovered health. Live foot-slide not resolved by these captures; corpse failure above is separate. |
| L8 lion smoothness | Pond cleared, followed service path through tick 12640 before reservation cap; lion arena not yet reached. Brief animals behind bars during tour do not count as arena coverage. |
| L4 brute/butcher while continuously firing automatic weapon | At tick 2875 health 90; aimed MG held 4 s, then re-aimed and held 3 s, ending tick 3303 health 0. **90 net HP lost during 7 s firing**, one death. Mixed butcher/armored/hazmat/firefighter crowd and army fire prevent exact hit count or attacker attribution. A later consecutive-frame exchange is measured below; neither mixed fight establishes the isolated stun-lock fix. |
| Armored front vs rear shots-to-kill | Shield visibly broke during MG fire, tick 3981 (“SHIELD BROKEN 1.6 s”). Army fire and mixed crowd prevent directional shot counts. Comparison incomplete. |
| L2 market / L7 bus | Optional; not played. |

Opened [L4 sheet](l4-partial.jpg): top-left HP 100 / tick 2735, top-right HP 90 / tick 2745, middle-left HP 70 / tick 2863, middle-right HP 57 / tick 3100; bottom-left earlier death 3303, bottom-right earlier shield break 3981. The fresh run captured 25 consecutive frames during each of two 4 s MG holds (ticks2598–3100). Opened health/pose mosaics show **six 10 HP drops** at 2745,2804,2863,2949,2993,3033, plus **3 HP damage** at 3073, and **20 HP recovery** at 2910: **63 gross damage / 43 net HP lost**. The 3 HP event is not claimed as a distinct melee hit. Butchers continue approaching/attack motions during firing, but armored/hazmat contacts overlap; butcher-only attack damage and the isolated stun-lock verdict remain inconclusive. Raw consecutive frames and tick ledger: `l4-last/burst-15/`, `burst-16/`, `timing.jsonl`.


## Player impression

| Level | Glitches / pacing / threat | Stunning |
|---|---|---|
| L9, full route | Driving is readable on clear stretches; repeated prop/crowd recovery feels like babysitting. Dangerous when blocked, not harmless. Rail wait now explains itself. Dark sparse roadside and steering recovery reduce spectacle. |5/10|
| L8, partial | Flamingos are dangerous (multiple deaths across attempts; one complete clear with HP 92). Repeated flights and Phase2 without a remaining-flock count felt prolonged; vertical corpse stack visibly undermines the scene. No confirmed >10 s navigation stall. Escort tour feels passive and crowded; service-path markers remain readable. |5/10 overall; flamingos3/10|
| L4, sampled fight | Dangerous, not boring or harmless. Large butcher and mixed crowd overlap; unable to isolate attack attribution. No babysitting seen in this short fight. |5/10|

Scores are subjective and cover only played sections. L9 ending spectacle is 6/10 locally: collapse, companions and brute are readable, but vehicle/deck occlusion makes the fall difficult to judge. The played figure scores are below the PO checklist’s 8/10 target. **No full batch approval is supported.**

## Time-box closeout

No browser/check is left running. Remaining required coverage: **lion arena; continuous lion/flamingo gait; exact 1.5× close views across levels; isolated butcher stun-lock/damage attribution; armored front/rear shots-to-kill; isolated APC ram billing; persistent thrown barriers; clear ramp/fall, flame-depth and flicker verdicts.** Optional L2 market and L7 bus were not played. These are unverified, not FIXED. The two-hour QA window ends with this partial HOLD report.
