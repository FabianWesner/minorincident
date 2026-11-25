# s237 · L10 finale ride loop

## Current result

Both latest HIGH and LOW skilled native routes completed, with all four roadblock sequences observed: mounted arrival, E dismount, on-foot fight, opened gate, E remount and crossing. HIGH took 446.9 seconds from the finale start to the gate. LOW took 551.5 seconds, 11.5 seconds above the 540 second cap. The route therefore meets the loop count on both tiers and the time window on HIGH only.

Story radio cues were spaced at 45 seconds in HIGH. LOW had a 189.8 second gap after its sixth cue and did not deliver the tenth cue. The interval rule is not satisfied on LOW. See the complete native observer receipt in [route-final.json](route-final.json), including deaths, transitions and moment cadence.

| Tier | Outcome | Total route | Deaths | Hangar → gate | Roadblock loops | Story beat marks |
|---|---:|---:|---:|---:|---|---|
| HIGH | Complete | 1520.6 s | 10 | 446.9 s | 4/4 | 0, 45, 90, 135, 180, 225, 270, 318.5, 363.5, 408.5 s |
| LOW | Complete | 1539.1 s | 16 | 551.5 s | 4/4 | 0, 45, 95.2, 140.2, 185.2, 230.2, 420.0, 465.0, 510.0, not observed |

Loop phase ticks are in the JSON receipt. Deaths preserve the encounter ledger, so the observer now retains loop progress across checkpoint restores, matching the game state. The run still requires a new mounted approach for the next barrier and records its final remount and crossing.

## Set-piece visibility

HIGH then LOW were captured with the native game camera at zoom 1 using the dev server and headless browser pool. The capture is a teleported staging fixture, not a route replay. On both tiers the quarantine sign and figures are visible, though its upper text is clipped; the billboard is only partly in frame. The underpass reads as a dark empty road with its structure mostly outside the frame. The hospital frame shows road and a lamp, with no readable tents. These captures demonstrate the visibility work remains open. Reviewed sheets: [HIGH](captures/high/setpieces.jpg), [LOW](captures/low/setpieces.jpg).

## Validation

