# Batch 91 real-input QA — HOLD

Gameplay target: **main `d9db5d49`**, the requested PROD snapshot. Later lane commits contain report artifacts only. **HOLD: required coverage remains incomplete.** Execution ended at the user's timebox instruction after finishing the active HIGH L6 check.

[Evidence index](evidence.json) · [Inspected contact sheet](contact-sheet.jpg)

## P1/P2 list

- **Confirmed gameplay P1: none.** This does not establish absence of defects in unchecked areas.
- **Confirmed gameplay P2: none.** Automatic driver warnings are not promoted without supporting evidence.
- **Candidate P2 — intermittent L9 final-bay wait:** one HIGH z1 run remained at “Defense complete · 3/4 at the trucks” for 139.13 s. Subsequent HIGH z1/z1.5 and LOW hatch-control runs progressed. Survivor-state and manual-input reproduction remain necessary before calling it a defect or soft lock.

The scripted L6 shelter rest explains its automatic navigation warning. Other stationary/unhittable-enemy warnings remain unconfirmed. The zero-HP APC warning does not establish an injured-survivor failure because L9 intentionally permits driving at zero vehicle HP. One temporary camera observer threw during null-mission teardown; that probe error is excluded from gameplay findings.

## PO findings, verbatim

| Finding | Batch 91 disposition |
| --- | --- |
| L6: “After I closed the first door, no more Zombies attacked the group, which made the game boring from there on” | First closure and subsequent attack activity established at HIGH and LOW. HIGH final run: 157.03 s observed after closure, attack starts in every measured 30 s window. LOW completed the level with 92.38 s post-closure samples. Death/checkpoint resets and non-group-exclusive attack counts qualify both results; full uninterrupted group-target cadence remains open. |
| L7: “The bus is crashing to soldiers” | Three opened HIGH z1.5 and three LOW z1 departure frames show no live-soldier/bus intersection. HIGH z1 route completed, but its timed departure frames are missing. Sampled clearance does not prove every intervening instant. |
| L9: “L9; I am stuck here” (rail crossing hatch) | HIGH rail passes progressed. LOW initially repeated deaths, then completed the route with normal F hatch control and aimed fire. |
| L9: “Also the end is strange, bc I cannot walk away but also not drive anymore” | Countdown/restart guidance inspected. HIGH and LOW final-bay progression demonstrated, with one intermittent HIGH wait retained above. Input availability at every final-bay moment was not exhaustively checked. |
| L9: “It somehow proceeded, but now I am this... super strange” | Opened actual playable HIGH z1.5 and LOW-configured z1 L10 handovers show upright courier holding the axe. Folded pose did not recur in these samples. |
| L9: school bus overlapping the APC | Opened five HIGH and two LOW proximity frames show close rear contact followed by separation, including a ram warning/lane telegraph. Sustained hull intersection is not established. The rail fixture begins with the chase already active; continuous ram clearance/beatability remains qualified. |

## Coverage and experience

| Level/check | HIGH evidence | LOW evidence | Remaining limit / experience |
| --- | --- | --- | --- |
| L6 closure and cadence | Final z1 run: 540 s, 12 deaths, one driver assist, ended exit-platform without completion. First hatch closed at tick 22258. Following 157.03 s: attack counts 90,57,113,134,38 in five complete 30 s windows, then 11 in final 7.03 s. Ten normal E gate inputs logged. Earlier z1.5 reached exit-platform; closure unproved. | z1 completed in 399 s, five deaths. First closure tick 17437, later reset closure 17875. Counts 86,37,97 in complete 30 s windows, then 3 in final 2.38 s. | Dangerous escort with repeated deaths/survivor losses; no post-closure harmlessness demonstrated. Counts include all attack starts, not exclusively group targets. HIGH full completion and uninterrupted alive cadence open. |
| L7 bus departure | z1 completed 302 s, six deaths, zero assists. z1.5 completed 157 s, zero deaths/assists; opened departure frames at 1.52,3.07,8.23 s, actual HIGH/zoom1.5 confirmed. | z1 completed 214 s, one death/assist; opened departure frames around 0.67,3,8.27 s; actual LOW/zoom1 confirmed. | Sustained combat; LOW max no-progress 11.97 s, then progressed. HIGH z1 timed capture open. |
| L8 boarding/handoff | z1 completed 54 s, zero deaths/assists. Read-only observer proves Hale#422 stayed100 HP at player-boarded tick2755 and departed tick3233. Requested z1.5 route completed56 s: scripted arena holds zoom1, then actual/target1.5 at boarding. | LOW-configured z1 completed54 s; Hale100 HP at player boarding and last pre-departure sample. | Boarding moved promptly, no14/14 stall reproduced. Exact LOW departure-health and actual-quality receipt not retained. Scripted-camera exception is explicit; no forced camera override. |
| L9 rail/final bay | z1 retry completed214 s; z1.5 completed130 s, zero deaths/assists. Opened restart and4/4 final-bay countdown frames. Bus-capture z1 run completed214 s. | Initial runs ended after15 deaths. Explicit normal F at rail, then open hatch and normal aimed fire at final cover completed168 s, zero deaths, four shotgun attacks; max no-progress9 s. | Earlier death loop was repetitive. Hatch decisions are disclosed read-only-state-guided input assistance, despite driver's internal assist counter0. One139 s HIGH wait remains a candidate. |
| L9→L10 pose | Bridge fixture through live handover25 s; HIGH z1.5 upright axe-holding courier inspected. | Bridge fixture through live handover24 s; LOW-configured z1 upright courier inspected. | Loading-only frames are not used as pose proof. HIGH z1 live-pose capture absent. |
| L10 later returned arsenal | All14 returned weapons selected by click. Q reached all14 at z1.5. Fresh controlled keys1–9 matched with100 HP. | Actual LOW z1 all14 clicks and Q visits; controlled keys1–9 matched with100 HP. | Key0 maps to absent crowbar; explicit0 correctly left pipe bomb selected. Earlier claim that0 selected a returned weapon was incorrect and superseded. Original hangar presentation remains unverified. |
| L10 knife | Catalog defines knife and machete separately. Authored returned arsenal includes machete, no knife. | Same fixture limitation. | Machete selection does not settle literal knife selection; no weapon was granted to manufacture coverage. |
| L10 molotov | Prior hunting rifle restored after actual throws. Opened held-aim z1 frame shows gold dashed marks and landing circle; no blue lines. | Actual LOW z1 same restoration and held-aim result. | Partly occluded trajectory, not an unobstructed sweep. Initial mouse-motion-only stills did not establish aiming and are excluded. |
| L10 hunting Mega | Targeted normal axe contact:52 player hits, typical78.4 damage; minimum2137.6/3000 (~71%). Alive-player HP rose2294.4→2354.4 at1.167 s since last hit. |46 axe hits; minimum2294.4/3000 (~76%); recovery2294.4→2348.4 at1.15 s since last hit. | Former zero-melee-damage finding did not reproduce. Gun damage and sustained damage to~35% floor remain open. Rifle-route probes failed to reach pickup, not proof of pickup defect. |
| L10 journey/crops | Real-input save reached farms cure-pace-2; save decoded and resumed normally. Farms/crop views opened. | Targeted farms samples only. | No systematic road-crop sweep or full journey. Arrival cadence, visible sprinter spawning/pop-in remain unverified. |

