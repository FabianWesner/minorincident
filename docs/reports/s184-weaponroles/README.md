# Fire death review

## Handoff — open items

- After merging main `23a6e9a5` (merge `c36d6a55`), the full `npm run qa:threat` completed in 279.2 s with **0 fail flags**. L6 and L7 skilled and passive routes completed; L10 skilled completed.
- MG suppression is committed as `1947b9bc`: 20% for 0.5 s only at 20–26 m. This is substantially narrower than the original all-hit design and needs product review. L10 skilled bot rifle selection is committed as `0e3f2d9b`.
- The two latest required remote unit runs timed out at the 240 s budget; rerun the full unchanged suite. Typecheck and lint passed before the latest main merge, and focused combat and L4 tests passed before that merge. Re-run these gates on the final merge.
- Flame death visual acceptance remains open: HIGH and LOW settled heaps show crossed bones, but the ash is small and dark and the body shrinks then switches abruptly instead of crumbling. The experimental `src/render/CrowdView.ts` heap changes remain **uncommitted** in this worktree because they have not passed visual acceptance; preserve or reimplement them in the follow-up. The queued s183 lane owns stream visuals.
- Rocket knockdown exceptions remain as requested: Mega, arena boss, and L7 escort followers. Audio listening review of the flame loop/stop and layered melee distinctness remains open.

The earlier entries below are chronological diagnostics; this handoff supersedes their interim status.

HIGH WebGL2, zoom 1.5, six frames over two seconds: [contact sheet](ash-high.jpg). LOW used the same scene and ended at frame 125; [metrics](low-metrics.json). Both runs reported zero console errors and no clipping flags.

Visual review: the initial capture showed the full-colour corpse still drawn over the heap. Routing fire deaths away from the civilian renderer removed that duplicate. The remaining heap reads as a dark rectangular slab with pale bars rather than ash and bones, and the crumble is not convincing at this zoom. **Visual acceptance fails**; improve the heap and repeat both captures before sign-off. LOW shows the same slab. Scene setup is [scene.json](scene.json); it invokes the real fire damage path on an infected fixture.

Second capture: the heap is now rounded rather than rectangular, and the duplicate body remains absent. HIGH and LOW still show a smooth dark oval with barely visible bones at zoom 1.5; the crumble is not clearly readable. Visual acceptance remains open. Both reruns report zero console errors.

Latest capture: the linked sheet crops the original 1280×720 frames around the target without changing the 1.5 camera zoom; the final panel is LOW. The body now turns dark across its whole surface and two pale bones are visible on both tiers. The body visibly shrinks, but it does not yet break into convincing fragments and the heap still reads as a smooth dark oval. Visual acceptance remains open. Both runs reported zero console errors.

The latest sheet also removes the red blood pool previously emitted by fire damage. A brief ash puff was added, but is not clearly readable in these frames; the transition still appears to shrink and then switch to the heap, so visual acceptance remains open.

Continuation review of the stored HIGH/LOW sheet confirms the heap still reads as a smooth dark oval; the pale mark is too small to read as bones. The source now uses four angular dark fragments and larger crossed pale bones, but the required recapture could not run in this sandbox: the browser pool failed to bind its local port (`EPERM`), and the lock fallback could not inspect processes (`ps` denied). Visual acceptance remains unverified.

## Audio source investigation

