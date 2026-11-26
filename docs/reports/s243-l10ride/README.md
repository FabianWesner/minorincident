# s243 L10 ride

Merged lane/s237-l10ride. Replaced the timed partial-cohort opening condition with a check that every authored slot is admitted and dead, and that the courier dismounted within 30 m after a mounted approach. Survivors carried across a checkpoint keep the gate closed. Typecheck passed.

This is incomplete: encounter updates run every 10 ticks, so zero delay after the last death is not yet guaranteed. Gate coverage, cohort reachability, strict HIGH and LOW routes, threat audit, captures, lint, level tests, and remote unit validation remain open. The s237 strict receipt recorded 1/4 on each tier and does not validate this change.

## Current investigation

The clearance check now runs on each encounter update; its actual delay from the last death still needs measurement against simulation phase ordering. The underpass wall now spans z=45–145 on spawn and restore, covering the authored z=74 rim route (previously the wall began at z=78). Physical coverage and captures remain unverified.

The [strict receipt](route-strict.json), recorded before widening the underpass wall, reports 0/4 loops on HIGH and LOW; both reached the 2100 s budget with 32 deaths. Both repeatedly fought at quarantine with living cohort members while the pursuing Mega reached the player. This identifies the first gate as the immediate obstacle; the trace does not establish why those members remain alive or whether they are reachable. No completion or zero-delay claim follows from this run.

Typecheck passed after the per-tick change. Lint failed on an unrelated pre-existing `no-explicit-any` error in `tools/qa/diag/l8-plaza-reach.ts:4`. The remaining checks and captures above are still open.

## Quarantine actor trace

A HIGH replay with slot positions added to the existing observer again reached 2100 s and 32 deaths. At 2010 s the live hazmat was at (2988, 115), while two live runner IDs in the quarantine ledger were around (2930–2940, −3–−1), over 100 m from the courier at (3003, 86). Those runners were in `attracted` state; the hazmat remained near (2988, 115) across several samples in `chase`. The same runner slot IDs appeared dead and then alive after a retry. The checkpoint restore and actor identity/ledger interaction needs investigation before treating these distant actors as cohort survivors or changing their behavior. The observer now records position and state to support that diagnosis. This replay is diagnostic and does not establish 4/4 or reachability.
