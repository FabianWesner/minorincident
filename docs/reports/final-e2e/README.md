# Final end-to-end campaign playtest

## Status

**In progress — L1 and L2 completed by real input; L3 route completion failed after four attempts.** The QA game build is from `b98aaa604`; later branch commits change playtest tools/reporting only. No game difficulty or camera code has changed. L3–L10, credits and the progressed-save checks remain outstanding.

L3 used the prompt’s explicitly permitted debug continuation for its checkpoint objective; this is a **FAIL**, not a real-input completion. L4 is now live; remaining levels are being played normally.

The headless shared-pool driver uses the player-facing title → Start game → character → level flow, normal handovers, keyboard/mouse input, low rendering quality, the default camera and `--no-skip`. Visible-guidance mode disables authored street routes and hidden navigation-grid steering. Manual interventions also use physical input. Sessions release the pool at handovers; the same campaign profile continues through the menu.

## Per-level record

`—` means unobserved; it does not mean a pass or zero. Times distinguish successful attempts from aborted driver attempts.

| Level | Time | Deaths / retries | Stuck or confusing moments | Objective gives destination? | Weapons start → story | Load to Begin | Frames >200 ms | Console errors | Carry-over (weapons / survivors / corgi) | Result cards add up? |
|---|---:|---:|---|---|---|---|---|---|---|---|
| L1 | 166 s wall / 163.8 s card; earlier attempts also disclosed below | 1 death; 2 menu restarts after driver aborts | Opening fence: 90 s stalled in first driver attempt; later weapon-route detour before driver error | Depot/Annex/fire station named; weapon objective generic, supported by marker/story bubble | Unarmed → bat, matches story | 1.72 s in successful opening sample | 0 | 0 | Bat and following corgi reach L2; no rescued human group | [Reviewed card](fresh/captures/fresh-03-L1-result.jpg): stats match mission result |
| L2 | Successful attempt 397 s wall / 111.1 s mission; all four attempts 2,137 s wall / 1,000.5 s sim | 11 deaths in earlier trials; 3 menu replays; successful attempt 0 deaths | Bridge route: fenced-yard detours, blocked vehicles and manual-input failures; see F01 | Bridge destination named; arrow gives a bearing rather than a street route | Bat → axe + bat; correct | 3.97–4.27 s menu samples; first handover ~5.5 s upper bound | 0 across all recorded attempts | 0 | Axe, bat, unlocked corgi lure and following corgi reach L3; 7 rescued recorded | No result card displayed: automatic progression to L3; stored result 111.1 s, 0 deaths, 2 knockdowns, 36 damage, 7 rescued |
| L3 | **FAIL**; four route trials 2,164 s wall, then 62.5 s mission in permitted continuation; recorded trial mission times 247.6 / 319.9 / 304.4 s | 3 recorded deaths/respawns; 4 menu replays; checkpoint objective debug-skipped once | F02/F04: vehicle closures, distant bearing and highway/fence approach; bounded retry also failed | Names army checkpoint; does not identify the turn/ramp needed | Axe + bat + lure start; handgun acquired normally; correct | 3.20–3.33 s menu; prior handover 7.76 s | 2: 266.7 ms and 333.3 ms; first aborted trial final probe unavailable | 0 observed | Earned axe/bat/handgun/lure reach L4; corgi present; natural squad/gate handover **unverified because of skip** | No card displayed (automatic progression). Debug result 62.5 s / 0 deaths / 13 knockdowns / 1 rescued cannot validate a natural L3 result |
| L4 | Three unfinished attempts: 450 / 521 / 523 s wall, 417.0 / 333.1 / 515.6 s mission; final bounded replay live | 7 deaths in third attempt; 0 in first two; 3 menu replays | Plaza fighting delayed retreat; driver read hidden legacy route pin instead of visible HUD next-turn pin; stopped after 93 s without progress | Yes: convoy, quartermaster, west/north breaches; cellar via Lakeshore, Metro Road, Harbor Street | Axe/bat/handgun/lure → army MG acquired normally; correct | 6.25 s menu / 6.30 s incoming handover | 1 frame: 266.6 ms in third attempt | 0 across attempts | Corgi hides during convoy then follows; 22 / 19 / 18 rescued recorded in trials; final handover pending | Not reached |
| L5 | — | — | Not played | — | — | — | — | — | — | — |
| L6 | — | — | Not played | — | — | — | — | — | — | — |
| L7 | — | — | Not played | — | — | — | — | — | — | — |
| L8 | — | — | Not played | — | — | — | — | — | — | — |
| L9 | — | — | Not played | — | — | — | — | — | — | — |
| L10 | — | — | Not played | — | — | — | — | — | — | — |
| Credits | — | — | Not reached | — | — | — | — | — | — | — |

