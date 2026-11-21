# s187-megamoves: Mega signature moves

## s187c follow-up — L10 recovery and fairness

Fresh run on `ee57acfdb1de725ca364de9bb4b3df98269c063d` plus the changes below:

- The required full threat audit completed as two shards (`test-results/s187c-final-A`, `test-results/s187c-final-B`). The merge summary reported **0 acceptance flags**, but this is incomplete: the L10 skilled receipt contains `wave/dispersal-assault:WAVE_NO_ATTACK_WITHIN_20_SECONDS`. The audit's top-level flag aggregation counts passive flags only. L10 skilled completed; its passive window ended at the documented tick budget with 0 passive flags.
- Moving Mega damage, seed 1 / complete profile: LOW took 25 damage over 880.90 moving seconds (**0.0284 DPS**, 1.70% of 100 HP per minute); HIGH took 50 damage over 916.98 moving seconds (**0.0545 DPS**, 3.27% per minute). Both routes completed; deaths were 0 LOW / 3 HIGH. Named Mega special-move damage was 0 in both samples. These deterministic route samples are under the 25% HP/min ceiling; they do not establish a worst-case dodge guarantee. Receipt: `test-results/s187c-moving-dps.json`.
- `npm run typecheck`, `npm run lint`, and `npx vitest run tests/engine/infected-ai.test.ts --configLoader runner` passed (5 tests). The full `npm test` remote runner had no healthy worker; local fallback passed (27 files, 106 passed, 1 skipped).
- A separate focused `--levels L10` diagnostic also completed the skilled route and reported 0 passive flags, but flagged `WAVE_NO_ATTACK_WITHIN_20_SECONDS` on its assault cohort. The full sharded L10 receipt reproduces the flag; the top-level summary omits it.
- Mega coarse pursuit now invalidates saved routes after restore, steers toward the player instead of an obsolete distant route node when hidden far away, and has bounded reachable-waypoint recovery around obstructed local goals. An AI regression places the Mega at the stale L10 coarse route and verifies it resumes more than 30 m of pursuit travel.
- L10 service attackers now try the service threshold before staged/ring positions and are not reset to wandering by the dispersal-zone chase-distance rule. This does not change zombie stats.

The sampled moves stay within the measured damage target. The skilled wave flag and top-level audit aggregation remain open. Commit: `7cfea375`.

Service admission follow-up: a failed safe-position search no longer increments the already held director reservation on every retry. Typecheck and lint pass. The focused L10 audit still completes skilled with 0 passive flags, but its skilled assault still has no recorded attack within 20 seconds; this fix does not resolve that flag. Receipt: `test-results/s187c-reservation/L10.json`.

Wave event diagnostic: the passive run recorded opening cohort attack events with matching observer identities. In the skilled run, nearby attackers were cleared while the courier used the mounted gun; at 20 seconds later arrivals were still approaching, including one at platform height. No skilled cohort attack was observed in that window. This distinguishes the skilled result from a general failure to receive attack events, but does not establish why every attacker failed to wind up.

Trying the stair foot as the first safe service admission candidate did not clear the skilled wave flag; L10 skilled still completed and passive had 0 flags. The candidate change was reverted. Receipt: `test-results/s187c-stair-admission/L10.json`.

Commit `cdb56ba1` prevents Mega damage from extending an existing survivor knockdown and rejects a Mega grab against an already downed survivor. Focused infected AI tests, typecheck and lint pass; full threat and unit checks need repeating on this change. Skilled wave timing remains open.

Post-guard full threat shards `test-results/s187c-current-A` and `test-results/s187c-current-B` completed and merged with 0 top-level flags and L10 skilled complete. The L10 skilled wave flag persists in the level receipt; L8 also retains three skilled diagnostic flags. The remote `npm test` reached its 240-second limit three times, then an unchanged retry passed: 27 files, 105 passed and 1 skipped in 216.1 seconds. A complete local `npm test` also passed: 27 files, 106 passed and 1 skipped in 201.9 seconds.

Post-guard HIGH and LOW seed-1 complete-profile replays both completed and reproduced the moving Mega-source rates above (LOW 0.0284 DPS, HIGH 0.0545 DPS; named special damage 0 in both). Receipt: `test-results/s187c-current-moving.json`. The audit report explicitly labels the skilled G-22 wave observation informational and gates the passive observation; its L10 passive wave passed. The skilled wave diagnostic remains a documented limitation, not a hidden top-level acceptance failure.

