# Playtest driver options

`npm run playtest -- ...` runs the headless real input driver. Existing callers keep the standard campaign behavior.

| Option | Default | Effect |
| --- | --- | --- |
| `--quality low\|high` | `low` | Requested render tier; reapplied and checked after each level or save load. |
| `--zoom 1\|1.5` | `1.5` | Requested play zoom. QA captures include zoom 1 and 1.5. |
| `--scream-captures` | off | Captures scream noise and Alpha roar telegraphs per active mission world; writes event/level/tick metadata to the session log. |
| `--route-only` | off | Disables combat for route diagnostics. Output labels this acceptance mode. |
| `--immortal` | off | Enables god mode and labels output `IMMORTAL / ROUTE ONLY`; use only for route diagnostics. |
| `--levels L6-L10` | `L1-L10` | Select levels; scream capture covers screamer missions L6/L9/L10 and Alpha roars in L6/L7 when events occur. |

The L9 `Hold the hatch` objective allows attacks on rendered infected while the player is seated in the APC. Rendered APC passengers remain eligible as visible boarders for escort observation. Standard combat and acceptance behavior are unchanged unless the route-only or immortal option is selected.