- `npm run typecheck` — pass on final source state.
- `npm run lint` — pass on final source state.
- Targeted regression tests for L10 camera framing and save progression — 9/9 pass after fixing the story cadence and underpass wall restore regressions.
- Full local `npm test` — pass, 105/105 tests across 27 files (the suite budget remains 148/150).
- `npm run qa:threat` — final all-level run exceeded its 600s browser reservation and exited 124. The previous completed audit reported one L10 LOW passive flag, `UNOBSERVED_PASSIVE_CRITERION_STEP:hold`; its no-attack route stopped at the first combat roadblock. Zero flags are not verified.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test` — pass: 104 passed, 1 skipped, 27 files, 220.3 s.
- No test cases were added. The configured suite remains 148/150 cases (127 Vitest, 9 E2E, 12 browser invariants across 45 files).

## Open

1. Reduce the LOW hangar-to-gate time by at least 11.5 seconds without increasing retries, and keep its story cadence within 45–75 seconds.
2. Make the underpass and hospital readable and recapture all four set pieces on HIGH and LOW during native route variations.
3. Reconcile the L10 passive threat audit with the required combat-gated roadblocks, then obtain a zero-flag all-level receipt.
4. Re-run the full threat audit within the reservation limit after resolving its L10 passive coverage path.

## Hospital trigger investigation

The opening trigger is centered at (3500, 50), away from the road at z=95. A trial moving the trigger to within 32 m of (3502, 95) made the native probe report the tent opening on both tiers. LOW still completed in 1539.1 s, but HIGH reached the 2100 s budget at the release objective with 44 deaths. The trial was reverted because it destabilized the full route; the staged figures also remained unverified. The next fix needs to preserve the native route while making the hospital visible and opening it from the road.

A subsequent change opens the tents from the road approach while holding staged figures until 90 ticks after the courier crosses x=3512. The HIGH and LOW native probes both completed with 4/4 recorded loops and unchanged hangar-to-gate times of 446.9 s and 551.5 s. Both recorded the tent opening; both still failed the in-frame figure check. Typecheck and lint passed. This establishes the trigger, while visual readability and the LOW timing remain open.

## Checkpoint route investigation

The LOW trace showed repeated deaths after a checkpoint returned the bot from the underpass to x≈3100 while its route waypoint remained near x=3370. A trial reacquiring the nearest route waypoint after a backward jump over 100 m improved LOW to 487.3 s, 9 deaths, 4/4 loops and story intervals of 45–67.7 s. HIGH regressed to 684.0 s and 22 deaths despite retaining 4/4 loops. The trial was reverted; a recovery policy needs to work on both tiers before it can qualify.

A narrower recovery rule rejoins the road only when a later checkpoint retry returns west of x=3150. The [new native trace](route-recovery.json) completed HIGH in 1520.6 s (10 deaths) and LOW in 1411.0 s (8 deaths), with 4/4 run-level loops on each. Hangar to gate was 446.9 s HIGH and 457.4 s LOW. Story beat intervals were 45–48.5 s HIGH and 45–67.7 s LOW. Loop progress is retained across deaths as described above. Typecheck and lint passed. Visual readability and zero threat flags remain open.

## Native browser capture follow-up

The HIGH native research-checkpoint bot capture crashed at beat 6 when a missing special attack was dereferenced. A guard fixes that crash; on rerun HIGH reached 9/10 beats and LOW 7/10 before the capture tick limit. The inspected [HIGH sheet](native-high-partial.jpg) shows the motorbike with sidecar, combat, road and corn; the hospital and underpass are not readable. The inspected [LOW sheet](native-low-partial.jpg) shows the gate edge and repeated fighting at the convoy, never reaching the hospital capture. These partial routes do not prove visual acceptance. Typecheck, lint and the existing seven combat tests passed after the guard.

## Passive threat route investigation

A diagnostic trial allowed the existing bot to attack only while on foot within 40 m of a closed L10 roadblock; the hold remained stationary and attack-free. The LOW passive audit then advanced from the first roadblock to x=3479 at the hospital, but still exhausted its 1800 s budget before the hold and reported `UNOBSERVED_PASSIVE_CRITERION_STEP:hold`. The audit change was reverted. This is not a zero-flag receipt, and a sound passive measurement must both reach the hold and state its prerequisite combat policy explicitly.

## Hospital composition trial

Moving the first tent from (3500, 50) to (3500, 108) did not make it visible in a staged HIGH zoom-1 capture at (3502, 95). The trial was reverted because it did not improve the frame and placed the solid footprint closer to the ride lane. The cause of its absence requires render/occlusion and streaming inspection before another placement change.

## Hospital frustum diagnostic

At the staged road pose (3502, 95), the camera target was (3502.55, 0, 95) and all three original tents were culled outside its frustum; no see-through placements were cut. A trial at (3500, 108) was also culled. Moving the first tent to (3494, 87) selected LOD1 but left only an edge at the top of the image; (3498, 90) brought a large cropped wall into view while encroaching on the route. Both trials were reverted. The evidence points to the follow-camera composition and tent orientation/scale, rather than the see-through cut, as the remaining visual problem.

## Scaled tent composition trial

A half-scale first tent at (3500, 91) was fully visible in a staged HIGH frame, but showed a blank side and occupied the edge of the road; the opening and figures remained unreadable. Both native bot routes completed with 4/4 recorded loops and 459.5 s HIGH / 458.7 s LOW, but HIGH had 15 deaths versus 10 in the prior trace. The trial was reverted; a readable triage composition needs an entrance and figures in view without compromising the lane.

## Underpass source finding

The current L10 layout contains no `prop.l10-underpass`: mainline s219 replaced the bridge, piers and lamps with the sinkhole collapse at x=3390. See [the s219 report](../s219-l10sinkhole/README.md) and commit `b6acacd8`. The requested readable underpass therefore requires new composition around the retained collapse and detour; camera or occlusion changes alone cannot reveal an asset that is absent. Preserve the existing sinkhole collision and route while addressing this requirement.

A follow-up passive diagnostic allowed the normal combat approach until cure installation and retained attack-free input thereafter. It still stopped at the hospital before the hold. At tick 107401 the hospital gate was open, all three authored wave slots had been hit and were down, and the courier was on foot near x=3479 trying to return to the bike amid bodies. The measurement policy trial was reverted. This narrows the remaining issue to native remount/path recovery after the open gate; it does not establish a zero-flag audit.

## Remount planning trial

A bot trial planned around large corpses and approached within 0.5 m of the parked bike. With normal combat enabled on the approach, the diagnostic passive route reached the hold and recorded 129 attack starts in 64.9 s, but its final reachable count was 7/8 (87.5%); the lone unreachable actor was at x=3775.5, far behind the console at x=4001.6. The L10 diagnostic retained `step/hold:BELOW_REACHABILITY_PERCENT_90`. The ordinary HIGH/LOW route trial recorded 4/4 loops and 470.1 s / 525.4 s, but LOW had a 106.3 s story interval. Both trial changes were reverted; neither the threat nor cadence criterion is established by this experiment.

## Unreachable actor identity

A replay of the temporary remount and combat-approach diagnostic identified the lone unreachable hold actor as the 3000 HP pursuit Mega (`infected.alpha`, `pursuit: true`), hidden in coarse pursuit at x=3769.6 while the player was near the console. In the skilled run the same pursuit actor was visible at x=3901.0. The diagnostic changes were reverted. Any fix must preserve the Mega pursuit and reveal rules while getting it into the hold’s reachable area; suppressing the actor from the audit would not resolve the measured behavior.

## Mega route trace

A temporary passive-approach replay sampled the Mega every 600 ticks after cure installation. While the courier stood at x≈4002, the coarse pursuit moved from x=3783 to x=3802, entered stuck level 2, then followed route nodes 44 → 43 west to x=3709 before returning east. It repeated the pattern by tick 60600. The skilled run instead advanced through nodes 45–47 toward the complex. This identifies a coarse route fallback loop as the source of the far-away Mega observation; the diagnostic changes were reverted. A repair must retain obstacle-aware movement and normal pursuit speed while preventing backward cycling.

## Pursuit shortcut trial

The coarse graph has a shortcut from node 43 (3697, −25) to node 48 (3940, −25). Removing that link in the temporary combat-approach/remount diagnostic moved the unreachable Mega from x≈3775 to (3897, −30) at the final hold sample, but the sample still had only 7/8 reachable and retained `step/hold:BELOW_REACHABILITY_PERCENT_90`. The skilled route completed. The shortcut and diagnostic policy were restored; the route needs a further obstacle-aware correction and a full native regression pass.

## Direct coarse target trial

A trial removed the 43→48 shortcut and kept the coarse navigator targeting the courier during charge instead of falling back to a route node. The same focused L10 diagnostic still reported 7/8 hold reachability, with the Mega at x=3801.6. The trial was reverted. The local obstacle-aware navigation itself needs inspection around that point; choosing the direct target alone does not solve the route.

## Charge pursuit correction

The coarse navigator previously stopped targeting the courier as soon as the hidden Mega entered the 200 m cruise band, then could fall back to a node behind it. During the active charge it now keeps the live target in the existing bounded obstacle-aware navigator, without changing speed or collision. The focused L10 audit, with ordinary combat on the prerequisite roadblock approach and passive inputs after cure installation, reported zero L10 flags: skilled complete in 1481.0 s with 9 deaths; the 64.9 s passive hold had 8/8 reachable at its final sample and 127.5 attack starts/min. Its overall exit was nonzero solely because a one-level diagnostic is not the full audit. Typecheck and lint passed. The full remote all-level audit timed out at 600 s under load. The remote unit suite timed out twice at its 240 s budget; the second run reported two individual failures before timeout, without final failure details. Full verification remains open.

## Remote unit retry after timeout

The required unchanged remote unit retry was queued again after the two prior timeouts. Runner status showed it waiting in FIFO with load 7.77; after over ten minutes without admission it was cancelled because the original task timebox had elapsed. No tests started in that attempt and it supplies no pass/fail result. The preceding full remote unit run remains incomplete.

## Underpass approach trial

A render-only trial placed the existing underpass model at (3380, 95) ahead of the retained sinkhole, at roughly half scale. At the staged rim pose (3390, 74) it was outside the visible frame; at an approach pose (3378, 95) it filled most of the frame and the courier see-through disc cut a large circular hole through its deck. The trial was reverted. A readable underpass requires a camera-aware split composition that does not obstruct the courier or undo the see-through behavior.

## All-level sharded threat audit

Three sequential local shards completed in 191.8 s, 188.1 s and 336.5 s; their merge exited zero and its aggregate reported zero flags. Direct inspection of the raw level results found 12 L8 skilled flags (unreachable share, slow followers and late tunnel-breach attack) which the aggregate does not include. All other skilled flag lists and every passive flag list were empty, including L10. The audit uses ordinary combat to pass L10 roadblocks and attack-free input after cure installation. The [summary](threat-shards-summary.json) preserves the per-level distinction; the all-level “zero flags” acceptance remains open until those L8 findings and aggregate reporting are resolved.
