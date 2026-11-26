# s243 L10 ride

Merged lane/s237-l10ride. Replaced the timed partial-cohort opening condition with a check that every authored slot is admitted and dead, and that the courier dismounted within 30 m after a mounted approach. Survivors carried across a checkpoint keep the gate closed. Typecheck passed.

This is incomplete: encounter updates run every 10 ticks, so zero delay after the last death is not yet guaranteed. Gate coverage, cohort reachability, strict HIGH and LOW routes, threat audit, captures, lint, level tests, and remote unit validation remain open. The s237 strict receipt recorded 1/4 on each tier and does not validate this change.

## Current investigation

The clearance check now runs on each encounter update; its actual delay from the last death still needs measurement against simulation phase ordering. The underpass wall now spans z=45–145 on spawn and restore, covering the authored z=74 rim route (previously the wall began at z=78). Physical coverage and captures remain unverified.

The [strict receipt](route-strict.json), recorded before widening the underpass wall, reports 0/4 loops on HIGH and LOW; both reached the 2100 s budget with 32 deaths. Both repeatedly fought at quarantine with living cohort members while the pursuing Mega reached the player. This identifies the first gate as the immediate obstacle; the trace does not establish why those members remain alive or whether they are reachable. No completion or zero-delay claim follows from this run.

Typecheck passed after the per-tick change. Lint failed on an unrelated pre-existing `no-explicit-any` error in `tools/qa/diag/l8-plaza-reach.ts:4`. The remaining checks and captures above are still open.

## Quarantine actor trace

A HIGH replay with slot positions added to the existing observer again reached 2100 s and 32 deaths. At 2010 s the live hazmat was at (2988, 115), while two live runner IDs in the quarantine ledger were around (2930–2940, −3–−1), over 100 m from the courier at (3003, 86). Those runners were in `attracted` state; the hazmat remained near (2988, 115) across several samples in `chase`. The same runner slot IDs appeared dead and then alive after a retry. The checkpoint restore and actor identity/ledger interaction needs investigation before treating these distant actors as cohort survivors or changing their behavior. The observer now records position and state to support that diagnosis. This replay is diagnostic and does not establish 4/4 or reachability.

## Cohort pursuit and staging trial

Closed-gate cohorts now receive the existing pursuit pressure even when they fall behind the courier; the former 24 m cutoff left them attracted far away. Roadblock cohorts stage on the opposite flank, away from the quarantine tower where the hazmat remained stationary. The first pressure-only HIGH trial still timed out at 2100 s with 31 deaths and 0/4 loops. With both changes, [HIGH](route-high-trial.json) recorded 2/4 loops but timed out at 2100 s with 43 deaths; [LOW](route-low-trial.json) completed in 1674 s with 17 deaths and 3/4 loops, missing hospital. These are incomplete trial results, not acceptance. Typecheck passed.

HIGH subsequently retried the convoy after its earlier recorded crossing; living dog and firefighter actors were around (3187, 41–45), while the player repeatedly died near the gate. Checkpoint slot identity and survivor handling need further investigation. Hospital loop, same-tick opening, gate coverage, threat audit, captures and remaining validation remain open.

## Checkpoint cohort reconciliation

A retry could restore an older live copy of an already encountered slot and discard the carried survivor when the checkpoint already contained that slot. A second death could also discard survivors still waiting for readmission. The reconciliation now retires each encountered slot, removes the older live checkpoint copy, and retains waiting survivors for readmission. Dead bodies are not removed by this reconciliation.

The [diagnostic replay](route-restore-trial.json) before the final dead-body guard recorded HIGH 4/4 and completion in 1579 s with 16 deaths; LOW recorded 3/4 (underpass missing) and timed out at 2100 s with 8 deaths. The final guard was added afterward to preserve dead figures, so neither result is a current-source acceptance receipt. Typecheck passed before that guard and targeted lint passed. Full rule verification, LOW, threat, captures and required validation remain open.

