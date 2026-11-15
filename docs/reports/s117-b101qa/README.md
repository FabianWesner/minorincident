# s117 — batch 101 real-input browser QA

**QA verdict: NO-GO for unconditional PROD signoff.** Revision `683da8f8`. HIGH primary passes and HIGH L1/L3/L10 spots preceded LOW. A supplemental HIGH L6 route after LOW completed using the disclosed stair waypoint.

[Compact evidence](evidence.json) · [Reviewed contact sheet](contact.jpg). Raw captures, logs, ledgers and driver backups: ignored `test-results/s117-b101qa/`.

## Method

QA production build, headless pooled Chromium with Metal WebGL2, 1280×720, DPR 1, physical WASD/mouse/interactions, no god mode, teleport, stepping or objective skips during route play. Normal progressed presets seed L4/L6/L9 saves before menu Continue; L1 uses new game. One pooled Chrome root; bounded reservations at most 600 seconds, ports 4971/4972. A queue handoff briefly overlapped two contexts in that same browser; the interrupted L3 zoom1.5 attempt was stopped and rerun serially, excluded from completed coverage. These are automated driver outcomes, not human skill or product-owner taste approval.

## Outcomes

| Run | Complete | Deaths | Wall seconds |
|---|---|---:|---:|
| L1-high-z1 | No / bounded | 0 | 120 |
| L1-high-z1.5 | No / bounded | 0 | 121 |
| L1-low-z1 | No / bounded | 0 | 120 |
| L1-low-z1.5 | No / bounded | 1 | 120 |
| L10-high-z1 | No / bounded | 2 | 120 |
| L10-high-z1.5 | No / bounded | 2 | 120 |
| L10-low-z1 | No / bounded | 3 | 120 |
| L10-low-z1.5 | No / bounded | 2 | 120 |
| L3-high-z1 | No / bounded | 1 | 120 |
| L3-high-z1.5 | No / bounded | 1 | 120 |
| L3-low-z1 | No / bounded | 2 | 120 |
| L3-low-z1.5 | No / bounded | 2 | 120 |
| L4-HIGH-z1 | No / bounded | 32 | 540 |
| L4-high-tank | No / bounded | 11 | 300 |
| L4-high-z1.5 | No / bounded | 29 | 480 |
| L4-low-tank | Yes | 4 | 261 |
| L4-low-z1 | Yes | 20 | 472 |
| L4-low-z1.5 | No / bounded | 11 | 300 |
| L6-high-breach2 | No / bounded | 1 | 120 |
| L6-high-z1 | No / bounded | 18 | 480 |
| L6-high-z1.5 | No / bounded | 17 | 480 |
| L6-high-z1.5-waypoint | Yes | 0 | 215 |
| L6-low-breach2 | No / bounded | 0 | 120 |
| L6-low-z1 | No / bounded | 11 | 480 |
| L6-low-z1.5 | Yes | 3 | 280 |
| L9-high-passengers | No / bounded | 1 | 180 |
| L9-high-z1 | Yes | 1 | 229 |
| L9-high-z1.5 | Yes | 1 | 211 |
| L9-low-passengers | No / bounded | 1 | 180 |
| L9-low-z1 | Yes | 7 | 336 |
| L9-low-z1.5 | No / bounded | 9 | 480 |

L1/L3/L10 are 120-second spots. L4's requested scope is alarm hold through line break, reached in all four primary passes. Zero sim-seconds reported on some successful handovers is a driver tick-reset artifact, not a duration. LOW L9 zoom1.5 wall time includes a photo pause and is not clean gameplay time.

## Per-level findings and verdicts

### L4 — horde present; P2 readability; motion/routing clearance incomplete

Reviewed HIGH late hold shows ordinary infected mixed with large attackers inside the plaza, allied fire and many bodies. At zoom 1 the courier at 30 HP is swallowed by overlapping silhouettes and bars (**P2**); wider shots improve context but retain crowd overlap. LOW has readable pockets around the courier while the horde concentrates by tents/truck. All four holds are dangerous in the driver routes, not harmless. There is no escort babysitting in the alarm hold. LOW zoom1 completes the cellar escape at 7 HP in its reviewed final wait frame.

