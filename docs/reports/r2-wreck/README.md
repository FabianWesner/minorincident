# r2-wreck

Base: `daada5d`; final runtime: `a300d4c`. Body radius **0.35 m**, crowd clearance **0.5 m**; neither changed. Threat thresholds, actor stats, spawn counts, and bot policy are unchanged.

## Causes and fixes

- `381d6a0` introduced oriented placement footprints throughout navigation, simulation contact, and Rapier. Applying this to every rotated prop changed existing authored collision proxies and caused the threat regressions. `c6c71c8` limits the opt-in to the two audited obstructions: L2 `l2-abandoned-9` (4, -28.6), and L3 `l3-crashed-59` (-72, 26.8). L7 and L8 retain main geometry.
- `25556fb` makes shot and blast cover use the same reviewed hull as physical contact; conservative bounds remain spatial indexes.
- The L3 sedan exposed a seven-cell island beside the lamp at (-68, 25). Four crowd cells at z=24.25, x=-68.75/-68.25/-67.75/-67.25 were body-clear but crowd-blocked by the lamp. Moving the lamp 0.1 m north opens the full-clearance route (`387ce10`, reduced to the necessary adjustment in `3291183`). The existing NPC regression fails before the move and passes afterward.
- `7467e7a` aligns segment visibility and penetration with the circular clearance used by the reviewed hull bake. Previously a valid corner cell could reject its outgoing segment. The added assertion in the existing navigation case fails on the previous implementation and passes with the fix; crossing chords still collide (`241c1c2`).

- `a300d4c` moves the Oak sedan and matching fire dressing 0.5 m north, from (-72, 26.8) to (-72, 27.3). This opens 12 crowd cells along the southern gate-side face, including (-70.75, 24.25), and closes 12 on the northern face. The new gate-cell assertion is verified red before the move and green afterward, with the original less-than-6 m corgi catch-up assertion intact. Native diagnostics complete all three seeds, with army counts 0/4/0; seed 1 has no deaths and 12.32 attacks/min.

### Bisect

[Recorded comparison](regression-bisect.json): both `381d6a0` and `0a2c8f6` produce the same 11 acceptance flags with `--levels L3,L7,L8`: one L3 army criterion, eight L7 follower flags, and two L8 follower-354 pace flags. The extra partial-selection flag is informational. This attributes the regressions to the footprint change, not the companion fallback. Main's zero-flag baseline was supplied by the orchestrator.

## Pocket audit, L1–L10

[Full component locations](nav-pockets.json), compared with the [saved main geometry baseline](nav-pockets-baseline.json):

| Level | Before pockets | After pockets | Before cells | After cells |
|---|---:|---:|---:|---:|
| L1 | 10 | 10 | 646 | 646 |
| L2 | 12 | 11 | 1,103 | 1,095 |
| L3 | 65 | 64 | 2,421 | 2,419 |
| L4 | 6 | 6 | 95 | 95 |
| L5 | 6 | 6 | 95 | 95 |
| L6 | 0 | 0 | 0 | 0 |
| L7 | 7 | 7 | 98 | 98 |
| L8 | 0 | 0 | 0 | 0 |
| L9 | 9 | 9 | 74 | 74 |
| L10 | 0 | 0 | 0 | 0 |

The L2 eight-cell island at (5.25, -26.75) and L3 two-cell island at (-72.75, 23.25) now connect to the street. No new components appear. Residual pockets are body-accessible crowd-grid components under the unchanged clearance contract; this report does not claim they are all eliminated. The earlier broad-footprint report's L3 ramp and L9 claims are withdrawn: those components are unchanged in the final geometry.

The audit uses seed 1, low tier, a 0.5 m grid, and the complete static level, including nonresident streamed L9/L10 terrain. It excludes the largest crowd component and counts other components reachable from it on the 0.35 m body grid. Dynamic blockers are outside this static measurement. A saved baseline preserves the actual before geometry when a placement moves.

```sh
node --expose-gc --import tsx/esm tools/qa/nav-pocket-audit.ts test-results/nav-pockets.json docs/reports/r2-wreck/nav-pockets-baseline.json
```

## Companion trail fallback — all levels

`0a2c8f6` records the living, visible courier's trail in every level and permits companion recovery after 120 ticks (2 seconds) of failed routing. There is no level gate. The existing 60-tick retry throttle and collision-safe movement remain.

The existing L1 NPC case records the trail through `Companion.update()`, forces routing failure, verifies no recovery movement before tick 120, and verifies trail-directed movement at tick 120. The L3 G27 case retains its original catch-up assertion of less than 6 m. All added assertions extend existing cases; collection remains 150/150 cases.

## Verification

- Focused navigation, NPC and combat suites: 14 tests in 3 files passed; corner-visibility regression also verified red before the fix.
- Final placement diagnostics: army criterion passes with 0/4/0 officers across seeds 1–3; seed-1 native rate is 12.32/min. These diagnostics are not a full gate.
- `npm run verify -- E21` — passed: typecheck (13.35 s), lint (8.84 s), and `npm test` (107 tests / 27 files; 26.05 s). Collection remains 150/150 cases.
- Final `npm run qa:threat -- --out test-results/r2-wreck-b/final` — **passed, zero flags**, all ten levels, 307.23 s (309.4 s including the wrapper), within the 600 s limit. It ran alone after repository checks and the final static audit, with starting load averages 4.01 / 4.15 / 4.12. All ten skilled routes completed.
- Final L3 army counts: **0/4/0**, criterion passed; native rate **12.32/min**, no deaths, 77 damage. L7's skilled and passive follower checks both have zero flags across seeds 1–3; L8 follower 354 has zero flags.

[Persistent threat summary](threat-summary.json). Full local receipts are under `test-results/r2-wreck-b/final/`; repository validation is under `test-results/epics/E21/`. Passive `tick-budget` outcomes are configured observation-window caps, not completion failures.

The final receipt measures runtime `a300d4c`; its observed main ref is `22e2810` (main advanced during the job). The pocket baseline and requested bisect use `daada5d`. No threat thresholds, bot routes, actor stats, or clearance radii were changed. The footprint fix and global companion fallback are ready together.