## Streaming and clearance correction

Chunk residency can remove a living infected from the entity store; the former `?? 0` clearance check therefore treated a sleeping survivor as dead. Closed-gate living or recoverable cohort members now remain in active simulation, and an absent member no longer counts as dead. The death ledger also inspects sleeping records. Dead slots are retired while their bodies remain in the world, so later corpse streaming cannot prevent clearance. This needs further validation of navigation and checkpoint behavior, including existing saves with sleeping members.

The [streaming trial](route-stream-trial.json), before the final dead-slot retirement adjustment, reached 0/4 on both tiers; each timed out at 2100 s with 33 deaths. HIGH's final quarantine trace showed a living runner and a closed gate. This supersedes the earlier optimistic result as evidence of current progress; it is not a receipt for the final adjustment. Typecheck and targeted lint passed after the adjustment. Full routes, reachability, threat, captures and remaining required checks remain open.

## Current-source replay

The [current-source receipt](route-current.json) at `9a540dda` records 0/4 strict loops on both tiers, both at the 2100 s budget with 33 deaths. It confirms the earlier streaming trial after the dead-slot adjustment. Quarantine remains closed. On HIGH, runner slots that had been observed dead appeared alive again in later samples following retries; LOW showed the same pattern, and the hazmat was seen far from the gate. The existing survivor re-admission also restores full health. Checkpoint ledger identity and pending survivors therefore remain unresolved; the trace alone does not establish the exact cause of each revival. The alive-member reachability and zero-delay requirements remain unproven, and earlier 4/4 results were generated under the unsound missing-entity clearance rule.

## Recoverable knockdown diagnosis

A LOW diagnostic recorded the quarantine cohort at three consecutive player deaths: all four actors had 0 HP **and future recovery ticks** (at tick 49751, recoveries ranged from 50235 to 50518). They were recoverable knockdowns, so their subsequent return to full health was not proof of a ledger identity error. The bot had selected ordinary firearms and excluded downed actors from targets; the issued flamethrower applies permanent damage. The bot now uses that weapon against nearby visible roadblock threats and can target nearby visible recoverable actors, through ordinary inputs.

The [flamethrower trial](route-flame-trial.json) recorded 0/4 on both tiers, with HIGH timing out at 2100 s and 29 deaths and LOW at 2100 s and 20 deaths. HIGH reached the finale with all four gates open; LOW remained at the convoy. Continuous remount loops, native completion, reachability, zero-delay proof, threat and captures remain open. Typecheck and targeted lint passed. The existing QA observer now records recovery timers at player deaths.

## Fire avoidance and observer correction

In the flamethrower trial, the last recorded damage before death was `hazard.fire` for 5/29 HIGH deaths and 9/20 LOW deaths. The bot now moves out of nearby active ground fire using ordinary movement and the existing navigation visibility check. The [trial receipt](route-fire-avoid-trial.json) reported HIGH 2/4, 25 deaths and LOW 1/4, 7 deaths; both exhausted 2100 s, with no `hazard.fire` final hit in either tier. HIGH stopped at underpass with a living crawler around (3324, 91), and LOW at convoy with recoverable actors. Typecheck and targeted lint passed.

Inspection of that receipt found that HIGH quarantine recorded its fight and gate opening on the same tick after a retry. The observer accepted an already-open gate as a new opening whenever it first saw a fight; it now requires an observed closed-to-open transition. Thus the trial's 2/4 and 1/4 counts use the earlier, weaker observer, and cannot establish strict acceptance. A new HIGH/LOW run is required. Reachability, completion, zero-delay proof, threat, captures and full checks remain open.

## Corrected transition receipt and clearance timing

The [corrected observer receipt](route-transition.json) at `0dad4af7` records HIGH 1/4 (convoy) and LOW 1/4 (quarantine); both hit 2100 s, with 25 and 7 deaths respectively. It predates the timing change below and is not a current-source acceptance receipt.

