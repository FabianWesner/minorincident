# Threat calibration

Runtime main: `4f2b75e42e69fd213de28e0701d8c7a04d4972d7`; harness base: `6fcc2d21e545db722516c481ef8d242c05e276c2`. Runtime source matches main: **false**. Seed 1, skilled and passive native routes, **low** population set before mission preparation. Sequential simulation only; 79.58 seconds, budget 600 seconds. Result: **13 acceptance fail flags**.

[Raw audit receipts](audit.json).

## Measurement contract

Every active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.

Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.

Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median; the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.

Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. The skilled route also gates zero windups in every inventoried combat phase, L2 bridge ≥2/min, L5 search ≥3/min, L10 hold ≥8/min and L6 mortal damage ≥30 HP. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing.

## Run coverage

| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |
|---|---|---:|---:|---:|---:|---:|
| L6 | complete | 279.58 | tick-budget / retreat | 110.00 | 7 | 2 | 6.02 | 0 |
| L7 | complete | 104.45 | complete / bus-departure | 101.65 | 7 | 0 | 15.64 | 12 |
| L8 | complete | 100.38 | tick-budget / escape | 150.00 | 3 | 22 | 19.38 | 0 |
| L9 | complete | 128.13 | complete / reach-outskirts | 128.13 | 8 | 0 | 7.95 | 0 |
| L10 | complete | 1168.53 | tick-budget / hold | 1062.70 | 12 | 1 | 30.58 | 0 |

## Acceptance criteria matrix

| Criterion | Passive measured | Skilled measured | Expected | Verdict |
|---|---:|---:|---|---|
| L1-08 | not measured | — | ≥ 3/min | NOT MEASURED |
| L2-07 | not measured | — | ≥ 4/min | NOT MEASURED |
| L2-07 reach | not measured | — | ≥ 90% | NOT MEASURED |
| L2-12 | — | not measured | ≥ 2 and ≤ 20/min | NOT MEASURED |
| L3-03 | not measured | — | ≥ 4/min | NOT MEASURED |
| L3-03 reach | not measured | — | ≥ 90% | NOT MEASURED |
| L4-07 | not measured | — | ≥ 6/min | NOT MEASURED |
| L4-07 reach | not measured | — | ≥ 90% | NOT MEASURED |
| L5-05 | not measured | — | ≥ 3/min | NOT MEASURED |
| L6-05 | 411.67 | — | ≥ 4/min | PASS |
| L6-05 reach | 100.00% | — | ≥ 95% | PASS |
| L6-06 | 100.00% | — | ≥ 95% | PASS |
| L7-05 | 10.50 + 21.75 group | — | ≥ 6/min | PASS |
| L8-06 | 278.80 + 9.20 group | — | ≥ 4/min | PASS |
| L10-11 | 1216.37 | — | ≥ 8/min | PASS |
| G-13 | 56 (77% of group median), 61 (86% of group median), 64 (82% of group median), 65 (93% of group median), 71 (94% of group median), 74 (95% of group median) | L7/60: 100.0% (166 samples); L7/63: 100.0% (169 samples); L8/354: 99.8% (31 samples); L8/359: 99.9% (32 samples); L8/362: 100.0% (32 samples); L8/363: 100.6% (32 samples); L8/364: 99.9% (32 samples); L8/365: 100.0% (32 samples); L8/366: 100.0% (32 samples); wait upper bounds: L7: 1.92%, L8: 4.90% | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | FAIL |
| L3-02 cohorts | not measured | not measured | 15/30/50 actual members on low tier | NOT MEASURED |
| L3-02 stream | not measured | — | every cohort admitted within its ≤18 s stream | NOT MEASURED |
| L3-02 alarm frame | not measured | — | ≥25% of opening wave on screen within 2 s | NOT MEASURED |
| L3-03 first attack | not measured | — | ≤10 s | NOT MEASURED |
| L4-07 first attack | not measured | — | ≤10 s | NOT MEASURED |
| L3-06 squad counts/losses | — | not measured | 3–4 at fallback; ≤2 at army; every loss a bite/kill/separation | NOT MEASURED |
| L3-11 native competent rate | — | not measured | 3–25 player attacks/min | NOT MEASURED |
| L4-05 directions/groups | not measured | — | ≥3 edges ≥60° apart; groups ≤5 at each source | NOT MEASURED |
| L4-06 first breach | not measured | — | level clock 30–60 s; ≥60 alive at first breach | NOT MEASURED |
| L4-06 sustained horde | not measured | — | ≥40 living in authored plaza from alarm +45 s through line break | NOT MEASURED |
| L6-03/04 | Breach cohorts: see L6 wave table | — | breach 1 ≥6; breach 2 ≥10 | See wave flags |
| L8-04 | 12/12 across 4 outlets [3, 3, 3, 3] | — | ≥3 outlets ≥20m apart, ≥6/3 each (high/low); no pop-in | LEDGER PASS; visual pending |
| G-22 | See announced-wave table below | Informational | first attack ≤ 20 s; several reachable infected at start | See wave flags |
| L9-03 | Not measured by this harness | Not measured | ≥ 1 group/wanderer in camera frame per 60 s, each route | NOT TESTED (harness gap) |