The sprite now includes CC0 recordings for flame ignition, a [blowtorch-based flamethrower](https://freesound.org/people/SamsterBirdies/sounds/490166/) loop and tail, a pneumatic nail-gun shot, and a [flashbang detonation](https://freesound.org/people/areniporgen/sounds/693421/); provenance and hashes are in `assets/audio/imports.json`. Weapon-specific reload and impact cues are wired and listed in the design table. The builder can use hash-verified cached source files when an upstream archive is unavailable. The flame loop and stop still need listening review against the requested roaring hiss and sputter, and layered melee sounds need an audible distinctness audit.

## Preliminary L6 threat comparison

The merged L1–L10 threat audit reported four L6 early-close flags: two slow-follower observations and two breach waves without an attack within 20 seconds. The same L6 audit on current main and on an isolated branch copy with only MG suppression removed had no L6 flags. The early-close courier still lost 75 HP with suppression, so these flags do not establish that the entire level is harmless. The prescribed suppression remains enabled and infected stats are unchanged. [Comparison](l6-comparison.json); [merged summary](threat-summary.json). The L10 skilled route also reached its tick budget rather than completing, although that condition was not counted in the audit's four gate flags.

Rocket knockdown is not yet universal: existing arena-boss and Mega handling suppresses it, and the L7 escort rule exempts following civilians. These exceptions need implementation and validation against the requested blast behavior.

Post-merge remote `npm test` passed with 105 tests passing and one skipped, including the contact-spread assertion and retained checkpoint-rack coverage. Typecheck and lint passed; both HIGH and LOW capture runs had zero console errors.

Main was merged through `ef72dad9`, integrating the assault-rifle torch and fixed start racks. The post-merge L6 diagnostic still reports the same four L6 flags (plus the expected partial-level diagnostic marker). The post-merge L10 diagnostic again reached its skilled-route tick budget without completing. The separate `s191c-l6balance` lane also reports unresolved L6 pressure failures and has not supplied a passing L6 fix.

Continuation note: `git merge main` could not start because Git could not create `ORIG_HEAD.lock` in the shared repository metadata outside the writable worktree. The current full `npm run qa:threat` rerun after reducing MG slow from 20% to 5% still reports four acceptance fail flags: L6 breach1 first attack after 22.5 s, L6 kiting attack and landed-hit floors both at 0, and L7 follower wait above 10%. L10 skilled remains `tick-budget`. These are open; no zero-flag result has been established.

After merging main at `319f9f3a`, the full audit with 5% MG suppression reported three L6 flags (breach1 timing and both kiting floors); L10 skilled remained at tick budget. A focused L6 run with 1% for 0.5 s cleared the breach and attack-rate flags but still recorded zero landed kiting hits. Shortening it to 0.1 s also failed the landed-hit floor. These almost imperceptible variants are not accepted; the prescribed 20% for 0.5 s has been restored pending a meaningful fix.

A new HIGH and LOW capture at zoom 1.5 shows pale crossed bars on a very small dark cluster; it still does not clearly read as ash and bones at gameplay scale. Both scene runs reported zero console errors. The crumble and zoom 1 remain open.

Further merged L6 diagnostics: limiting suppression to heavy archetypes retained three flags; an intermittent 20%/0.1 s pulse on one in four attacks retained two. Removing suppression entirely yielded zero L6 flags (plus the diagnostic partial-selection marker). The experimental limits were reverted because they did not satisfy the gate and materially weakened the weapon role. A meaningful suppression rule that passes the full audit remains open.

A 3-second per-target suppression cooldown was tried with both 0.5-second and 0.1-second slow windows. Each still produced two L6 flags; both experiments were reverted. Showing the heap halfway through the collapse was also tried in HIGH: the bones appeared beside the still-intact body, so that transition was reverted. The current heap and crumble remain visually unaccepted.

A 20% slow for 0.5 s limited to hits within 1.5 m of the shot origin produced zero flags in the full merged `npm run qa:threat` audit; L10 skilled still reached tick budget. This substantially narrows the MG control role and remains under review. Typecheck and lint passed. The local unit suite failed the L4 perimeter routing assertion with two stopped actors, so this change is not yet accepted or committed.

The remote full unit suite reproduced the same two L4 routing failures (104 passed, 1 skipped, 1 failed). A focused L4 run with original unrestricted suppression passed; the 1.5 m limit therefore changes that deterministic scenario. A 2 m limit kept L6 diagnostic flags at zero but still failed L4 routing. The 1.5 m candidate has been restored for continuity; it is not accepted.

Further L6 diagnostics: granting full-range suppression while the shooter is stationary produced ten L6 flags; a 2.5 m limit produced two. Both were discarded. The zero-flag 1.5 m candidate remains in the worktree but fails the L4 routing test.

HIGH zoom 1 capture of the revised geometry shows two crossed pale bones with rounded ends over a dark angular cluster. The bone ends now read as bones, while the cluster still needs a convincing ash texture and the collapse remains unproven. The scene reported zero console errors; typecheck passed. The matching LOW and zoom 1.5 captures remain to be repeated after visual refinement.

The HIGH zoom 1 heap now has eight irregular grey fragments under crossed bones with rounded ends. In the capture the bones are identifiable, but the fragments remain dark and tiny; the transition, HIGH 1.5 and LOW still require review. A per-instance color attempt rendered white and was removed. Scene capture and lint passed.

Current HIGH zoom 1.5 sequence and LOW heap captures both report zero console errors and clipping flags. The settled heap shows recognizable bones on a dark cluster; the HIGH sequence still shrinks a body and switches abruptly, so visual acceptance remains open. An additional suppression variant retaining the full slow beyond 15 m left one L6 flag and was reverted.

Main advanced and was merged again, including the re-landed fixed start racks and L6 survivor balance. On this merged state, focused L6 with original unrestricted suppression reported three flags; the 1.5 m candidate reported zero L6 flags (the only gate marker is partial selection). The full audit and L4 regression must be rerun on this merge. A screen-door dissolve produced obvious dithering rather than crumbling and was reverted.

After the latest merge the L4 test still fails with the 1.5 m candidate. A diagnostic that also suppressed beyond 22 m passed focused L4 and L6, but its gap in effective range has no coherent weapon role and was discarded; a far-only variant passed focused L6 but is similarly too narrow. The earlier 1.5 m candidate remains unaccepted.

Continuous distance curves were also tested: a 15–22 m ramp left two L6 flags; a 20–22 m ramp cleared focused L6 but made the L4 route time out. Both were reverted. The 1.5 m candidate remains unaccepted.

An early fragment-only transition was captured at frames 53, 65 and 77. It still jumps from a recognizable dark body directly to a small pile, so it was reverted. The current main remains an ancestor of the lane. The visible crumble remains open.

L10 isolation on the latest merge: main's skilled route completes. Restoring the whole main weapon catalog also completed; restoring nail damage, rifle range/pierce, flame numbers, flash radius, or rocket knockdown individually did not. Restoring the nail gun's louder noise alone completed, indicating the required quieter shot changes the encounter sequence. The skilled bot now prefers the hunting rifle over the nail gun on open travel, preserving the quiet nail gun; focused and full L10 skilled routes complete. The full audit reported one L7 slow-follower flag (`step/departure:99`), so zero flags is not yet established on this merged state.

The 20–26 m suppression rule passed focused L4, L6 and L7 checks and the full merged `npm run qa:threat` with **0 fail flags**; L10 skilled completed. Combat tests, typecheck and lint passed. The rule is a substantial reduction from the original all-hit suppression and is recorded in the design table. The required remote unit suite timed out at 241.3 s; an unchanged rerun also timed out at 240.8 s under runner load. Neither completed, so remote unit verification remains open.

## s184d weapon-role restoration

Restored the weapon-role merge on top of main `94ec745d`. The unchanged L4 contact test passed locally with the shipped 20–26 m MG suppression rule; the previously failing 1.5 m trial recorded above was an unaccepted experiment, not the restored rule. Typecheck, lint, and full `npm run qa:threat` pass (0 fail flags). The unchanged local `npm test` suite passes (106 tests). The required remote run could not start because no healthy remote runner is provisioned. No weapon or infected stats were changed for this restoration.

Remote focused L4 verification reproduced the reported actor 373 routing failure (ticks 17127–17428). The local pass does not establish a fix; the cause and remote full suite remain open.

Remote tracing: actor 373 is a living firefighter with no active status or stagger during the stalled window. Navigation accepts its requested step, but the final contact transaction rejects it against living firefighter 360. Selecting the street-clearing target using the infected grid did not change the failure. A tentative sidestep around a rejected body moved the failure to actor 212 and was discarded. The routing fix and remote full suite remain open; no test thresholds or actor stats changed.

Time-box handoff: a delayed sidestep after one second of body blockage shifted the remote failure to actor 360 and was discarded. Baseline tracing shows 360 encountering living infected 179 and 318 while pursuing an army target. Further work should address crowd routing and confirm the weapon change that alters this encounter. The remote L4 test still fails and remote full `npm test` has not passed; the restoration must not be merged as a completed fix. Local typecheck, lint, 106 unit tests and the full threat audit passed before these discarded experiments.

s198 follow-up: `git merge main` was attempted first but could not update the shared worktree metadata (`ORIG_HEAD.lock`, sandbox `Operation not permitted`); `main` is divergent and includes edits to the same AI movement/separation files, so integration remains required. The focused remote command could not start because no healthy remote runner is provisioned. A local diagnostic replay (not acceptance evidence) reproduced the two stopped actors as IDs 297 and 305 at ticks 4123–4424 and 4173–4474, respectively, just outside the open west breach at `(-36.64, 4.72)` and `(-36.54, 5.64)`, both still targeting the outer waypoint `(-34.9, 5.36)`. The final solid transaction repeatedly rejects actor 297 against living actor 281, then actor 305 against 297; both still have a connected nav path. This narrows the failure to crowd body-contact resolution at the entrance, rather than a missing route. Current pre-merge `npm run typecheck` and `npm run lint` pass. Root cause/fix, remote L4, remote full unit suite, post-merge gates including full threat audit, and commit remain open.

After sandbox access changed, main `a356dedf` merged successfully. The remote focused L4 replay ran and failed with the same actors 297 and 305 and positions as the local diagnostic. The routing fix and final gates remain open.

A further local trace at tick 4200 identifies actor 281 as an unstunned butcher on the inside breach waypoint; its resolved speed was 0.26 m/s. The queue therefore includes an actor actively seeking the entrance, rather than a pinned body. Temporary tracing was removed.

A trial steering around the previous living contact blocker shifted the local failure to actor 231, stopped within 0.6 m of a separate scripted waypoint near `(-34.67, 23.4)`. It was discarded; steering alone did not resolve all routing failures. The collapse director can replace a breach waypoint with a snapped soldier position, and the street-clearing controller can assign its own waypoint; identify the owner of this new stall before changing its arrival rule.

Tracing the trial at tick 3900 showed actor 231 had `breachApproach: vault`, with a vault staging point already inside the generic 0.6 m arrival band while west was open. Redirecting every pending vault approach to the open breach alongside the steering trial increased the local stopped count to 13 by concentrating traffic at the west mouth. Both changes were discarded. A fix needs to release stale vault staging without overwhelming the shared entrance.

A second local trial reduced the vault staging arrival band to 0.1 m while using the previous contact steering trial. It also produced 13 stopped actors, mainly at the west mouth, and was reverted. This does not establish a routing fix.

Removing the crowded-contact hold shortcut allows each rejected infected proposal to run the existing collision projection. Focused L4 passed remotely (193.9 s test; 201.1 s total) and locally (65.0 s total); pre-change local replay took about 47 s. Typecheck and lint pass on the cleaned-up change. The full remote suite and full threat audit remain required; the extra collision work is a performance risk.

Remote full `npm test` completed in 212.6 s: 104 passed, 1 skipped, 1 failed. L4 passed; the failure is the combat loadout assertion at `tests/engine/combat.test.ts:143`, which still expects 20% MG suppression removed by prior commit `73a3e8af`. This is a completed assertion failure, not a timeout. Full threat audit remains open.

After aligning the separate combat assertion with the already removed MG slow (damage and absence of slow checked), remote `npm test` passed: 105 passed, 1 skipped, 216.8 s. Full `npm run qa:threat` completed in 420.4 s with two fail flags: `L8/KITING_LANDED_HITS_BELOW_2:0.00` and `L10/step/hold:STUCK_CHASER_OVER_30_SECONDS`. Skilled L10 completed. The required zero-flag threat gate remains open; inspect the collision change against those scenarios.

Focused L8/L10 comparison with the original crowd hold cleared both scenario flags (partial-selection marker only), tying the two full-audit failures to changed collision behavior. A 60-rejection retry limit timed out the local L4 route and was discarded. Restoring the hold only for L1 pursuit brains passed remote L4 (153.6 s) and cleared L10, but L8 still failed its kiting hit floor and L1 crowds would retain the original stall; it was discarded. Main advanced to `6dbf06ad` during these diagnostics and needs integration before final gates.

Merged main `6dbf06ad`. A general retry window after 1.5 s without 0.2 m movement, retaining the old crowd hold otherwise, caused the local L4 completion route to time out and was discarded. The committed broad projection change still has the two threat flags; a general solution remains open.

A general trial projecting every other crowded collision retry left two local L4 actors stalled (249 at a staging point and 343 near the west mouth); it was discarded. The broad every-tick projection is still the only remotely passing candidate, with its L8 and L10 threat regressions unresolved.

A target-distance trial retained the old contact hold within 6 m of the current target and used full projection farther away. Local L4 passed and focused L10 cleared, but focused L8 had both zero kiting hits and follower wait over 10%. It also retained the hold for close crowd stalls, so the trial was discarded.

A collision trial preserved the clear portion of a rejected infected stride before projecting the remainder. Local L4 passed, but focused L8 and L10 retained the same kiting and stuck-chaser flags; it was discarded.

Focused L10 tracing identified flagged actor 115 as the Mega Alpha at the console: it repeatedly telegraphed ground slam and charge near the elevated courier; at tick 68100 its active charge was blocked by actor 99. The observer flags the 30-second stationary chase interval despite these special attempts because no attack landed on the courier. Temporary tracing was removed.

L8 kiting trace on the broad projection candidate: by tick 10500 the courier was at (-12.0, 3.9); actors 464 and 466 were chasing her while mutually blocking, and several other infected were attracted or chasing another target. By tick 10800 no living infected were within 30 m of the retreating courier. This explains the empty second half of the sample but does not yet isolate whether contact resolution, targeting, or player fire caused the loss of pressure. Temporary trace removed.