## Findings

### P3 · F01 — L2 fire engine temporarily hides the courier

At the market exit, the HUD says **“Reach the police checkpoint at the bridge · 139 m”**, but the engine fills the central view and hides the courier at approximately `(-43.6, -33.9)`. The reviewed [capture](fresh/captures/fresh-05-L2-bridge-route-ready.jpg) shows the occlusion. A ground click onto visible pavement clears the vehicle; this is not a permanent soft-lock. The camera is unchanged.

### P3 · F02 — L3 distant checkpoint bearing does not explain the armored road closure

The reviewed [capture](fresh/captures/fresh-08-L3-along-street-centre.jpg) shows an armored vehicle spanning the fenced street ahead. At `(10.1, 28.0)` the objective reads **“Get inside the army checkpoint · 217 m”**, with its arrow beyond the obstruction. The bot spent over 60 s trying the vehicle edges. Backtracking to the visible Maple Ave/Pine St crossing, then following the commercial road, offered a detour. This is a recorded navigation/confusion event, not established proof of an impossible route.

### P3 · F03 — Two L3 gameplay frames exceeded 200 ms

`fresh-09` recorded one **266.7 ms** frame during active play, tick 7620, at `(-85.0, 6.6)`. The [frame record](fresh/fresh-09-frames.json) retains its timing. The reviewed [nearby capture](fresh/captures/fresh-09-L3-through-open-side-yard.jpg) shows the shop-side position; it is contextual evidence, not a visual measurement of the hitch. A further **333.3 ms** frame occurred in the continuation attempt before its skip, tick 1743 at `(-131.4, -8.8)`; its raw frame file is retained. No console error accompanied either frame.

### P3 · F04 — The L3 destination bearing permits an unhelpful approach beside the elevated highway

Following the distant checkpoint bearing along the north road led onto open ground beside the elevated highway. At `(180.8, -21.2)` the HUD said **“Get inside the army checkpoint · 49 m”** ([reviewed capture](fresh/captures/fresh-10-L3-highway-approach-road.jpg)). The following approach meets the checkpoint fence rather than its bridge entrance. The [reviewed wider view](fresh/captures/fresh-10-L3-move-around-checkpoint-wall.jpg) exposes the bridge and gate; it was an automatic game camera transition, not a manual camera adjustment. The trial recorded two deaths in total. A nearby turn/ramp cue would explain where to enter; bot navigation remains a material contributor to this trial.

L4 also recorded a **266.6 ms** gameplay frame in `fresh-15`, tick 4837 at `(-28.6, 1.3)`. Its [raw frames](fresh/fresh-15-frames.json) and reviewed [nearby defense capture](fresh/captures/fresh-15-L4-t5539.jpg) are retained; the image is contextual evidence rather than a timing measurement.

### Driver limitations and historical preflight

