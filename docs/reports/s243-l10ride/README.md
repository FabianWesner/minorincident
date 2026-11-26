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
