# Playtest driver options

`npm run playtest -- ...` runs the headless real input driver. Existing callers keep the standard campaign behavior.

| Option | Default | Effect |
| --- | --- | --- |
| `--quality low\|high` | `low` | Requested render tier; reapplied and checked after each level or save load. |
| `--zoom 1\|1.5` | `1.5` | Requested play zoom. |
| `--capture-zooms 1,1.5` | existing capture defaults | Override acceptance/threat capture zooms. |
| `--scream-captures` | off | Captures scream noise and Alpha roar telegraphs per active mission world; writes event/level/tick metadata to the session log. |
| `--route-only` | off | Disables combat for route diagnostics. Output labels this acceptance mode. |
| `--immortal` | off | Enables god mode and labels output `IMMORTAL / ROUTE ONLY`; use only for route diagnostics. |
| `--levels L6-L10` | `L1-L10` | Select levels; scream capture covers screamer missions L6/L9/L10 and Alpha roars in L6/L7 when events occur. |

The L9 `Hold the hatch` objective allows attacks on rendered infected while the player is seated in the APC. Rendered infected attached to the APC remain eligible as targets despite the hull blocking ground visibility. Standard combat and acceptance behavior are unchanged unless the route-only or immortal option is selected.

The L9 driver follows the live bridge objective after evacuation and uses physical reverse/steer input when the APC revisits the same approach without closing on its target. L10 travel backs away from nearby crowds at low health and heads for a nearby visible medkit when one is available. An empty opening objective HUD does not accrue stall time. Reaching the configured per-level time cap is recorded as a P3 `sample-cap` and ends the sample without a `cannot-finish` P0.

During L10 travel the driver also approaches visible unowned guns and visible medkits when nearby enemies leave room to collect them. These pickups use ordinary movement input.

For long mortal L10 runs, `--session-seconds 480` saves the live production Resume snapshot through pause/settings before releasing each browser reservation. The next segment resumes through the normal menu. Segment logs remain separate and must be considered together for full-run evidence.

L10 travel cover keeps movement on the player navigation route toward the live objective while aiming ordinary attacks at close pursuers, to avoid unbounded retreat into the corn rows.

A logged farmhouse map detour seeks the authored hunting rifle while travelling through the farms without a firearm. Recovered hunting/assault rifles and nail guns are eligible for carried-weapon selection; empty weapons still fall back normally.

`enemy-unhittable` warnings require eight recent unique resolved melee queries that include the named target and no positive target damage. Logs retain attack IDs, query IDs, hit IDs and damage under `unchangedHpDiagnostic`; elapsed observation time or ranged misses alone remain diagnostic.
