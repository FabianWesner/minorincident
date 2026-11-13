# s99 — L6 typical survivor pressure

## Change

First and second shelter breach cohorts now enter from the corridor side of their maintenance doors. The previous 20 m placement put arrivals among the seated shelter crowd. Recurring group pressure uses four infected per cohort at 20 s, preserving the existing minimum pressure rate of two infected per ten seconds. No zombie or weapon stats, bot policies, or probe thresholds changed.

`tools/qa/l6-pressure.ts` records each survivor’s first lost status, phase, tick, position, and preceding infected attack events. A turn records infection conversion; a death records health loss. The event stream does not consistently identify a bite for these conversions, so the ledger records the observed outcome rather than assigning an unobserved individual biter.

## Before and after

| Run | Completion | Player deaths | Survivors out | Saved share |
|---|---:|---:|---:|---:|
| Before typical seed 1 | Yes | 11 | 8/29 | 27.6% |
| Before typical seed 2 | Yes | 3 | 7/29 | 24.1% |
| Before typical seed 3 | Yes | 5 | 4/29 | 13.8% |
| After typical seed 1 | Yes | 0 | 21/29 | 72.4% |
| After typical seed 2 | Yes | 0 | 10/29 | 34.5% |
| After typical seed 3 | Yes | 0 | 20/29 | 69.0% |
| **Before mean** | **Yes** | **6.3** | **—** | **21.8%** |
| **After mean** | **Yes** | **0.0** | **17.0/29** | **58.6%** |

Typical HIGH seeds 1–3 pass the requested thresholds: all complete, mean deaths ≤3, mean saved ≥40%, and minimum saved ≥25%.

## Complete-policy attack windows

A full window is 1,800 ticks (30 seconds), beginning at the first closed hatch. Partial tails are shown separately and are not gated.

| Seed | Full post-closure windows: attack starts | Final partial window |
|---:|---|---:|
| 1 | 4, 13, 13 | 0 |
| 2 | 3, 3, 4 | 1 |
| 3 | 8, 4, 18 | 1 |

Every full window in all three complete runs has at least two group attack starts.

## Typical survivor loss ledger

Each row is the first tick when the probe observed `dead` or `turned`. `turned` means the outbreak conversion lifecycle completed; `dead` means the survivor reached zero health. Positions are in level metres.

| Seed | Survivor | Cause | Phase | Tick | Seconds | X | Z |
|---:|---|---|---|---:|---:|---:|---:|
| 1 | shelter-7 | infection conversion | first | 2129 | 35.5 | 8.3 | -10.9 |
| 1 | shelter-1 | infection conversion | fails | 3489 | 58.1 | -9.1 | -8.0 |
| 1 | shelter-14 | infection conversion | retreat | 3720 | 62.0 | 5.2 | -8.1 |
| 1 | shelter-20 | infection conversion | retreat | 4316 | 71.9 | 21.9 | 8.0 |
| 1 | mia | infection conversion | retreat | 5392 | 89.9 | 33.8 | 15.1 |
| 1 | okafor | infection conversion | retreat | 7109 | 118.5 | 92.9 | 15.4 |
| 1 | shelter-10 | death | retreat | 10543 | 175.7 | 223.3 | 14.7 |
| 1 | shelter-4 | death | retreat | 10740 | 179.0 | 225.1 | 15.0 |
| 2 | shelter-7 | infection conversion | first | 2533 | 42.2 | 8.5 | -11.0 |
| 2 | shelter-1 | infection conversion | first | 2548 | 42.5 | -6.1 | -10.2 |
| 2 | shelter-9 | infection conversion | first | 2858 | 47.6 | -5.7 | -8.5 |
| 2 | shelter-20 | infection conversion | retreat | 4412 | 73.5 | 21.9 | 8.0 |
| 2 | shelter-10 | infection conversion | retreat | 4475 | 74.6 | 19.5 | 8.2 |
| 2 | shelter-15 | infection conversion | retreat | 4541 | 75.7 | 19.3 | 5.9 |
| 2 | shelter-5 | infection conversion | retreat | 4617 | 77.0 | 17.1 | 5.6 |
| 2 | shelter-4 | infection conversion | retreat | 4726 | 78.8 | 11.4 | 9.3 |
| 2 | shelter-17 | infection conversion | retreat | 6697 | 111.6 | 78.9 | 15.8 |
| 2 | shelter-3 | infection conversion | retreat | 6773 | 112.9 | 84.8 | 12.9 |
| 2 | shelter-23 | infection conversion | retreat | 6902 | 115.0 | 86.9 | 15.8 |
| 2 | shelter-21 | infection conversion | retreat | 6907 | 115.1 | 89.3 | 14.2 |
| 2 | okafor | infection conversion | retreat | 6992 | 116.5 | 89.3 | 15.8 |
| 2 | dale | infection conversion | retreat | 8413 | 140.2 | 139.8 | 14.5 |
| 2 | shelter-2 | infection conversion | retreat | 8685 | 144.8 | 149.8 | 15.7 |
| 2 | mia | death | retreat | 8800 | 146.7 | 155.1 | 14.1 |
| 2 | shelter-14 | death | retreat | 10533 | 175.6 | 216.5 | 15.9 |
| 2 | shelter-6 | death | exit | 11563 | 192.7 | 254.2 | 14.4 |
| 2 | shelter-12 | death | exit | 11759 | 196.0 | 262.7 | 14.3 |
| 3 | shelter-1 | infection conversion | first | 3340 | 55.7 | -6.7 | -10.4 |
| 3 | shelter-7 | infection conversion | fails | 3745 | 62.4 | 8.1 | -11.0 |
| 3 | shelter-20 | infection conversion | retreat | 4897 | 81.6 | 21.9 | 8.0 |
| 3 | mia | infection conversion | retreat | 5945 | 99.1 | 32.5 | 14.1 |
| 3 | shelter-3 | infection conversion | retreat | 7496 | 124.9 | 87.4 | 13.8 |
| 3 | shelter-12 | infection conversion | retreat | 7643 | 127.4 | 89.2 | 14.4 |
| 3 | shelter-5 | death | exit | 12508 | 208.5 | 249.1 | 15.1 |
| 3 | shelter-18 | death | exit | 12611 | 210.2 | 253.2 | 14.5 |
| 3 | sam | death | exit | 12738 | 212.3 | 256.7 | 14.9 |

Before the change, conversions began in the shelter at 33–47 s and losses continued through the retreat. Corridor-side emergence reduces the initial crowd exposure; the remaining losses happen mostly during retreat conversions, with a smaller number of late tunnel deaths.

## Validation

- `L6 typical + complete`, HIGH seeds 1–3: PASS; 6/6 runs complete; typical thresholds pass; complete full-window floor passes. Receipt: `/private/tmp/l6-group4-20.json`.
- `tests/engine/missions.test.ts`: PASS, 6/6 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L6`: skilled and passive routes complete. The audit reports `WAVE_NO_ATTACK_WITHIN_20_SECONDS` for breach two on the corridor-side route and two passive diagnostic flags; selected-level audit exits nonzero.
- `sh tools/remote/run.sh "$PWD" -- npm test`: unavailable (exit 69; no remote runner is running or provisioned). Local `npm test` ran 107 tests and found one stale pressure-rate invariant at 3/16; after retaining the required pressure rate via 4/20, the focused mission suite passed. Remote verification remains open.
- Browser QA needed; no browser run was requested.