Fire hazards update at simulation phase 5, after the encounter's phase 4.9 update. A permanent kill there could leave the gate closed for one tick. The encounter now rechecks clearance synchronously on a permanent cohort `combat.kill`, in addition to its normal update. This removes that ordering gap for emitted kill events; measured zero delay and coverage of all death paths remain open.

Typecheck and targeted lint passed. The existing L10 camera and save progression tests passed 9/9 after updating the cold-resume expectation from the old 17 m underpass half-width to 50 m, which covers the rim. Full route, threat audit, captures and remaining validation are open.

## Convoy recovery diagnosis and approach trial

The corrected LOW trace showed four convoy members at 0 HP for many minutes. A diagnostic recorded them active, not held, and with the director's recovery cap disabled. Their recovery deadlines moved because they stood up and were knocked down again: in the 1100 s diagnostic, 28 recorded convoy knockdowns came from the bot's assault rifle, versus one permanent flamethrower kill. This is the normal infected recovery behavior, not proof of sleeping or an identity error.

A trial made the bot move toward visible roadblock threats to reach flamethrower range. The [trial receipt](route-close-trial.json) recorded HIGH 1/4 and LOW 0/4, both at 2100 s and 12 deaths. The preceding corrected observer recorded 1/4 on each tier. The movement trial was reverted; this receipt is not current-source acceptance. The observer retains recovery, active-membership and director diagnostics. Targeted lint passed. The roadblock fights, full routes, zero-delay measurement, threat, captures and required checks remain open.

## Final-kill timing fixture

The focused roadblock fixture (now in `tests/engine/save-progression.test.ts`) passes for all four roadblocks on HIGH and LOW. Using production damage calls, it verifies that a recoverable knockdown, another living member, and an unadmitted slot each keep the gate closed; the final permanent explosive kill opens it and removes its wall without advancing the simulation tick. The killed actor remains present. Typecheck and targeted lint passed. This fixture sets the mounted/dismounted state and uses retired slots as setup; it does not prove native reachability, all death paths, or the 4/4 route. The strict route, threat audit, captures, and other required checks remain open.

## Current L10 threat diagnostic

At `71391434`, `node --import tsx/esm tools/qa/threat-audit.ts --levels L10 --maxWorkers 2 --out /tmp/s243-threat` completed in 156 s. The [L10 receipt](threat-l10-diagnostic.json) reports one passive flag, `UNOBSERVED_PASSIVE_CRITERION_STEP:hold`. Skilled reports `INCOMPLETE_NATIVE_POLICY:tick-budget` and `UNOBSERVED_THREAT_STEP:hold`. Both policies reached the 1800 s limit at the convoy near (3254, 90); skilled had seven deaths and passive had none. This partial selection also carries the audit's `PARTIAL_LEVEL_SELECTION` flag, so it is diagnostic only. The L10 zero-flag objective and full audit remain open.

## Closed and open camera captures

A staged headless browser-pool fixture captured HIGH first, then LOW, with the game follow camera at zoom 1. The [sheet](roadblocks.jpg) pairs closed and forcibly opened states: HIGH frames 0–7 and LOW frames 8–15, in quarantine, convoy, underpass, hospital order. The fixture teleports the courier and directly opens each gate after recording the closed state; it does not exercise the native fight or opening rule. It observed a closed wall at each gate with `halfX=0.2`, `halfZ=50`, and center z=95. The actual spawned wall's `halfY` was 0.7: the spawn installs that wall before the later `block` call requesting 1.2, and the latter call returns when a blocker already exists.

