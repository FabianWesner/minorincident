# s249 L10 finale assault

## Status

Not accepted. The focused infected AI test passes, but the required high story
run still fails the idle-entry check. No code-done commit was made.

## Evidence

- Baseline from the brief: high 49/51 (idle-entry and roadblock 3390), 3 deaths.
- Initial pressure-target change: high 49/51, 115 idle entries, 7 deaths.
- Broad L10 immediate chase: high 41/51, tick-budget at 2400 s, 3 deaths.
  It never reached the finale, so its zero idle entries do not establish a pass.
- Scoped finale chase: high 49/51, complete in 1514 s, 3 deaths, 50 idle entries. The idle-entry
  check still fails; sampled assault entrants are first seen at the service
  mouth moving about 0.013 m/s. Roadblock 3390 remains the other failure.
- `npx vitest run tests/engine/infected-ai.test.ts`: 1 file, 5 tests passed.

The high run used seed 0. Low tier, low seed 1, and `npm run qa:threat` were not
run because the high acceptance check remains failing.

Receipts: `/private/tmp/s249-l10-high.json`, `/private/tmp/s249-l10-high-v2.json`,
and `/private/tmp/s249-l10-high-v3.json`, respectively. The uncommitted scoped
change is experimental and does not satisfy acceptance.

## s249b continuation

- WIP committed as `3de46811` before further investigation.
- Low seed 0: 37/51, tick budget at 2400 s, 41 deaths, stopped near x=2966 before the finale. Receipt `/private/tmp/s249b-low0.json`. This is a serious regression in the observed run; its cause has not been isolated.
- Low seed 1: 50/51, complete in 1189 s, 3 deaths; two idle entries, both dogs near (3978,-24) and (3982,-23). Receipt `/private/tmp/s249b-low1.json`.
- `npm run qa:threat`: 0 fail flags; L10 skilled complete, passive tick-budget with 0 passive flags.
- The replay probe `tools/qa/diag/s249-finale.ts` did not reproduce sustained creep. One separately sampled L1 entrant switched to search for a stale position near x=2462; this does not establish the cause of the reported clusters. Trace receipts are `/private/tmp/s249-diag*.jsonl`.

The WIP is not ready to merge. The requested three-cluster trace, root-cause fix and passing acceptance remain outstanding.

## Residency fix

Full story instrumentation showed actor 719 present at tick 74900 and absent
until tick 75643, when it returned at the same position with its first motion
step of 0.0133 m/s. Actor 754 similarly disappeared between ticks 75440 and
79513. The excess-cap trim slept admitted assault members to satisfy the
reservation for that same cohort. Resident assault members are now excluded
from that trim; ordinary chunk unloading and population caps remain in effect.
The story trace is `/private/tmp/s249-story-trace.jsonl`.

- High seed 0: 50/51, 5 deaths, idle check passes; only the baseline roadblock 3390 check fails. Receipt `/private/tmp/s249b-high-fix.json`.
- Low seed 1: 51/51, 3 deaths, idle check passes. Receipt `/private/tmp/s249b-low1-fix.json`.
- Low seed 0: 37/51, 41 deaths, tick budget before the finale; the parent commit produces the same result. Receipts `/private/tmp/s249b-low0-fix.json` and `/private/tmp/s249b-baseline-low0.json`. The idle check cannot be validated for this seed.
- Focused infected AI suite: 5/5; typecheck passes.
- `qa:threat`: 0 fail flags; L10 skilled complete, passive tick-budget, 0 passive flags.

The low seed 0 pre-finale stall remains an open acceptance limitation. The
position-based diagnostic in `tools/qa/diag/s249-finale.ts` did not reproduce
the story trace and is exploratory.