- The initial sandbox startup restriction was resolved when unrestricted execution was provided. See [preflight evidence](evidence/preflight.md).
- `fresh-01` aborted after 90 s at a fence, without advancing the objective. Its [capture](fresh/captures/fresh-01-L1-6009-cannot-finish.jpg) was reviewed. This is an input-driver navigation failure, not proof of a game soft-lock.
- `fresh-02` reached the outbreak and weapon search, then a partially written command file caused the driver to exit. Its profile cleanup ran; L1 restarted through the normal menu because that save did not retain the in-level checkpoint. The command-file race is fixed in `b994b8ce0`; no objective was skipped.
- `fresh-03` completed L1 and used Continue → L2 → Begin mission. [Raw run](fresh/runs-fresh-03.json), [observed text/results](fresh/fresh-03-audit.json), [frame intervals](fresh/fresh-03-frames.json), and [input/progress log](fresh/log-fresh-03.jsonl) are retained. Its one death is also shown on the result card. No console error occurred.
- `fresh-04` reached L2's bridge objective without any skip, then recorded **9 deaths** while manual steering/planning left the game running. The [mission counters](fresh/fresh-04-completion.json) establish those deaths even when the driver was not sampling its own death counter. The reviewed [alley capture](fresh/captures/fresh-04-L2-follow-visible-alley.jpg) shows approaching infected behind the courier. This attempt stopped through a normal save/menu yield; it is not counted as completion. Subsequent manual actions use the normal pause menu between decisions and real held attacks while moving.
- `fresh-05` and `fresh-06` each recorded one further death before yielding without completion. Their mission counters, captures and observer records are retained. The manual helper established gameplay focus after Resume and attempted feet aiming for keyboard attacks. Later inspection showed keyboard fire resets pointer aim, so that aiming change is not proof of correctly aimed manual attacks. Normal automatic combat uses the shipped mouse target command. These are driver changes; no game code changed.
- `fresh-08` replayed L3, completed its opening defense and handgun pickup, then spent too much of its ten-minute shared reservation in manual navigation. The wrapper stopped it at 595 s before the final observer/profile dump. Its input log and reviewed named captures survive; unpersisted final frame/mission counters are marked unavailable. A subsequent run re-enters through the normal menu. The helper now enforces its bounded yield even while in manual mode. A physical scene click after Resume is used to establish gameplay input before held keys. Some apparent input failures were subsequently explained by collisions; the canvas already has a tabindex in Pointer.init, so there is no confirmed game focus defect.
- The initial observer misread fixed-position loading cards because their `offsetParent` is null. Its 171 s L2 handover load value is invalid and is excluded. The valid menu sample is 3.97 s; the preceding L1 result/handover timestamps bound that first L2 handover by about 5.5 s. The observer now reads client rectangles and watches loading-card visibility independently of mission construction.

- `fresh-07` completed L2 and reached L3 through the actual bridge gate. Reviewed [approach](fresh/captures/fresh-07-L2-bridge-checkpoint-approach.jpg) and [gate capture](fresh/captures/fresh-07-L2-through-checkpoint-gap.jpg). The guard says “Over here! Move, move, we’re closing the gate!” The [completion record](fresh/fresh-07-completion.json) proves completedLevels 2. The handover briefly shows “Progression / Next: upgrades and loadout setup.”, then loads L3 to Begin in 7.76 s. No L2 result card was displayed; the file named `L2-result.jpg` captures the subsequent transition, not a card. The run helper reports simSeconds 0 because the automatic handover reset the tick; the retained mission result supplies 111.1 s.

- `fresh-09` yielded cleanly after 528 s wall / 247.6 s mission. Its counters show 0 deaths, 17 knockdowns, 110 damage and 1 rescued. One 266.7 ms gameplay frame was recorded at `(-85.0, 6.6)`; no console error occurred. It reached the north commercial road at `(30.7, -28.0)`, then stopped against another vehicle. The next menu entry replayed the mission opening; the in-level checkpoint was not retained across that session yield.

- `fresh-10` yielded cleanly after 521 s wall / 319.9 s mission, with 2 deaths, 39 knockdowns, 299 damage and 3 rescued recorded. Zero gameplay frames exceeded 200 ms and no console error was observed. It followed the north road past the vehicle pinch, but then approached the checkpoint beside the highway rather than over its elevated bridge. The final replay explicitly selects the earned handgun through its normal number shortcut.