Hold player windups / peak living: HIGH zoom1 **674 / 75**, HIGH zoom1.5 **1017 / 82**, LOW zoom1 **444 / 56**, LOW zoom1.5 **363 / 58**. Windups include interrupted attacks, deaths and checkpoint timelines. LOW corpse tracking retains 7 / 10 identities at the two zooms, zero missing samples; HIGH zoom1 retains 10 with zero missing samples.

The reviewed 22-frame LOW burst (ticks 8004–8292) shows active movement/reactions and HP 42→12 near tents/dining area. No obvious whole-body hover in its review sheet; scale is inadequate for foot-slide clearance and the tank is absent. Focused physical south-breach follow-ups add a LOW tank/south-wire view, but death/respawn interrupts the temporal sequence and feet are heavily occluded; the HIGH follow-up captures the truck corner instead. Persistent sole sliding/get-up landing remains unproven. Stationary-infected warnings occur in crowd/vehicle congestion; root cause remains unconfirmed. **Open:** tank-side sole sliding/hovering, outside-wire stationary cohorts and closer temporal review. No performance verdict is made from these route captures.

### L6 — LOW completed, exit tail below 12 s; P1 protection-outcome review concern

Reviewed retreat frames on both tiers show low courier HP, close infected, attack telegraphs and survivor-loss/under-attack banners. Return-to-group and cover-rear demands create substantial babysitting work. These are dangerous routes, not a harmless post-door retreat. Crowd and roof beams sometimes obscure rear victims (**P2 readability**).

Initial HIGH routes do not complete: 18 / 17 deaths, final roster zero out, 28 turned and one following. LOW zoom1 similarly ends incomplete with 11 deaths and final restored zero out; a transient HUD 1/1 out precedes another restore. Poor real-input protection outcomes are a **P1 review concern**, with driver/checkpoint behavior a substantial confound; no stat tuning or causal balance diagnosis is proposed.

Supplemental HIGH zoom1.5 completes to L7: **6/29 saved, 23 lost, zero deaths, 215 wall seconds / 200 sim seconds**. Exit starts at observed tick11166; first player attack11429 is4.38s later; last attack11672 is no more than1.02s before first no-active-step observation11733. The playable exit gaps are below12s in this completed route. The successful HIGH night cinematic retains a hostile cluster/red telegraph around the courier (**P2 ending presentation**).

LOW zoom1.5 completes to L7: **9/29 saved, 20 lost, three deaths, 280 wall seconds / 265 sim seconds**. The disclosed physical stair waypoint resolves the known s106 approach trap. Last exit player attack start 15004; last active exit sample 15600 and first no-active-step observation 15611 bound the final playable no-new-attack tail at **9.93–10.12 s**, below the 12 s review threshold. The first night-cinematic capture at 15910 is excluded. LOW zoom1's 138 exit starts have max between-start gap 6.08 s; incomplete runs do not prove completion lulls. Fresh 120-second physical probes separate first-attempt admissions: ten breach2 members per tier, all marked offscreen. First cohort attack after announcement is **3.22 s HIGH / 2.90 s LOW**, targeting survivors; first player-target attack is **9.40 s HIGH / 21.97 s LOW**. Thus rapid group contact is observed, but LOW player contact is not below20s on this moving route. The earlier retained checkpoint logs were not used for these delays.

### L9 — HIGH and LOW zoom1 complete; P2 off-road bus and smoke readability

HIGH completes at both zooms with one death each; LOW zoom1 completes with seven deaths. Reviewed evacuation capture shows 4/4 at trucks. Hatch-start frames show a readable exposed courier and clear timer. Later smoke can hide roof/courier and the pursuing bus (**P2 readability**). Defence is active, not simply waiting, although nearby stationary warnings beside the hull remain unconfirmed as navigation bugs.

