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

- `L6 typical + complete`, HIGH seeds 1–3: PASS; 6/6 runs complete; typical thresholds pass; complete full-window floor passes. Receipt: [evidence.json](evidence.json).
- `tests/engine/missions.test.ts`: PASS, 6/6 tests.
- `npm test`: PASS, 27 files and 107 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L6`: skilled and passive routes complete. The audit reports `WAVE_NO_ATTACK_WITHIN_20_SECONDS` for breach two on the corridor-side route and two passive diagnostic flags; selected-level audit exits nonzero.
- `sh tools/remote/run.sh "$PWD" -- npm test`: PASS on 46.225.66.90; 27 files, 106 passed / 1 skipped, unchanged 150/150 inventory; 220.4 s within the 240 s budget.
- Browser QA needed; no browser run was requested.

## Follow-up experiment

A single inner-approach lead for breach two was tested while the remaining cohort kept the corridor route. It failed: typical saved counts were 10, 10, 6; complete seed 2 had a full window with one attack start; the audit still flagged breach-two attack timing. The experiment was reverted. The committed 4/20 corridor baseline remains the passing survival/window configuration.

The full breach-two cohort was also measured at 9 m and 12 m approach offsets. At 9 m, typical saved 17/16/19 with deaths 0/0/1; at 12 m, it saved 15/17/9 with zero deaths. Both retained the complete-policy full-window attack floor, but both still failed the breach-two first-attack audit. Both experiments were reverted, retaining the already verified corridor baseline.

With the final 4/20 pressure cadence, restoring breach two to its original 20 m approach cleared all L6-specific audit flags (the command still reports PARTIAL_LEVEL_SELECTION), but typical seed 1 saved only 2/29 with five deaths and complete seeds 1/3 missed a full attack window. A 16 m approach saved 13/17/8 with deaths 1/0/0 and passed complete windows, but retained the breach-two attack-time audit flags. Both were reverted.

A 19 m approach failed typical seed 3 (3/29 saved) and retained audit flags. A timing experiment found that `secondDelay` is currently hard-coded in mission setup; after explicitly wiring the data value, a 30 s delay plus the original inner approach cleared all L6-specific audit flags and complete windows but saved only 12/8/9 (33.3% mean). Combining that delay with a 16 m approach saved 5/12/9 and retained audit flags. All experiment code was reverted; the verified baseline remains unchanged.

Fixed-delay follow-ups with the original inner breach-two approach were rejected: 25 s saved 17/3/13 with deaths 1/2/1 (audit follower flags); 28 s saved 12/1/10 with deaths 1/5/1 (audit follower and breach timing flags). Complete windows passed in both, but the typical minimum failed. All timing changes were reverted.
