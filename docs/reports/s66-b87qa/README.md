# Batch 87 real-input QA — s66-b87qa

**Pre-deploy verdict: HOLD. Coverage is incomplete and two new failures need review.** Game code tested: `91199b68`. No game code or specs changed; no deploy, push or main movement.

Headless WebGL2/Metal, LOW, 1280×720, one browser through `tools/e2e-lock.sh` / browser pool, ports4867/4868. God OFF (`LUNA_MORTAL=1`). Normal menu and standard campaign level-start save only; no onward fixtures, teleport, bot or invulnerability. All movement, aiming, firing, hatch and driving actions used keyboard/mouse. Route decisions used screenshots, objective marker and HUD. A temporary driver also read the *rendered* marker DOM rectangle to send WASD; a later L9 retry replayed recorded real device inputs until contact divergence, then returned to manual views. The step harness pauses between actions, so this is **not a sufficient continuous-motion quality gate**. L9 final retry explicitly set camera.zoom(1); normal view and API1.5 view were opened. API1.5 widens the view; three real wheel-up notches then gave about1.52× close magnification, also opened (turn17, HUD473m). Exact1.5× close and L8/L4 camera values remain unverified. Raw evidence and numbered input/action frames stay in `test-results/s66-b87qa/`.

QA build `MI_BUILD_CACHE=off npm run build:qa` passed (11.08s). Initial listener permissions were subsequently resolved. Browser idle release and595s reservation caps interrupted several attempts; these are harness limits, not game failures. Code checks were not rerun because this lane changes reports only.

## Evidence-backed findings

| Verdict | Finding and observed result | Position / tick | Opened capture |
|---|---|---|---|
| **NEW · P1** | Recoverable driving blockage: no meaningful onward progress for12.23 simulated seconds despite forward/steering input. APC spun/impacted near crowd and roadside props/wall; reverse and further steering eventually recovered. Another bus/roadside trap lasted>10s. Cause is not isolated to zombie impact. | L9 HUD632–639m; ticks8195–8929. Later121–122m trap. | [L9 sheet](l9-partial.jpg), upper-left shows crowd/obstruction and depleted armor; upper-right shows the bay4/4; middle-left shows close flat-road APC. Later bus/roadside trap raw: `l9-final/bus-trap-turn35.jpg` (opened). |
| **NEW · P2** | Several dead flamingos remain suspended in a tall interpenetrating column beside/above the courier across successive views while live birds keep attacking. | L8 pond Phase2, HUD5m; tick9046 (also8801 and later). | [L8 sheet](l8-partial.jpg), lower-right: vertical pink corpse pile; lower-left: live flock approach at8616. |
| **FIXED — limited scope** | Rail stall has an explicit countdown, hatch instructions and restart cue. Countdown18→15→10→6→2, then “Engine restarted — drive! (W)”; W reduced distance78→40m. | L9 rail, tick9278 countdown;10408 restart;10642 onward. | [L9 sheet](l9-partial.jpg), bottom-left: hatch defence HUD. Restart raw frame `l9-final/.frames/turn-000050-action.jpg` was opened earlier; bottom-right now shows L10 arrival. |
| **FIXED — limited scope** | Hatch shows upper torso and weapon. F closes it; health40 remained through the remainder of that defence. | L9 rail, HUD79m; tick9278. | L9 bottom-left: visible upper body above roof (new run tick8984). |
| **FIXED — warning only** | Bus attack receives a visible warning and red attack lane: “School bus lining up a ram · dodge now!1s”. Clean dodge/defeat remains unverified. | L9 HUD157m, action43 of first run; exact tick not retained. | Opened raw `l9/bus-telegraph-turn43.jpg`: warning HUD and red lane behind APC. |

Raw paths above are relative to `test-results/s66-b87qa/` unless linked into this report. NEW means a newly observed issue; no baseline evidence establishes a regression. Authored rail defence lasts20s and is explicitly announced; the separate unannounced driving blockages exceed the10s P1 threshold. After crawl completion, the objective was blank for roughly8–12s before automatic L10 loading; transition completed, no softlock.

## Required checks and honest limits

| Requested check | Result |
|---|---|
| L9 start→bay→bridge→end | **COMPLETE** from normal start: rail restart, bay4/4 at tick13006 (HP100), bridge cinematic, crawl20→17→7→0m (tick14888), then automatic L10 transition and arrival (L10tick60). No death in final run. |
| L9 driver over soldier at start | Not verified sufficiently to issue FIXED. |
| L9 hull flicker, flame through hull, wheels on ramp/fall | Wheels and hull present on flat-road views; brief glazing/flame overlap ambiguous. Bridge approach tick14018 shows hull and visible wheels together (middle-right sheet). Collapse tick14057 shows vehicle partly occluded by falling deck; tick14078 vehicle is hidden while brute remains. No clean visible vehicle fall was captured, so ramp/fall rendering and temporal flicker remain unresolved. |
| L9 keeps driving over zombies; ordinary rams cost no armor | Long stretches maintain onward movement with contacts. Armor losses near mixed props, attackers and boarders are confounded. No isolated armor-billing pass. Driving recovery issue above remains. |
| L9 barriers fly and persist | Displacement seen; settled persistence not verified. |
| L8 flamingo gait | Arena reached and combat played, including Phase2. Live foot-slide not resolved by these captures; corpse failure above is separate. |
| L8 lion smoothness | Lion arena not reached. Brief animals behind bars during tour do not count as arena coverage. |
| L4 brute/butcher while continuously firing automatic weapon | At tick2875 health90; aimed MG held4s, then re-aimed and held3s, ending tick3303 health0. **90 net HP lost during7s firing**, one death. Mixed butcher/armored/hazmat/firefighter crowd and army fire prevent exact hit count or attacker attribution. This does not establish the isolated stun-lock fix. |
| Armored front vs rear shots-to-kill | Shield visibly broke during MG fire, tick3981 (“SHIELD BROKEN1.6s”). Army fire and mixed crowd prevent directional shot counts. Comparison incomplete. |
| L2 market / L7 bus | Optional; not played. |

Opened [L4 sheet](l4-partial.jpg): left shows butcher at the sandbag gap with health90 (2875), middle shows death after the MG burst (3303), right shows broken shield and butcher corpse (3981). It proves danger under continuous fire, not which enemy landed each hit.

## Player impression

| Level | Glitches / pacing / threat | Stunning |
|---|---|---|
| L9, full route | Driving is readable on clear stretches; repeated prop/crowd recovery feels like babysitting. Dangerous when blocked, not harmless. Rail wait now explains itself. Dark sparse roadside and steering recovery reduce spectacle. |5/10|
| L8, partial | Flamingos are dangerous (two deaths). Repeated flights and Phase2 without a remaining-flock count felt prolonged; vertical corpse stack visibly undermines the scene. No confirmed>10s navigation stall. |5/10 overall; flamingos3/10|
| L4, sampled fight | Dangerous, not boring or harmless. Large butcher and mixed crowd overlap; unable to isolate attack attribution. No babysitting seen in this short fight. |5/10|

Scores are subjective and cover only played sections. L9 ending spectacle is6/10 locally: collapse, companions and brute are readable, but vehicle/deck occlusion makes the fall difficult to judge. **No full batch approval is supported.**