**P2 off-road pursuit/spawn:** early primary samples place the bus on asphalt, but it subsequently leaves the strip. The later HIGH passenger probe also observes a spawn15.63m from asphalt centreline when the APC driven trail itself leaves the road. Thus trail placement alone does not guarantee an on-road spawn. Against `layouts/D-CROSSING/routes.json` (12 m asphalt width), HIGH zoom1.5 bus centre at tick6330 `(312.97,-282.01)` is **47.99 m** from the nearest asphalt segment; 197/261 visible half-second samples exceed the 6 m half-width. LOW zoom1 worst at12660 `(307.95,-273.45)` is **56.55 m**, 295/497 samples outside. These are centre tests before considering footprint. Bus reaches the rail crossing; HIGH capture visibly places it behind the APC on asphalt there. Thus initial placement/arrival improves, but **never-off-road fails** in sampled pursuit.

LOW zoom1 first non-hidden sample projects to `(-765,-475)` in the 1280×720 viewport, supporting offscreen admission in that sample. Half-second samples do not prove exact spawn visibility. HIGH passenger probe observes admission at the exact recorded busLineAt tick5322,projected `(-557,-280)`,offscreen. Explicit passenger676–681 tracking shows no attack starts; closest live passenger with hatch open is75.41m away (closed-hatch proximity2.36m is not defence participation). LOW passenger probe records admission at tick4512,projected `(-620,-357)`,2.80m from asphalt centreline. Passenger678 reaches1.97m from the courier with hatch open; no passenger attack start is logged. LOW arrival is supported; HIGH participation in its observed window fails. LOW zoom1.5 is incomplete after a photo-pause interruption, not a clean hatch softlock repro.

### L1 / L3 / L10 — limited HIGH spots, no established new A* defect

HIGH spots at both zooms log no driver issue flags. L1 reviewed frames show infected reaching the courier around the bat/firestation objectives (30 / 60 HP). L3 frames show courier/police checkpoint approach in fenced streets; one death per spot. L10 covers crash→residential/farmstead, including close infected and a red telegraph at a field corner; two deaths per spot. Quiet travel also occurs in L10. No standstill/jitter/wall-loop defect is established in these samples, but these are not full-level clearance or pacing approvals. All twelve HIGH/LOW spots have zero driver issue flags; reviewed L1/L10 frames include active close contact. Late L10 hold and all map corners are outside these short spots.

## Photo/save interruption

LOW L9 zoom1.5 at tick9549: `settings.set → campaignSettings → saveCampaign → SaveStore.write` throws `Invalid campaign save`. Photo cleanup repeats the failing write before resume, leaving the game paused while observations continue. Physical Escape through the existing driver control file resumes the same session. Exclude this paused interval from gameplay timing. The final exported campaign passes `validateSave`; the offending live snapshot was not retained, so persistent corruption is unproven. **P1 save-validation review concern**, plus confirmed QA cleanup fault. Later temporary photo cleanup skips redundant tier writes and resumes in `finally`; runtime validation is untouched.

## Temporary driver-only instrumentation

No gameplay source was edited. The following temporary changes to `tools/playtest/` are restored before the report commit:

1. Acceptance ledger: record exact L6 attack-start tick/source/target/phase. Passive logging only, for breach/exit timing.
2. Acceptance ledger: sample L9 vehicle positions, hidden state and (later passes) projected screen coordinates every30 ticks. Passive trail/spawn evidence.
3. Session: walk toward `(248,15)` before the L6 exit marker when below the stair approach, following s106’s disclosed map assist. Uses ordinary keyboard walking; no teleport or state writes.
4. Session: give L9 rail-hatch objectives a separate capture key so the short defence gets its own screenshot.
5. Session: capture a short L4 burst at ticks8000–8300 for temporal visual review; it covers tents/dining area rather than the tank.
6. Session: cap subsequent L4 diagnostic samples at300 wall seconds, retaining the full alarm hold through line break. This shortens later escape sampling only.