The quarantine pairs show a road, the courier and an edge of signage; convoy and hospital pairs mostly show road and the courier; the underpass pairs show the dark rim and a long rail. The open and closed gate states are not clearly distinguishable in these camera frames. The captures do not prove that a bike cannot bypass any gate; route collision, gate readability and native HIGH/LOW proof remain open. Reproduce the staged images with `SCENE_PORT=5294 E2E_PORT=5293 npx tsx tools/qa/s243-l10roadblock-captures.ts`. Targeted lint passed for the capture script.

## Motorbike collision samples

The [motorbike collision fixture](gate-collision.json) used production L10 encounter gate spawning and actual bike movement, HIGH then LOW. From 8 m west of each closed gate, the bike stopped about 1.08 m before its x coordinate at z=95 for quarantine, convoy and hospital, and z=74 for the underpass rim. After directly opening the gate and resetting the bike, it crossed each sampled lane on both tiers. The fixture is reproducible with `node --import tsx/esm tools/qa/s243-gate-collision.ts`.

The same staged test crossed every closed gate at z=0, 40 and 150, outside the wall's z=45–145 span. Those tests place the bike directly at each offset; they do not establish a continuous path from the road around the wall or whether every offset is part of the passable road. Full bypass coverage remains open. Typecheck and targeted lint passed. This fixture does not prove the combat opening rule or native ride loops.

## Closed-gate detour and district-width wall

A continuous staged motorbike route started 25 m west of each gate on the road, rode to z=40, then east without teleporting across the barrier. With the old 50 m half-width, the bike passed the closed convoy, underpass and hospital gates on HIGH and LOW in 673 ticks; the quarantine attempt stopped at scenery before reaching the detour. The [collision receipt](gate-detour.json) repeats that old-width fixture and the new wall in the same world. The actual gate now spans the authored district z bounds on spawn and restore (`halfZ=396`, centered at z=95). With the new wall the same three detours stopped west of the gates on both tiers; direct closed samples at z=0, 40, 74/95 and 150 stopped, and directly opened samples crossed. The quarantine detour remains limited by scenery in this fixture. This uses a long collision wall and its camera presentation remains hard to read; it needs native play review.

The [strict route trial](route-wide-trial.json) with the new wall recorded 0/4 on HIGH and LOW, both at the 2100 s limit, with 11 and 12 deaths. Both stopped at convoy with recoverable cohort members; route completion and L10 threat remain unmet. Typecheck, targeted lint, and the L10 roadblock, camera and save progression test files passed (10 tests). The earlier threat diagnostic and camera captures predate the widened wall. Full audit, native captures, remote unit and other required checks remain open.


## Unit and lint validation

The first remote run stopped before execution because the new standalone test raised the file budget to 46/45. The roadblock test was moved into the existing save progression file; the L8 plaza diagnostic's pre-existing explicit `any` was replaced with its inferred type to clear lint. Full lint and typecheck passed; the two focused L10/save files passed 10/10 locally.

The next remote unit run admitted 149/150 cases and 45/45 files but timed out at 245.5 s against the 240 s budget. An unchanged retry completed: 27 files passed, 105 tests passed and one skipped, 239.0 s, exit 0. This validates the unit gate on the current implementation, not native 4/4 loops, threat, or the visual/collision findings.

## Permanent-kill weapon trial

The bot now uses the issued rocket launcher against visible roadblock threats at 14 m or more when the line is clear, and can target visible recoverable bodies. It also requires the pursuing Mega to be at least 16 m away before selecting the launcher. No infected stats were changed. The [guarded strict receipt](route-rocket-guard.json) records LOW **4/4**, native completion in 1228 s and 6 deaths; HIGH **2/4** (convoy and hospital), 2100 s tick-budget in the finale and 21 deaths. The rocket proximity check passed on both tiers (nearest recorded Mega distances 16.15 m HIGH and 17.81 m LOW; zero close blasts). HIGH missed quarantine and underpass after deaths. LOW hangar-to-gate was 279.93 s and HIGH 535.73 s; observed beat timing is in the receipt and was not tuned.