## L6

Threat steps explicitly selected from the loaded mission definition:

- `stop` — Stop the infected (combat; L6-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/shelter — shelter: Look around the shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| phase/shelter — controller: shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| step/stop — stop: Stop the infected | L6-05 | 411.67 player + 6.30 group/min; 1.62 s | 5.01 player + 13.36 group/min; 1.92 s | 17/17 | 3/3 | (0.33, 3.56) | — |
| phase/first — controller: first | — | 411.10 player + 0.00 group/min; 1.62 s | 8.56 player + 0.00 group/min; 1.92 s | 8/8 | 1/1 | (0.33, 3.56) | — |
| phase/fails — controller: fails | — | 413.25 player + 23.84 group/min; 0.28 s | 0.00 player + 32.21 group/min; — s | 17/17 | 3/3 | (0.33, 3.56) | — |
| step/retreat — retreat: Cover the retreat through the tunnel | — | 549.83 player + 125.64 group/min; 0.08 s | 8.06 player + 43.01 group/min; 32.78 s | 18/18 | 11/11 | (0.33, 3.56) | — |
| phase/retreat — controller: retreat | — | 549.83 player + 125.64 group/min; 0.08 s | 8.06 player + 43.01 group/min; 32.78 s | 18/18 | 11/11 | (0.33, 3.56) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| l6.breach1 | l6.breach1 | 33.20 | 76.80 | 8 | 8 | — | 1.62 | — |
| l6.breach2 | l6.breach2 | 54.22 | 55.78 | 10 | 10 | — | 6.27 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## L7

Threat steps explicitly selected from the loaded mission definition:

- `corridor` — Bring the group to the evacuation corridor (combat; L7-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/rocket — rocket: Recover the rocket launcher beside the exit | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 98/98 | 98/98 | (273.01, 15.00) | — |
| phase/pickup — controller: pickup | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 98/98 | 98/98 | (273.01, 15.00) | — |
| step/corridor — corridor: Bring the group to the evacuation corridor | L7-05 | 10.50 player + 21.75 group/min; 0.07 s | 11.18 player + 0.00 group/min; 0.68 s | 95/96 | 61/61 | (-24.47, 47.52) | SLOW_FOLLOWER:56, SLOW_FOLLOWER:61, SLOW_FOLLOWER:64, SLOW_FOLLOWER:65, SLOW_FOLLOWER:71, SLOW_FOLLOWER:74 |
| phase/encounters — controller: encounters | — | 24.67 player + 18.83 group/min; 0.07 s | 9.70 player + 0.00 group/min; 0.68 s | 100/100 | 0/0 | (-62.76, 47.34) | SLOW_FOLLOWER:56, SLOW_FOLLOWER:61, SLOW_FOLLOWER:64, SLOW_FOLLOWER:65, SLOW_FOLLOWER:71, SLOW_FOLLOWER:74 |
| step/departure — departure: Get everyone aboard the bus | — | 72.90 player + 0.00 group/min; 4.93 s | 0.00 player + 0.00 group/min; — s | 98/98 | 0/0 | (35.94, 47.00) | — |
| phase/departing — controller: departing | — | 13.33 player + 0.00 group/min; 1.68 s | 0.00 player + 0.00 group/min; — s | 98/98 | 0/0 | (35.94, 47.00) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 98/98 | 0/0 | (40.00, 47.00) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## L8

Threat steps explicitly selected from the loaded mission definition:

- `escape` — Bring the survivors to the armored vehicle and board (breach combat; L8-06).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/escape — escape: Bring the survivors to the armored vehicle and board | L8-06 | 278.80 player + 9.20 group/min; 63.82 s | 1.91 player + 0.00 group/min; 61.97 s | 88/88 | 80/80 | (51.37, 69.76) | — |
| phase/sanctuary — controller: sanctuary | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (23.14, 64.15) | — |
| phase/breached — controller: breached | — | 464.67 player + 15.33 group/min; 3.82 s | 5.24 player + 0.00 group/min; 1.97 s | 88/88 | 80/80 | (51.37, 69.76) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| tunnel-breach | L8 breachedAt/story.say | 60.00 | 90.00 | 12 | 12 | 3, 3, 3, 3 | 3.82 | — |
| tunnel-reinforcement@4200 | L8 nextWave clock | 70.00 | 80.00 | 16 | 16 | — | 3.15 | — |
| tunnel-reinforcement@4440 | L8 nextWave clock | 74.00 | 76.00 | 16 | 16 | — | 4.08 | — |
| tunnel-reinforcement@4680 | L8 nextWave clock | 78.00 | 72.00 | 16 | 16 | — | 2.98 | — |
| tunnel-reinforcement@4920 | L8 nextWave clock | 82.00 | 68.00 | 16 | 16 | — | 2.90 | — |
| tunnel-reinforcement@5160 | L8 nextWave clock | 86.00 | 64.00 | 16 | 4 | — | 35.42 | — |
| tunnel-reinforcement@5400 | L8 nextWave clock | 90.00 | 60.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@5640 | L8 nextWave clock | 94.00 | 56.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@5880 | L8 nextWave clock | 98.00 | 52.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6120 | L8 nextWave clock | 102.00 | 48.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6360 | L8 nextWave clock | 106.00 | 44.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6600 | L8 nextWave clock | 110.00 | 40.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6840 | L8 nextWave clock | 114.00 | 36.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7080 | L8 nextWave clock | 118.00 | 32.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7320 | L8 nextWave clock | 122.00 | 28.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7560 | L8 nextWave clock | 126.00 | 24.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7800 | L8 nextWave clock | 130.00 | 20.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8040 | L8 nextWave clock | 134.00 | 16.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8280 | L8 nextWave clock | 138.00 | 12.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8520 | L8 nextWave clock | 142.00 | 8.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8760 | L8 nextWave clock | 146.00 | 4.00 | 16 | 0 | — | — | — |
| tunnel-reinforcement@9000 | L8 nextWave clock | 150.00 | 0.00 | 16 | 0 | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## L9

Threat steps explicitly selected from the loaded mission definition:

- None; roadside infected are still measured.

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/approach — approach: Drive toward the city | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 2/2 | 2/2 | (466.34, 3.29) | — |
| phase/driving — controller: driving | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 2/2 | 2/2 | (466.34, 3.29) | — |
| phase/approach — controller: approach | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 4/4 | 4/4 | (494.74, 1.14) | — |
| phase/fall — controller: fall | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 2/2 | 2/2 | (508.00, 0.00) | — |
| step/reach-outskirts — reach-outskirts: Get clear of the wreck | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 2/2 | 2/2 | (540.50, 0.87) | — |
| phase/impact — controller: impact | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 2/2 | 2/2 | (527.50, 2.60) | — |
| phase/crawl — controller: crawl | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 2/2 | 2/2 | (540.50, 0.87) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 2/2 | 2/2 | (547.00, 0.00) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## L10

Threat steps explicitly selected from the loaded mission definition:

- `hold` — Charge the dispersal system (assault combat; L10-11).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/crash — crash: Leave the wreck on foot | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/residential-fringe — residential-fringe: Recover the handgun at the checkpoint | — | 156.52 player + 0.00 group/min; 5.32 s | 8.24 player + 0.00 group/min; 5.32 s | 7/7 | 5/5 | (763.90, 25.00) | — |
| step/industrial-area — industrial-area: Recover the shotgun at the checkpoint | — | 382.65 player + 0.00 group/min; 0.18 s | 7.68 player + 0.00 group/min; 28.43 s | 18/19 | 7/8 | (1253.25, 25.00) | — |
| step/military-zone — military-zone: Recover the machine gun at the checkpoint | — | 528.85 player + 0.00 group/min; 0.10 s | 8.36 player + 0.00 group/min; 36.52 s | 33/34 | 4/5 | (1849.67, 25.01) | — |
| step/research-campus — research-campus: Reach the research campus | — | 304.24 player + 0.00 group/min; 0.13 s | 14.25 player + 0.00 group/min; 11.45 s | 7/8 | 4/5 | (2461.00, -5.14) | — |
| step/research — research: Play the research recording | — | 338.87 player + 0.00 group/min; 2.67 s | 46.08 player + 0.00 group/min; 9.75 s | 54/55 | 28/29 | (2703.11, 41.37) | — |
| step/cure — cure: Pack the cure canister | — | 585.00 player + 0.00 group/min; 0.02 s | 0.00 player + 0.00 group/min; — s | 54/55 | 15/16 | (2705.13, 41.31) | — |
| step/research-exit — research-exit: Get the cure out of the laboratory | — | 860.45 player + 0.00 group/min; 0.02 s | 0.00 player + 0.00 group/min; — s | 52/53 | 1/2 | (2800.42, 44.74) | — |
| step/destroyed-corridor — destroyed-corridor: Carry the cure down the corridor and grab the rocket launcher | — | 934.52 player + 0.00 group/min; 0.07 s | 21.36 player + 0.00 group/min; 9.50 s | 54/55 | 19/20 | (2930.18, -4.99) | — |
| step/dispersal-complex — dispersal-complex: Bring the cure to the dispersal complex | — | 215.19 player + 0.00 group/min; 0.18 s | 5.54 player + 0.00 group/min; 43.53 s | 8/8 | 1/1 | (3691.37, -24.93) | — |
| step/install — install: Install the cure in the dispersal device | — | 243.61 player + 0.00 group/min; 0.90 s | 7.16 player + 0.00 group/min; 8.60 s | 19/20 | 0/1 | (4002.51, -37.12) | — |
| step/hold — hold: Charge the dispersal system | L10-11 | 1216.37 player + 0.00 group/min; 0.10 s | 70.23 player + 0.00 group/min; 6.77 s | 95/95 | 36/36 | (4003.24, -28.89) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| dispersal-assault | L10 charge-active (not first spawn) | 1002.72 | 59.98 | — | 75 | — | 4.65 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/industrial-area` at 190.28 s, 1/8 unreachable: `119@17` (1029.80, 80.00). Player (1252.90, 25.00).
- `step/military-zone` at 355.02 s, 1/5 unreachable: `119@17` (1496.54, 100.00). Player (1850.05, 25.01).
- `step/research-campus` at 528.15 s, 1/5 unreachable: `119@17` (1948.72, -75.00). Player (2462.27, -5.11).
- `step/research` at 590.77 s, 1/29 unreachable: `119@17` (2175.55, -75.00). Player (2697.03, 41.56).
- `step/cure` at 592.57 s, 1/16 unreachable: `119@17` (2182.07, -75.00). Player (2705.13, 41.31).
- `step/research-exit` at 614.02 s, 1/2 unreachable: `119@17` (2259.77, -75.00). Player (2801.59, 44.79).
- `step/destroyed-corridor` at 652.78 s, 1/20 unreachable: `119@17` (2527.00, 24.05). Player (2929.14, -4.99).
- `step/dispersal-complex` at 786.12 s, 1/1 unreachable: `119@17` (3233.73, 70.51). Player (3432.02, 94.90).
- `step/install` at 944.57 s, 1/1 unreachable: `119@17` (3797.00, -36.30). Player (3999.20, -35.56).

## Every fail flag

- L7/step/corridor:SLOW_FOLLOWER:56
- L7/step/corridor:SLOW_FOLLOWER:61
- L7/step/corridor:SLOW_FOLLOWER:64
- L7/step/corridor:SLOW_FOLLOWER:65
- L7/step/corridor:SLOW_FOLLOWER:71
- L7/step/corridor:SLOW_FOLLOWER:74
- L7/phase/encounters:SLOW_FOLLOWER:56
- L7/phase/encounters:SLOW_FOLLOWER:61
- L7/phase/encounters:SLOW_FOLLOWER:64
- L7/phase/encounters:SLOW_FOLLOWER:65
- L7/phase/encounters:SLOW_FOLLOWER:71
- L7/phase/encounters:SLOW_FOLLOWER:74
- PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate

## Flag-to-criterion mapping

| Flag | Acceptance criterion |
|---|---|
| L7/step/corridor:SLOW_FOLLOWER:56 | G-13 |
| L7/step/corridor:SLOW_FOLLOWER:61 | G-13 |
| L7/step/corridor:SLOW_FOLLOWER:64 | G-13 |
| L7/step/corridor:SLOW_FOLLOWER:65 | G-13 |
| L7/step/corridor:SLOW_FOLLOWER:71 | G-13 |
| L7/step/corridor:SLOW_FOLLOWER:74 | G-13 |
| L7/phase/encounters:SLOW_FOLLOWER:56 | G-13 |
| L7/phase/encounters:SLOW_FOLLOWER:61 | G-13 |
| L7/phase/encounters:SLOW_FOLLOWER:64 | G-13 |
| L7/phase/encounters:SLOW_FOLLOWER:65 | G-13 |
| L7/phase/encounters:SLOW_FOLLOWER:71 | G-13 |
| L7/phase/encounters:SLOW_FOLLOWER:74 | G-13 |
| PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate | see level-specific threat criterion |

Absolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.

## Defect triage provenance

Historical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.

Run `npm run qa:threat -- --maxWorkers=2` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat -- --maxWorkers=2`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.
