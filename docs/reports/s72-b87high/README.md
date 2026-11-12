# Batch 87 HIGH real-input QA — s72-b87high

**GO for PROD under the requested rule:** no NEW P1 or regression versus PROD was established. This is a sampled QA verdict, with the unverified coverage below explicitly retained.

Baseline: `9704a4896fc79e01c11349b46f662c147946d6e8`. No game code, specs, deployment, push, or main changes. Read prior s66/s67/s68/s69/s70 reports and the full s66 harness brief.

## Method and opened evidence

Single pooled headless browser, WebGL2/Metal (the live driver explicitly requests WebGL; no WebGPU coverage), 1280×720, HIGH requested. Normal menu starts using standard campaign level-start saves; god OFF (`LUNA_MORTAL=1`), real keyboard/mouse input only, no onward fixture, bot or teleport. The default saves have empty settings, so they do not override the HIGH URL selection. Separate L8 and L9 repeats explicitly set HIGH and zoom 1 after startup and recorded settings. Physical wheel -300 supplied closer L8/L4 views; exact ~1.5 magnification remains UNVERIFIED.

[Contact sheet](contact-sheet.jpg) is the sole committed image, 960×882. Every source panel and the assembled sheet were opened. Top: L9 hatch/countdown and restart. Middle: bay flame overlap and L8 Phase 2 count. Bottom: fallen flamingos and L4 firing/shield strain. Raw frames and logs remain ignored under `test-results/s72-b87high/`.

Step mode pauses between actions. Combined movement/hold actions execute sequentially; movement requests cap at four seconds. Stills support placement/HUD findings, not continuous animation or flicker.

## Verdicts

| Check | Verdict | Current evidence |
|---|---|---|
| L9 rail countdown, restart, hatch | FIXED within sample | Sheet top row: upper torso visible, 19-second countdown and restart cue; W then reduces 83→62 m. |
| L9 onward progress | NOT FIXED for sampled objective progress; precise chassis blockage UNVERIFIED | 11.55-second HUD window, ticks 3682–4375; one second released W for handbrake. See input audit. Blockage class already exists on PROD per s67. |
| L9 hull/wheels/flame | UNVERIFIED for temporal flicker/depth and ramp | Driving views show hull and wheels; sheet middle-left shows ambiguous flame overlap near bay. |
| L9 bus telegraph | UNVERIFIED | Bus present in opened rail/restart panel, but warning not caught. |
| L8 Phase 2 count | FIXED | Sheet middle-right: 3 left; retry counts 8→7→6→5. |
| L8 corpse column | FIXED within sampled frames | Sheet bottom-left: several fallen birds horizontal and spread across ground; no tall column in these views. Whole-fight persistence not proven. |
| L8 flock gait | UNVERIFIED | Opened still frames show distinct limb poses; step-mode captures do not prove continuous gait. |
| L4 armored kill count | UNVERIFIED in real-input encounter | Sheet bottom-right: shield strain and active MG exchange; allied fire prevents isolated front/rear counts. s70 native measurements remain separate evidence. |
| L4 heavies under fire | UNVERIFIED for isolated attribution | Health falls during sustained firing, with butchers and other attackers overlapping. See tick/HP ledger below. |
| New P1/regression vs PROD | None established in observed samples | Flame overlap and bay survivor 3/4 are unresolved, not established new regressions. |


## L9: start → rail → bay

First run drove from 1007 m through the rail stall/restart to the bay, reaching 3/4 survivors. Opened turn 30: hatch upper torso and 19-second countdown; turn 35: restart instruction; subsequent W reduces 83→62 m. Bay 4/4 and subsequent completion were not verified. Closed-hatch waiting during the rail countdown did not cost player health; APC armor fell sharply, so this sampled section was not harmless to the vehicle. Repeated waiting and survivor babysitting were the least active parts.

[Input/tick audit](input-audit.json): no objective-distance improvement beyond 561 m between ticks 3682–4375 (11.55 simulated seconds; endpoints 561→564→566→561→566). One second released W for handbrake. This is NOT FIXED for sampled onward objective progress, but continuous-held-W chassis blockage is UNVERIFIED: that run did not record positions. s67 reproduced this blockage class on exact PROD `0b650749`; this observation alone does not establish a new regression.

A second normal L9 run explicitly recorded HIGH/zoom 1 and player positions through turn 20, tick 3591, objective 290 m, position x=167.3095/y=0.9954/z=-2.8017. It did not reach the rail. [Measured receipt](measured-route.json) preserves this attempt. Video capture was requested but no video artifact was produced; no temporal verdict relies on it. Hull/wheels were visible in driving frames; flame overlap near the bay remains ambiguous. Bus presence is visible, but its warning timing was not caught.

## L8: pond fight

Normal start → escort → plaza defence → pond. Opened turn 50 shows Phase 2 / 3 left. A health reset and return to Phase 1 indicate a retry, not a clear. Retry turns 53–58 show 8→7→6→5 left. Multiple opened frames show fallen birds horizontal across the ground, without the previous tall corpse column. Full-fight corpse persistence and continuous flock gait remain UNVERIFIED. Last view was 18 HP with five birds left: dangerous, not harmless. Escort travel felt passive with a dense following crowd.

[Presentation audit](presentation-audit.json) records a separate 50-action explicit HIGH/zoom-1 repeat through the escort/plaza to the pond gate (12 m); it does not certify the prior fight's exact close magnification. That reservation ended before the repeated fight.

## L4: armored defence

Normal start → quartermaster → MG defence. Turn 20, ticks 3780–4026: four-second firing hold, HP 90→80. Later firing holds: 80→89 and 89→97 with healing, then ticks 4520–4770 HP 97→76, ticks 4770–5016 HP 76→65, then 65→35. Opened views show nearby butchers, shield strain/break and armored bodies. The encounter remains dangerous while firing, but army fire, healing and mixed attackers prevent isolated heavy-hit attribution or rear/front landed-shot counts. Those real-input questions remain UNVERIFIED. s70's native handgun 12 vs ordinary 3 rear hits (4×), rifle 10 vs 3, and MG 18 vs 5 are supporting prior evidence, not measurements from this run. No stat changes were made.

## Checks and limits

- `MI_BUILD_CACHE=off npm run build:qa`: PASS. Initial shared-cache/listener restrictions were resolved after access changed.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Exact remote `sh tools/remote/run.sh "$PWD" -- npm test`: first attempt timed out at 246 s; unchanged rerun PASS, 27 files, 106 passed / 1 skipped, 150/150 registered cases, 208.03 s Vitest / 210.6 s wrapper, runner 46.225.66.90. No tests trimmed.

All sessions/checks are terminal. Temporary driver removed. Remaining coverage: continuous gait, temporal flame/depth behavior, bus telegraph timing, exact close magnification, continuous-W stall positions, isolated armored counts/heavy attacks, bay completion. No new glitch was established as a P1 or PROD regression. The known progress-loss class remains an open gameplay issue; this report does not certify its absence.

GO