The [focused L10 threat receipt](threat-rocket-diagnostic.json) reports skilled complete with no skilled flags, but one passive flag `step/hold:BELOW_REACHABILITY_PERCENT_90`: the final sample was 8/9 reachable, with the blocked actor at (3984.74, −11.76), near a dispersal tank. This partial audit is not the full `qa:threat` gate. Typecheck and targeted lint passed. HIGH 4/4 and completion, navigation/reachability, the current-source remote unit run, fresh gate captures and full threat audit remain open.

## Service-wave tank pocket

The [before receipt](threat-tank-before.json) identifies the 8/9 hold sample's blocked actor as a butcher admitted at tick 68353 by `dispersal-assault:service:42:15` at (3984.99, −11.61), inside the existing dispersal tank's authored footprint. It was physically clear and nav-clear at its position, but an independent path search found no connection to the console; a controlled check also failed for both 0.6 m and 0.35 m radii. This was a real service-wave spawn candidate, not the Mega. Threat diagnostics now record the spawn and geometry details without changing reachability classification.

Service-wave fallback candidates now reject overlap with the existing tank collider footprints expanded by the actor's ordinary radius, preventing admission into this enclosed island. The [after receipt](threat-tank-after.json) reports skilled complete, no L10 skilled or passive flags, and 8/8 reachable in the final 64.27 s hold sample, with 104.56 attacks/min. The overall command still exits nonzero for `PARTIAL_LEVEL_SELECTION`; this is an L10 diagnostic, not the full all-level audit. Typecheck, targeted lint and three relevant regression files passed (15 tests). These receipts use the unchanged guarded rocket bot; the new spawn filter applies during the finale. Current-source HIGH 4/4 and route completion, fresh LOW route verification, all-level threat audit, captures and remote unit validation remain open.

## Corrected position trace and HIGH retry

The previous route trace retained live transform objects instead of copying them, so its historical gate and cohort positions were unreliable. The observer now copies those positions and records when an alive actor is first observed beyond a closed gate. The [corrected HIGH receipt](route-position-diagnostic.json), on the service-wave tank fix, records quarantine and underpass incomplete, convoy and hospital complete (2/4), with 33 deaths and a 2100 s finale timeout. At 690 s the quarantine cohort was west of the closed wall; the earlier apparent crossing was a mutable-reference artifact. The two recorded actors east of the closed hospital gate were separately scripted tent-stage figures, not slots in the gate's required encounter cohort. This diagnostic does not establish that every cohort member remains reachable.

A separate ordinary-input trial prioritized a nearby Mega and backed away with a shotgun: HIGH remained 2/4 and timed out at 2100 s with 12 deaths; LOW completed 4/4 in 1235 s with six deaths. The trial was reverted because it did not improve the HIGH acceptance result. HIGH deaths interrupt the quarantine and underpass attempts, and the open gate on a later retry does not satisfy the strict closed-to-open loop. The underlying combat and retry behavior still needs resolution; current-source LOW completion, whole-route reachability, maximum gate delay, fresh captures, full threat audit and remote unit run remain unverified.

## Admitted-cohort clearance rule

The gate previously treated an unfilled authored spawn slot as a living member, contrary to the admitted-cohort rule. Clearance now ignores slots never admitted, still waits for carried retry survivors and recoverable or living admitted members, and stops admitting that roadblock's remaining slots after its gate opens. The updated fixture passes for all four roadblocks on both tiers: a recoverable or living admitted actor holds the gate, and the final permanent kill opens it in the same tick even with an unfilled slot. This is a focused fixture, not proof of all native death and reachability paths.

| Tier | Strict loops | Native route | Deaths | Receipt |
|---|---:|---|---:|---|
| HIGH | 2/4 | 2100 s timeout at Mega | 33 | [route](route-admitted.json) |
| LOW | 4/4 | complete in 1234.63 s | 6 | [route](route-admitted.json) |