### Frame-interval measurements

Read-only rAF probe during three-minute real-input farms encounters; includes combat, deaths and respawns. FPS is presentation interval, not isolated GPU/CPU render time. Actual WebGPU/quality receipts retained.

| Setting | Peak live infected | Mean interval | Mean FPS | P95 | Maximum | Frames at60–70 infected |
| --- | --- | --- | --- | --- | --- | --- |
| HIGH z1 |24|16.695 ms|59.897|16.700 ms|50.0 ms|0|
| LOW z1 |12|16.690 ms|59.916|16.800 ms|33.4 ms|0|

**These do not satisfy the requested60–70-infected load or an equal-load quality comparison.** First-observed IDs/projected visibility alone do not prove spawn pop-in or≤45 s arrivals.

## What is still unchecked

1. HIGH L6 full completion with first hatch closed; complete uninterrupted alive/group-target cadence at both qualities. HIGH z1.5 closure condition remains unproved.
2. L7 HIGH z1 timed departure clearance; continuous vehicle/soldier motion beyond retained samples.
3. L8 exact LOW departure-health/actual-quality receipt; full fresh approach beyond the approved elephant-yard checkpoint.
4. L9 continuous school-bus ram clearance/beatability, moment-by-moment final-bay input availability, intermittent3/4 wait investigation, HIGH z1 playable handover pose.
5. Original L10 hangar presentation, literal knife selection, broader HIGH z1.5 weapon/throwable presentation, unobstructed molotov trajectory sweep.
6. Hunting Mega gun damage and sustained damage to~35% floor.
7. Full L10 road-crop sweep, arrivals every≤45 s throughout journey, visually reviewed sprinter pop-in, and frame timing at60–70 active infected at HIGH and LOW.

## Method, validation and artifacts

Read `docs/qa/po-checklist.md` first. Fresh production build and QA build passed. Typecheck and lint passed. Prescribed unchanged remote suite on46.225.66.90 passed27 files,106 tests,one skipped,222.5 s within240 s. An earlier process-cleanup failure did not recur; initial sandbox/build-cache/pool restrictions were resolved. No tests were trimmed.

Headless WebGPU through browser pool/e2e-lock, one job context, bounded reservations, ports4941/4942; the initial L6 z1 default-WebGL attempt is excluded from WebGPU qualification. Real WASD/mouse, weapon clicks/keys, E/F and normal fire. Approved fixtures and a verified organically reached farms save were used. No god mode, teleport, objective skip, weapon grant, enemy-stat tuning or corpse removal. Route/state-assisted decisions are disclosed. Temporary controller copies added input decisions/read-only observation only and were removed; no game-code fixes remain.

The single contact sheet and its source frames were opened. It contains L7 departure, L8 boarding, L9 wait, HIGH/LOW molotov aim, actual playable handovers and bus/APC proximity. Additional opened frames include LOW gate90 prompt, HIGH retreat combat, LOW hatch and completed LOW bridge approach. Exact raw paths and compact receipts are in evidence.json; raw logs/captures remain local in `test-results/s94-b91high/`. A driver's finished flag qualifies only its named scope, not all visual criteria. Negative/reset handover simSeconds are excluded.

Final active check: `high-z1-l6-explicit-gate/`,540 s, ended exit-platform. Its normal E decision used the visible “Everyone through…close” objective at the gate. The post-closure attack window is measured but interrupted by deaths/checkpoint restores. No further check was started after the user's stop instruction.

**Closeout:** report/evidence plus one small contact sheet committed. This job's browser context and reservation were released; other jobs' pool reservations were left untouched. No job-owned check is running. No push, deployment, or main movement occurred. Full QA is incomplete; HOLD is the release recommendation from this timeboxed evidence.