## s187b follow-up — coarse pursuit stall

Full merged-source threat audit on `04d63139`: **0 flags**, all ten skilled routes complete, including L10. `npm run qa:threat:sharded` completed both remote shards and merged their receipts (392.0 s maximum shard time). Remote `sh tools/remote/run.sh "$PWD" -- npm test` passed: 27 files, 105 passed, 1 skipped, 195.7 s.

The merged-source L10 skilled route now completes in an isolated native audit after fixing coarse Mega pursuit recovery. The former route left the Mega parked at x≈1882 from the restricted-zone stage onward; the coarse navigation branch reset its stuck sample every tick and did not run the detailed progress monitor. Coarse pursuit now measures resolved travel over the configured stuck window and uses the existing recovery escalation, including authored-link avoidance, while retaining collision checks.

- `npm run typecheck`: passed.
- `npm run lint`: passed after removing an unused helper parameter.
- `npx vitest run tests/engine/infected-ai.test.ts --configLoader runner`: passed (1 file, 5 tests).
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L10 --out test-results/s187b-l10`: skilled route **complete**, 1,020.27 simulated seconds, 0 deaths. L10 skilled flags: 0. Hold: 6 attack windups in 65.15 seconds, first attack at 11.33 seconds. Passive flags: 0. The command's one global `PARTIAL_LEVEL_SELECTION` flag is expected for this diagnostic subset; it is not the full threat gate.
- The prior full `npm run qa:threat` attempt on the merged source hit its 600-second budget / browser reservation cap before producing a complete audit. It did show the L10 skilled route itself completed in 140.4 wall seconds, but the pre-fix route receipt had 0 hold windups and timed out.
- `npm test` remote attempt could not start (no healthy Hetzner runner); the prescribed local fallback passed (27 files, 106 passed, 1 skipped, 236.5 seconds). The additional remote `tests/engine/l4-contact.test.ts` attempt was likewise unavailable.
- `npm run qa:threat:sharded` could not start either shard: no healthy Hetzner runner, and the Mac fallback only accepts plain Vitest/test commands. No full audit receipt was produced after the fix.
- HIGH native L10 pacing, seed 1, complete profile: route completed in 1,149.07 simulated seconds. While the courier actually moved for 891.78 seconds, Mega-sourced hits dealt 98.28 damage over 4 hits, **0.1102 damage/second**. Combat events identify the source action as `infected.alpha`, so this aggregate cannot separate special-move hits from ordinary Mega contact attacks. Evidence: `test-results/s187b-moving-dps.json`.
- Earlier sandbox restrictions prevented committing; the fix was subsequently committed as `04d63139`. The special-move-only measurement is recorded below.

**Threat audit acceptance passes.** The service approach still needs visible-arrival review, and visual arrival review remains open.

HIGH seed 1 complete-profile replay measured **0 special-move damage per second while moving**: 0 damage from named Mega special attack events during 891.78 seconds with more than 0.01 m displacement per tick. The route completed in 1,149.07 seconds. This is one deterministic route sample, not a worst-case ceiling; movement includes physical displacement and the result does not prove every move missed in other circumstances. The separate Mega-source aggregate was 0.1102 DPS, including ordinary attacks.

## Implementation

Committed in `b13a9f47`, `7c8f6676`, and `4c52b512`.

- Added ranged debris throws, living infected throws, a leap slam, and a pursuit roar for the Mega Alpha. The roar rallies infected in range; the Mega call reuses the existing roar event. Charge range and wind-up were increased, with a wall collision stun. Existing close-range slam and grab remain.
- Mega prop throws select a movable prop within 3 m or create a concrete chunk from the ground. The chunk uses the existing debris pool and has a blocking collider for its eight-second lifetime. Living infected can be thrown when within 3 m of the Mega and the courier is 8–30 m away. These share the throw cooldown. Thrown infected take fall damage; projectile hits damage and knock down the courier.
- Added Scene Lab scenarios for zombie throw, leap, and roar under `tests/scenes/l10-mega-moves/`.
- Reused existing rig poses and audio cues. Asset request: dedicated Mega throw, leap and roar clips; the current motion uses existing poses and procedural timing/effects. No new rig assets were authored.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Final typecheck and lint after the audio mapper test: passed.
- Focused infected AI and save-progression tests: passed after selecting an existing throw cue.
- Remote `npm test`: reached the 240 s budget without a reported test failure. The specified fallback passed: local `npm test` (27 files, 106 tests, 183.9 s) and remote `tests/engine/l4-contact.test.ts` (1 test).
- Latest remote `sh tools/remote/run.sh "$PWD" -- npm test` on `3f2ac658`: passed in 215.3 s (27 files, 105 passed, 1 skipped).
- Earlier `npm run qa:threat` before the safe admission change reported 0 fail flags, but L10 skilled hit its tick budget. The later full run below supersedes that result and failed.
- An isolated `node --import tsx/esm tools/qa/threat-audit.ts --levels L10` reproduced the skilled tick-budget outcome at 1,800 simulated seconds. The passive hold window was measured (468.86 attacks/minute, L10-11 PASS); its tick-budget is the documented observation cap. The partial run's only fail flag was `PARTIAL_LEVEL_SELECTION`, so it is diagnostic and does not replace the full gate.
- Regression comparison, isolated L10 native skilled audit, seed 1, LOW: baseline `bc57d840` completed in 1,120.02 s with 2 deaths and 559.99 total damage taken; `02fd92c6` hit 1,800 s at the Mega objective with 41 deaths and 4,526.12 total damage taken. These are whole-route totals, not Mega-only DPS or the requested HIGH walk measurement. The new behavior fails skilled route completion and needs balance/behavior investigation.
- A native replay attributed only 45 damage to the Mega directly; ordinary infected dealt most damage. Restricting the existing encounter-wave request to its original rage phase did not change the 41-death outcome. Typecheck, lint and the focused infected AI test passed after that correction.
- Enforced at least 180 ticks between Mega special starts. Typecheck, lint and the focused infected AI test pass. The isolated LOW L10 audit still hit the skilled tick budget with 44 deaths; the spacing correction alone does not resolve the regression.
- Pursuit now selects leap and charge outside the close-range brain. The focused AI test checks automatic leap selection at 20 m and the 179/180-tick spacing boundary; it passes. The isolated LOW L10 audit still timed out at the Mega objective with 44 deaths after this change.
- Corrected the Mega throw marker's range cap from 25 to 35 m to match its projectile. Typecheck and lint passed; visual verification of a throw beyond 25 m remains open.
- The ground fallback is covered by the focused AI test, including creation of a concrete chunk with a blocking collision group and a thrown event when all 32 ordinary debris slots are occupied. Two additional slots are reserved for Mega chunks. Typecheck and lint pass. The 30 m ground-rubble Scene Lab scenario passed its HIGH and LOW gates and reached the throw's active stage; its strips are in the contact sheet for visual review.
- With the fallback enabled, the isolated LOW L10 skilled audit again hit 1,800 seconds at the Mega objective, with 47 deaths and 5,105.55 total damage taken. The partial run is diagnostic and does not replace the full gate.
- Mega projectile hit checks now account for flight height. A focused simulation moves the courier 3.6 m sideways during a rubble throw tell and observes no damage; typecheck, lint and the focused AI test pass. This is one throw case, not the complete scripted dodge matrix.
- HIGH headless Scene Lab sidesteps beginning at frame 0 passed active-move and 100 HP gates for charge, ground slam, close grab, leap, living missile and ground rubble throw. [Gate results](sidestep-results.json) retain those checks. These six fixed scenes exercise one distance and direction each; they do not prove every possible dodge or assess visual readability.
- HIGH native pacing comparison, seed 1, `complete` profile, 1,800 s: baseline `bc57d840` had 38 deaths; `b12551b8` had 36. Both timed out at the farmstead. [Comparison](high-pacing-comparison.json). This route does not complete and the totals include all causes, so it does not establish the Mega-only moving DPS ceiling or replace a completed HIGH walk.
- HIGH native `l10Walk` input, seed 1, 1,800 s: baseline `bc57d840` timed out at farmstead with 35 deaths and 1,227.49 direct Mega damage; current `44a928f7` timed out at research hangar with 16 deaths and 936.05 direct Mega damage. These damage totals include stationary moments and unequal encounters; they do not establish the moving DPS ceiling or a completed route.
- LOW finale diagnostic: baseline killed the Mega during hold and completed; the current route reached the Mega objective and accumulated 44 deaths there in the instrumented run. A temporary policy experiment prioritizing an ordinary infected within 5 m reduced a subsequent run to 23 deaths but still timed out; that policy change was reverted. This supports further investigation of the horde and retry interaction, not a passing balance result.
- Pursuit roar can start without line of sight or an on-screen Mega, preserving roars between sightings. A focused AI check forces both visibility gates false and confirms roar selection; typecheck and lint pass. The subsequent L10 measurements below do not establish the moving DPS ceiling.
- After the roar change, isolated LOW L10 still hit the skilled tick budget at the Mega objective, with 6 deaths and 1,317.75 total damage taken. The partial audit is diagnostic, not a complete gate.
- Ranged throw markers now use the predicted target direction used by the projectile. A focused moving-target check verifies the direction; typecheck, lint and that AI test pass.
- The 6-death LOW timeout left the Mega near x=1882 in hidden coarse pursuit while the courier reached x=4018. Its route began at an old node near x=807. Resetting the route on restore had no effect; an experimental distant-leg rejoin moved it about 93 m but still timed out and introduced a passive stuck-chaser flag. Both experiments were reverted. The coarse pursuit stall remains open.
- A further temporary rejoin plus nearest-reachable coarse steering brought the Mega within 32 m of the courier, but the skilled route still timed out with 42 deaths and the passive audit flagged a stuck chaser. That experiment was also reverted; collision-safe pursuit and the skilled completion requirement remain unresolved.
- PO spawn safety: the existing finale service breach spawned directly about 3 m from the courier; it now waits for a resident point that passes `director.safe` (at least 18 m, offscreen or occluded, navigation clear) and then pursues normally. A LOW seed-1 native L10 trace recorded 1,139 `LevelTenEncounters` spawn calls, minimum distance **18.0002 m**, **0 on screen**, and **0 failing `director.safe`**; 503 were service-breach admissions. The trace ended at the Mega objective with 4 deaths and a tick-budget outcome. It does not prove each arriving infected subsequently became visible; browser arrival review remains open. The Mega moves themselves create no infected: living missiles select existing ordinary infected.
- A second LOW native trace sampled service actors in the camera every 30 ticks: 47 of 397 tracked entity IDs were observed on screen after admission. IDs can be reused, the sample is intermittent, and this is not a visual or line-of-sight receipt. The remaining arrivals are unproven; the service approach needs further work and review.
- Full `npm run qa:threat` after the safe admission change: **failed**, 1 flag (`L10/step/hold:SKILLED_ZERO_ATTACK_WINDUPS`); L10 skilled hit its tick budget with 4 deaths and the Mega about 2,117 m away. Other skilled routes completed. The service entrance needs an effective visible approach, and the coarse Mega pursuit stall still blocks completion.
- Mega ranged throws use separate rip and launch-whoosh cues; close grab retains its own cue. Throws and leap impacts emit a positional impact cue, including misses. Typecheck, lint and focused AI tests pass, including one impact event per tested throw and leap; a focused audio mapper test confirms the impact position is passed to playback. Audible review remains open.
- Focused AI simulation confirms a 20 m debris impact deals 25 damage and knocks down, and a living-missile impact deals 20 damage and knocks down. The debris fixture must run through the full flight; the earlier shorter run established launch only.
- A focused charge collision fixture places a barrier in the committed path after the tell starts and verifies both obstruction and stagger last 120 ticks (2 s). It passes; this covers the wall collision path, not every vehicle/building shape.
- Headless WebGL2 Scene Lab under `tools/e2e-lock.sh`: all nine original HIGH scenarios and the zombie throw, leap, roar and debris throw HIGH/LOW scenarios passed their configured gates. [Contact sheet](moves-contact-sheet.jpg) contains their six-frame HIGH and LOW strips; visual review remains for the orchestrator. The debris scenario records active and recovery stages; these isolated scripted scenes do not establish hit, dodge or DPS criteria.

## Open acceptance items

- Review ground rubble appearance and landing in browser QA.
- The HIGH complete-profile moving special DPS sample is 0; the earlier HIGH walking comparison did not complete and the requested ceiling is not established across other routes.
- Confirm scripted sidestep dodges, damage/knockdown outcomes, and all move telegraphs in browser QA.
- Complete the L10 skilled route and clear all full threat audit flags; the passive hold uses a documented observation cap.
- Verify service arrivals can be seen approaching, and repair the coarse pursuit stall without bypassing collision.