The seeded L4/L6/L9 saves use the game’s normal progressed presets and menu Continue. L1 has no L1-default preset, so its spots start through the normal new-game flow. Seed setup is disclosed fixture preparation; route play is physical keyboard/mouse. An interrupted L3zoom1.5 handoff attempt was excluded and rerun serially.


7. Later passive L6 instrumentation records breach2 admission tick/announcement/actor to separate first attempts from checkpoint restores.
8. A focused L4 map assist walks toward the south breach and tank stop while using ordinary aim/fire; a later short burst records motion. HIGH reached the breach edge but captured the truck corner after a restart, so tank sole clearance is not claimed.
9. Later L9 passive instrumentation records actual observed admission tick/screen projection, explicit bus passenger positions and passenger attack starts.

Additional temporary photo cleanup is described above. Both edited `tools/playtest` files are restored byte-for-byte before the final report commit.


7. Later passive L6 instrumentation records breach2 admission tick/announcement/actor to separate first attempts from checkpoint restores.
8. A focused L4 map assist walks toward the south breach and tank stop while using ordinary aim/fire; a later short burst records motion. HIGH reached the breach edge but captured the truck corner after a restart, so tank sole clearance is not claimed.
9. Later L9 passive instrumentation records actual observed admission tick/screen projection, explicit bus passenger positions and passenger attack starts.

Additional temporary photo cleanup is described above. Both edited `tools/playtest` files are restored byte-for-byte before the final report commit.


7. Later passive L6 instrumentation records breach2 admission tick/announcement/actor to separate first attempts from checkpoint restores.
8. A focused L4 map assist walks toward the south breach and tank stop while using ordinary aim/fire; a later short burst records motion. HIGH reached the breach edge but captured the truck corner after a restart, so tank sole clearance is not claimed.
9. Later L9 passive instrumentation records actual observed admission tick/screen projection, explicit bus passenger positions and passenger attack starts.

Additional temporary photo cleanup is described above. Both edited `tools/playtest` files are restored byte-for-byte before the final report commit.


Additional temporary photo cleanup is described above. Both edited `tools/playtest` files are restored byte-for-byte before the final report commit.

## Validation and remaining work

QA build passed with `MI_BUILD_CACHE=off` after initial sandbox cache/socket restrictions. Typecheck and lint passed on unchanged runtime source. Unchanged remote unit command `sh tools/remote/run.sh "$PWD" -- npm test` passed on 46.225.66.90: manifest 150/150, 27 files, 106 passed / 1 skipped, 232.0 s within 240 s, exit 0. No deploy, push or main movement.

Remaining gaps: sustained close tank-side sole/get-up review (LOW view interrupted by death, HIGH missed the tank); identity-tracked exterior-wire standstill diagnosis; broader navigation coverage beyond the short spots; reproducible offending live save snapshot. No blanket foot-slide, outside-wire or all-level A* clearance is claimed. These gaps are delivered explicitly under the orchestrator’s time-box instruction. No gameplay correction, deployment or push was performed.

## Verdicts

| Level | Verdict | Boring / harmless / babysitting |
|---|---|---|
| L4 | Horde complaint resolved in sampled HIGH/LOW holds; P2 readability and routing concerns, sole clearance incomplete | Dangerous; LOW has local breathing room. No escort babysitting in hold. |
| L6 | Completed HIGH6/29,zero deaths and LOW9/29,three deaths; completed exit tails below12s. P1 protection-outcome review concern; no blanket balance approval | Active pressure; repeated rejoin/cover warnings create babysitting work. |
| L9 | NO-GO for never-off-road condition; P2 off-road spawn/pursuit and smoke. LOW passenger arrival observed, HIGH late in probe | Hatch defence active; passenger participation uneven. |
| L1/L3/L10 | Limited spot signoff only; no new A* defect established,not exhaustive | Contact observed; L10 also has quiet travel. No full-level taste verdict. |
