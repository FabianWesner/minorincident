# s238: L2 Engine 3 boarding

## Implementation

- Kept the authored Engine 3 roof visible during the L2 ride; the crew no longer triggers the seated-passenger roof cutaway.
- Added a deterministic boarding sequence for the courier and firefighters, with the existing walk and sit-down clips staggered by seat order. The truck waits until living riders are aboard.
- The companion follows a deterministic path to the truck and boards last. Arrival uses the existing dismount/stand-up behavior and staggered crew exits.
- Expanded the existing L2 mission-interactions test; no test case was added.
- Added `tools/qa/s238-l2truck-capture.ts` to record approach, three boarding moments, ride, and arrival at HIGH/LOW and zoom 1/1.5.

## Checks

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx vitest run --project nightly --maxWorkers=1 --configLoader runner tests/nightly/mission-interactions.test.ts` — passed (1 test).
- `MI_LOCAL_FALLBACK=1 npm test` — passed (105 tests, 27 files; budget wrapper reports 148/150 cases).
- `sh tools/remote/run.sh "$PWD" -- npm test` — unavailable earlier in this run because no healthy remote runner was available.
- `node --import tsx/esm tools/qa/threat-audit.ts` — passed after the companion follow-up (816.6 s, 0 fail flags).

## Visual capture status

The capture helper is ready, but this report does not contain screenshots. Running it through the required headless browser lock failed with exit 75 because the browser pool could not bind `127.0.0.1:4329` (`listen EPERM`). The host GPU admission script also failed to inspect processes with `EPERM`; no lock or host guard was bypassed. The required HIGH/LOW approach, boarding, ride, and arrival frames therefore have not been opened or visually reviewed.

## Open

1. Restore browser-pool admission, run the capture helper, open and inspect every required frame, and add the captures plus their index here.
2. Commit the pending companion follow-up and report after Git can write the shared worktree index. This session received `Operation not permitted` creating `.git/worktrees/s238-l2truck/index.lock`.
