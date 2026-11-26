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

The focused `tests/engine/l10-roadblocks.test.ts` fixture passes for all four roadblocks on HIGH and LOW. Using production damage calls, it verifies that a recoverable knockdown, another living member, and an unadmitted slot each keep the gate closed; the final permanent explosive kill opens it and removes its wall without advancing the simulation tick. The killed actor remains present. Typecheck and targeted lint passed. This fixture sets the mounted/dismounted state and uses retired slots as setup; it does not prove native reachability, all death paths, or the 4/4 route. The strict route, threat audit, captures, and other required checks remain open.

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