The HIGH quarantine and underpass attempts remain interrupted by deaths. The focused [L10 threat receipt](threat-admitted.json) reports skilled completion, zero L10 skilled or passive flags, and 8/8 reachable at the last hold sample; the command exits 1 for `PARTIAL_LEVEL_SELECTION`, so full `qa:threat` is not established. Typecheck, full lint, save/progression (7 tests) and L10 camera (3 tests) passed. The current-source remote unit run passed: 27 files, 105 tests passed and one skipped, 236.4 s against the 240 s budget. Full audit, native captures and whole-route reachability and gate-delay proof remain open.

## Closer roadblock approach and transition timeline

The strict observer now records each loop-state transition and death reset. In the preceding HIGH receipt, quarantine's courier dismounted 24 m west, fought, and was killed by the pursuing Mega before the gate cleared; underpass cleared and the courier remounted 23 m west but died before crossing. The bot now approaches within 6 m before choosing to dismount while still recognizing a closed gate within 24 m for combat and recovery. This uses ordinary controls and the same policy on both tiers.

| Tier | Strict loops | Native route | Deaths | Receipt |
|---|---:|---|---:|---|
| HIGH | 4/4 | complete in 1566 s | 16 | [route](route-close-approach.json) |
| LOW | 3/4 | complete in 1400 s | 10 | [route](route-close-approach.json) |

LOW's underpass first attempt ended in death before opening; on retry it opened at tick 60480 but the courier remained near the parked bike and died before remounting. The next retry had an already-open gate and does not satisfy the strict closed-to-open loop. A trial applying the passive policy's closer corpse-aware bike recovery to skilled play timed out LOW at 2100 s with 17 deaths; its HIGH leg was stopped after that regression, and the change was reverted. An earlier trial that incorrectly used the 6 m distance for both dismount and fight recognition completed HIGH 4/4 in 1895 s but timed out LOW at convoy (1/4); the correction retains wider fight recognition.

The focused [L10 threat audit](threat-close-approach.json) reports skilled completion and zero L10 skilled and passive flags; its exit 1 is solely `PARTIAL_LEVEL_SELECTION`. Typecheck and targeted lint passed. The required LOW 4/4, full `qa:threat`, current-source remote unit run, native captures, and whole-route reachability and gate-delay proof remain open. The 420–540 s ride window and 45–75 s beat cadence are reported by the route receipt and were not tuned.

## Motorbike mount reach

The LOW underpass retry reached the open gate's parked upright bike but oscillated at 1.51–1.57 m from its center, outside the 1.5 m interaction range, until the pursuing Mega killed the courier. The game now permits upright motorbike interaction within 1.7 m, preserving the existing mounted-frame clearance and placement search. The bicycle's original range remains 1.5 m. An added vehicle regression checks motorbike interaction at 1.6 m and rejection at 1.8 m. The observer also records the underpass bike interaction state and movement input.

| Tier | Strict loops | Native route | Deaths | Receipt |
|---|---:|---|---:|---|
| HIGH | 4/4 | 2100 s timeout at Mega | 49 | [route](route-mount-margin.json) |
| LOW | 4/4 | complete in 1503.02 s | 8 | [route](route-mount-margin.json) |

A 1.6 m motorbike margin trial produced HIGH 4/4 with a 2100 s timeout and LOW 2/4 with a 2100 s timeout; the 1.7 m version above is retained. HIGH repeatedly dies in the finale after charge completion and its Mega health returns to the checkpoint state; this is not a skilled native completion. The [focused L10 threat receipt](threat-mount-margin.json) reports skilled completion and zero L10 flags; its only command-level failure is `PARTIAL_LEVEL_SELECTION`. Typecheck, targeted lint and the vehicle test file (2 tests) passed. Full threat audit, current-source remote unit, native captures, whole-route reachable-cohort proof and gate-delay measurement remain open. Ride and beat timing are in the receipt and were not tuned.