- `fresh-11` yielded after 520 s wall / 304.4 s mission, with 1 death, 55 knockdowns, 122 damage and 3 rescued. Its final road/ramp retry was unsuccessful; no gameplay frame exceeded 200 ms and no console error occurred.
- `fresh-12-L3-FAIL-permitted-continuation` replayed the armory and defense normally, then invoked the one permitted debug completion of `checkpoint`. Its raw issue/assist log marks the failure. Campaign completedLevels becomes 3 and L4 loads to Begin in 6.30 s. Its helper wallSeconds is invalid (-174 s) because the old short-cap skip bookkeeping advances wallStart into the future; observer timestamps and the 62.5 s mission result are used instead. The file named L3-result.jpg was reviewed and shows the subsequent L4 loading card, not a result card.

- `fresh-13` completed L4’s convoy, quartermaster pickup and full timed plaza defense. It stalled on the cellar retreat because the observer selected the hidden legacy MissionUI route pin while the player sees Hud’s cyan `minimap-route` pin. The [reviewed retreat capture](fresh/captures/fresh-13-L4-leave-plaza-on-retreat-bearing.jpg) shows the visible cyan pin and named street route. The observer now prefers that visible HUD pin and applies its own map scale. This is a playtest-tool fix; game routing, difficulty and camera remain unchanged. The attempt stopped without a skip after 450 s wall / 417.0 s mission: 0 deaths, 76 knockdowns, 99.1 damage, 22 rescued, zero gameplay frames over 200 ms, zero console errors.

- `fresh-14` used the corrected HUD route-pin reader. It became stuck for over 60 s between the evac bus and army truck at `(-13.1, -9.0)`, with HUD “Run to the cellar via Lakeshore, Metro Road and Harbor Street · 326 m”. The [reviewed vehicle capture](fresh/captures/fresh-14-L4-thread-gap-between-bus-and-truck.jpg) preserves that position. A real [ground click outside the truck](fresh/captures/fresh-14-L4-native-ground-click-outside-truck.jpg) cleared the pinch and advanced the route cue, proving the spot was not permanently locked. The session yielded normally before completing the route: 521 s wall / 333.1 s mission, 0 deaths, 83 knockdowns, 122.25 damage, 19 rescued, zero >200 ms frames and zero console errors. Four nearby-infected movement warnings are recorded in the congested crowd; they do not establish an isolated AI freeze.

- `fresh-15` reached the street route but ended after 523 s wall / 515.6 s mission, with **7 deaths**, 87 knockdowns, 983.73 damage and 18 rescued. The deaths explain the repeated return to earlier route positions. The first route controller used coarse movement bursts that overshot close cyan turns; distance-based shorter bursts resolved that navigation issue, but retreating without counterfire let pursuers catch the courier. A final bounded replay selects the earned MG through real Digit5 and uses normal aimed attacks while moving. There was one 266.6 ms gameplay frame and no console error.

### Story observations so far

L1 connects the cold-chain delivery to the Annex bang explicitly, then directs the unarmed courier to obtain a bat and reach the fire station. The station's result card confirms the delivery while saying the outbreak is not contained. The normal L2 handover starts with the retained bat and a fire-axe pickup objective. L3 clearly links the police retreat to the army checkpoint (“We can’t hold this! Army checkpoint, up the avenues. You’re with us!”). Its natural final gate sequence remains unverified because of the route failure. L4 opens with an organized Fairhaven convoy and the promise of safety. Later story continuity remains unreviewed.

## Required follow-up

1. Run the fresh-save L1 → L10 → credits campaign by real input; record each row above and preserve reviewed captures.
2. Start progressed saves from level select at L2, L5 and L9; check each opening state.
3. Review the story for player-facing clarity and logical continuity; report any P1–P3 findings with captures.
4. For any trivially safe blocker fixed, commit each fix separately, inspect its capture, then run `npm test` and `npm run test:smoke`.

No game change has been made. No god mode or teleport has been used. L3’s checkpoint objective is the sole permitted debug continuation and must be counted as FAIL.
