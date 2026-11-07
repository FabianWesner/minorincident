# Threat calibration

Runtime main: `074c8ab9f7fdb227ed6a1fb7f615f9c8f73e616a`; harness base: `f8d0a8c6032f06cb7ef653901cbfa8d8d2498fe0`. Runtime source matches main: **false**. Seed 1 (L5/L7 follower pace: seeds 1–3), skilled and passive native routes, **low** population set before mission preparation. At most 2 simulation workers across independent levels or extra follower seeds; 282.95 seconds, budget 600 seconds. Result: **0 acceptance fail flags**.

[Archived raw audit receipts](threat.json.gz) (JSON bundle, gzip).

## Measurement contract

Every active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.

Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.

Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median (L5/L7: the same follower/phase must fail in at least two valid seeds out of seeds 1–3); the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.

Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. The skilled route also gates zero windups in every inventoried combat phase, L2 bridge ≥2/min, L5 search ≥3/min, L10 hold ≥8/min and L6 mortal damage ≥30 HP. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing.

## Run coverage

| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |
|---|---|---:|---:|---:|---:|---:|
| L1 | complete | 115.08 | complete / firestation | 115.08 | 11 | 0 | 10.98 | 0 |
| L2 | complete | 156.12 | complete / bridge | 188.33 | 15 | 1 | 19.39 | 0 |
| L3 | complete | 190.97 | tick-budget / checkpoint | 70.00 | 6 | 3 | 46.96 | 0 |
| L4 | complete | 719.45 | tick-budget / hide | 248.50 | 8 | 26 | 150.94 | 0 |
| L5 | complete | 193.37 | tick-budget / look | 1200.00 | 5 | 0 | 204.76 | 0 |
| L6 | complete | 323.07 | tick-budget / retreat | 110.00 | 6 | 2 | 7.20 | 0 |
| L7 | complete | 138.83 | complete / bus-departure | 103.52 | 7 | 0 | 40.00 | 0 |
| L8 | complete | 95.38 | complete / depart | 144.58 | 6 | 20 | 20.45 | 0 |
| L9 | complete | 128.13 | complete / reach-outskirts | 128.13 | 8 | 0 | 7.76 | 0 |
| L10 | complete | 1312.02 | tick-budget / hold | 1050.70 | 12 | 1 | 34.83 | 0 |

## Acceptance criteria matrix

| Criterion | Passive measured | Skilled measured | Expected | Verdict |
|---|---:|---:|---|---|
| L1-08 | 25.09 | — | ≥ 3/min | PASS |
| L2-07 | 49.18 (12.20 s) | — | ≥ 4/min | SHORT WINDOW |
| L2-07 reach | 100.00% | — | ≥ 90% | PASS |
| L2-12 | — | 10.38 | ≥ 2 and ≤ 20/min | PASS |
| L3-03 | 149.56 | — | ≥ 4/min | PASS |
| L3-03 reach | 100.00% | — | ≥ 90% | PASS |
| L4-07 | 898.42 | — | ≥ 6/min | PASS |
| L4-07 reach | 100.00% | — | ≥ 90% | PASS |
| L5-05 | 599.87 + 0.86 group | — | ≥ 3/min | PASS |
| L6-05 | 139.89 | — | ≥ 4/min | PASS |
| L6-05 reach | 100.00% | — | ≥ 95% | PASS |
| L6-06 | 100.00% | — | ≥ 95% | PASS |
| L7-05 | 160.87 + 25.36 group | — | ≥ 6/min | PASS |
| L8-06 | 244.19 + 8.23 group | — | ≥ 4/min | PASS |
| L10-11 | 977.53 | — | ≥ 8/min | PASS |
| G-13 | none | L5/complete/step/look/18: s1=100.7%(155), s2=102.2%(156), s3=101.4%(151); 0/3 fail; L5/complete/step/look/31: s1=96.3%(129), s2=98.8%(135), s3=100.0%(126); 0/3 fail; L5/complete/step/look/30: s1=99.1%(111), s2=100.0%(111), s3=99.6%(112); 0/3 fail; L5/complete/step/look/32: s1=100.0%(75), s2=102.4%(78), s3=100.3%(80); 0/3 fail; L5/complete/step/look/28: s1=101.2%(43), s2=98.7%(44), s3=97.5%(44); 0/3 fail; L5/complete/phase/search/18: s1=100.7%(155), s2=102.2%(156), s3=101.4%(151); 0/3 fail; L5/complete/phase/search/31: s1=96.3%(129), s2=98.8%(135), s3=100.0%(126); 0/3 fail; L5/complete/phase/search/30: s1=99.1%(111), s2=100.0%(111), s3=99.6%(112); 0/3 fail; L5/complete/phase/search/32: s1=100.0%(75), s2=102.4%(78), s3=100.3%(80); 0/3 fail; L5/complete/phase/search/28: s1=101.2%(43), s2=98.7%(44), s3=97.5%(44); 0/3 fail; L5/complete/step/metro/18: s1=100.0%(47), s2=100.0%(46), s3=101.1%(46); 0/3 fail; L5/complete/step/metro/28: s1=100.1%(47), s2=99.9%(46), s3=98.2%(46); 0/3 fail; L5/complete/step/metro/30: s1=99.9%(48), s2=100.1%(46), s3=98.9%(46); 0/3 fail; L5/complete/step/metro/31: s1=99.2%(48), s2=100.0%(45), s3=98.8%(45); 0/3 fail; L5/complete/step/metro/32: s1=103.7%(48), s2=99.5%(46), s3=101.2%(46); 0/3 fail; L5/complete/step/metro/29: s1=100.0%(47), s2=100.1%(45), s3=101.2%(45); 0/3 fail; L5/complete/phase/metro/18: s1=100.0%(47), s2=100.0%(46), s3=101.1%(46); 0/3 fail; L5/complete/phase/metro/28: s1=100.1%(47), s2=99.9%(46), s3=98.2%(46); 0/3 fail; L5/complete/phase/metro/30: s1=99.9%(48), s2=100.1%(46), s3=98.9%(46); 0/3 fail; L5/complete/phase/metro/31: s1=99.2%(48), s2=100.0%(45), s3=98.8%(45); 0/3 fail; L5/complete/phase/metro/32: s1=103.7%(48), s2=99.5%(46), s3=101.2%(46); 0/3 fail; L5/complete/phase/metro/29: s1=100.0%(47), s2=100.1%(45), s3=101.2%(45); 0/3 fail; L5/passive/step/look/18: s1=100.0%(993), s2=100.0%(905), s3=100.0%(2099); 0/3 fail; L5/passive/phase/search/18: s1=100.0%(993), s2=100.0%(905), s3=100.0%(2099); 0/3 fail; L5/28: 101.2% (43 samples); L5/31: 96.3% (129 samples); L7/complete/step/corridor/20: s1=100.0%(126), s2=100.0%(126), s3=100.0%(126); 0/3 fail; L7/complete/step/corridor/51: s1=100.0%(140), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/52: s1=100.0%(140), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/53: s1=100.0%(140), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/54: s1=100.0%(143), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/55: s1=100.0%(143), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/56: s1=100.0%(143), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/57: s1=100.0%(143), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/58: s1=100.0%(143), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/59: s1=100.0%(143), s2=100.0%(143), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/60: s1=100.0%(143), s2=100.0%(143), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/61: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/62: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/63: s1=100.1%(143), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/64: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/65: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/66: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/67: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/68: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/69: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/70: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/71: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/72: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/73: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/74: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/phase/encounters/20: s1=100.0%(147), s2=100.0%(141), s3=100.0%(132); 0/3 fail; L7/complete/phase/encounters/51: s1=100.0%(163), s2=100.0%(166), s3=100.0%(164); 0/3 fail; L7/complete/phase/encounters/52: s1=100.0%(160), s2=100.0%(163), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/53: s1=100.0%(160), s2=100.0%(163), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/54: s1=100.0%(163), s2=100.0%(166), s3=100.0%(165); 0/3 fail; L7/complete/phase/encounters/55: s1=100.0%(163), s2=100.0%(163), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/56: s1=100.0%(163), s2=100.0%(163), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/57: s1=100.0%(163), s2=100.0%(166), s3=100.0%(164); 0/3 fail; L7/complete/phase/encounters/58: s1=100.0%(163), s2=100.0%(161), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/59: s1=100.1%(166), s2=100.0%(163), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/60: s1=100.0%(163), s2=100.0%(166), s3=100.0%(167); 0/3 fail; L7/complete/phase/encounters/61: s1=100.0%(166), s2=100.0%(166), s3=100.0%(165); 0/3 fail; L7/complete/phase/encounters/62: s1=100.0%(169), s2=100.0%(164), s3=100.0%(165); 0/3 fail; L7/complete/phase/encounters/63: s1=100.1%(166), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/64: s1=100.0%(169), s2=100.0%(166), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/65: s1=100.0%(169), s2=100.0%(166), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/66: s1=100.0%(169), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/67: s1=100.0%(166), s2=100.0%(166), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/68: s1=100.0%(169), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/69: s1=100.0%(169), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/70: s1=100.0%(169), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/71: s1=100.0%(169), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/72: s1=100.0%(169), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/73: s1=100.0%(169), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/phase/encounters/74: s1=100.0%(169), s2=100.0%(169), s3=100.0%(168); 0/3 fail; L7/complete/step/departure/20: s1=98.2%(25), s2=97.3%(15), s3=unmeasured(8); 0/2 fail; L7/complete/step/departure/51: s1=98.9%(26), s2=98.9%(30), s3=100.0%(27); 0/3 fail; L7/complete/step/departure/52: s1=97.8%(23), s2=97.8%(28), s3=97.8%(27); 0/3 fail; L7/complete/step/departure/53: s1=100.0%(23), s2=100.0%(27), s3=100.0%(28); 0/3 fail; L7/complete/step/departure/54: s1=100.0%(23), s2=98.8%(29), s3=100.0%(26); 0/3 fail; L7/complete/step/departure/55: s1=97.8%(24), s2=97.9%(26), s3=100.0%(23); 0/3 fail; L7/complete/step/departure/56: s1=100.0%(23), s2=100.0%(25), s3=100.0%(26); 0/3 fail; L7/complete/step/departure/57: s1=98.5%(24), s2=100.0%(27), s3=98.7%(25); 0/3 fail; L7/complete/step/departure/58: s1=99.4%(24), s2=98.5%(26), s3=99.2%(24); 0/3 fail; L7/complete/step/departure/59: s1=100.0%(27), s2=100.3%(25), s3=100.0%(24); 0/3 fail; L7/complete/step/departure/60: s1=100.0%(23), s2=97.9%(31), s3=100.0%(25); 0/3 fail; L7/complete/step/departure/61: s1=99.6%(24), s2=100.0%(29), s3=100.0%(25); 0/3 fail; L7/complete/step/departure/62: s1=98.2%(26), s2=100.0%(27), s3=100.0%(26); 0/3 fail; L7/complete/step/departure/63: s1=99.9%(27), s2=97.8%(32), s3=97.8%(29); 0/3 fail; L7/complete/step/departure/64: s1=100.0%(26), s2=100.0%(29), s3=100.0%(30); 0/3 fail; L7/complete/step/departure/65: s1=100.8%(26), s2=98.5%(28), s3=100.0%(26); 0/3 fail; L7/complete/step/departure/66: s1=97.9%(27), s2=100.0%(27), s3=100.0%(26); 0/3 fail; L7/complete/step/departure/67: s1=100.0%(24), s2=100.0%(27), s3=100.0%(25); 0/3 fail; L7/complete/step/departure/68: s1=102.0%(27), s2=100.0%(26), s3=99.6%(30); 0/3 fail; L7/complete/step/departure/69: s1=100.0%(27), s2=100.0%(31), s3=100.0%(29); 0/3 fail; L7/complete/step/departure/70: s1=100.8%(26), s2=100.0%(30), s3=100.0%(30); 0/3 fail; L7/complete/step/departure/71: s1=100.0%(26), s2=100.0%(30), s3=100.0%(30); 0/3 fail; L7/complete/step/departure/72: s1=100.0%(26), s2=100.0%(29), s3=100.0%(29); 0/3 fail; L7/complete/step/departure/73: s1=100.0%(26), s2=100.0%(32), s3=98.0%(31); 0/3 fail; L7/complete/step/departure/74: s1=100.9%(26), s2=100.0%(31), s3=100.0%(29); 0/3 fail; L7/passive/step/corridor/20: s1=100.0%(100), s2=117.3%(110), s3=227.5%(132); 0/3 fail; L7/passive/step/corridor/67: s1=unmeasured(7), s2=100.0%(10), s3=85.2%(15); 1/2 fail; L7/passive/step/corridor/69: s1=unmeasured(8), s2=100.1%(10), s3=207.8%(15); 0/2 fail; L7/passive/step/corridor/72: s1=unmeasured(9), s2=83.1%(10), s3=205.2%(15); 1/2 fail; L7/passive/step/corridor/73: s1=unmeasured(9), s2=100.0%(10), s3=111.8%(15); 0/2 fail; L7/passive/step/corridor/74: s1=unmeasured(9), s2=100.0%(10), s3=71.4%(15); 1/2 fail; L7/passive/step/corridor/51: s1=unmeasured(5), s2=unmeasured(6), s3=54.0%(15); 1/1 fail; L7/passive/step/corridor/52: s1=unmeasured(8), s2=unmeasured(7), s3=74.0%(15); 1/1 fail; L7/passive/step/corridor/53: s1=unmeasured(7), s2=unmeasured(6), s3=58.1%(15); 1/1 fail; L7/passive/step/corridor/54: s1=unmeasured(6), s2=unmeasured(7), s3=51.1%(15); 1/1 fail; L7/passive/step/corridor/55: s1=unmeasured(9), s2=unmeasured(8), s3=68.1%(15); 1/1 fail; L7/passive/step/corridor/56: s1=unmeasured(9), s2=unmeasured(8), s3=44.8%(15); 1/1 fail; L7/passive/step/corridor/57: s1=unmeasured(6), s2=unmeasured(3), s3=172.4%(15); 0/1 fail; L7/passive/step/corridor/58: s1=unmeasured(4), s2=unmeasured(5), s3=58.4%(14); 1/1 fail; L7/passive/step/corridor/59: s1=unmeasured(9), s2=unmeasured(7), s3=183.2%(15); 0/1 fail; L7/passive/step/corridor/60: s1=unmeasured(9), s2=unmeasured(6), s3=185.7%(13); 0/1 fail; L7/passive/step/corridor/61: s1=unmeasured(9), s2=unmeasured(8), s3=78.5%(15); 1/1 fail; L7/passive/step/corridor/62: s1=unmeasured(9), s2=unmeasured(8), s3=56.0%(15); 1/1 fail; L7/passive/step/corridor/63: s1=unmeasured(9), s2=unmeasured(8), s3=211.3%(15); 0/1 fail; L7/passive/step/corridor/64: s1=unmeasured(9), s2=unmeasured(7), s3=179.2%(15); 0/1 fail; L7/passive/step/corridor/65: s1=unmeasured(9), s2=unmeasured(8), s3=177.1%(15); 0/1 fail; L7/passive/step/corridor/66: s1=unmeasured(9), s2=unmeasured(8), s3=193.4%(15); 0/1 fail; L7/passive/step/corridor/68: s1=unmeasured(9), s2=unmeasured(8), s3=151.0%(15); 0/1 fail; L7/passive/step/corridor/70: s1=unmeasured(9), s2=unmeasured(8), s3=100.0%(15); 0/1 fail; L7/passive/step/corridor/71: s1=unmeasured(9), s2=unmeasured(8), s3=75.4%(15); 1/1 fail; L7/passive/phase/encounters/20: s1=100.0%(105), s2=117.3%(125), s3=227.5%(155); 0/3 fail; L7/passive/phase/encounters/67: s1=unmeasured(7), s2=100.0%(10), s3=85.2%(15); 1/2 fail; L7/passive/phase/encounters/69: s1=unmeasured(8), s2=100.1%(10), s3=207.8%(15); 0/2 fail; L7/passive/phase/encounters/72: s1=unmeasured(9), s2=83.1%(10), s3=205.2%(15); 1/2 fail; L7/passive/phase/encounters/73: s1=unmeasured(9), s2=100.0%(10), s3=111.8%(15); 0/2 fail; L7/passive/phase/encounters/74: s1=unmeasured(9), s2=100.0%(10), s3=71.4%(15); 1/2 fail; L7/passive/phase/encounters/51: s1=unmeasured(5), s2=unmeasured(6), s3=54.0%(15); 1/1 fail; L7/passive/phase/encounters/52: s1=unmeasured(8), s2=unmeasured(7), s3=74.0%(15); 1/1 fail; L7/passive/phase/encounters/53: s1=unmeasured(7), s2=unmeasured(6), s3=58.1%(15); 1/1 fail; L7/passive/phase/encounters/54: s1=unmeasured(6), s2=unmeasured(7), s3=51.1%(15); 1/1 fail; L7/passive/phase/encounters/55: s1=unmeasured(9), s2=unmeasured(8), s3=68.1%(15); 1/1 fail; L7/passive/phase/encounters/56: s1=unmeasured(9), s2=unmeasured(8), s3=44.8%(15); 1/1 fail; L7/passive/phase/encounters/57: s1=unmeasured(6), s2=unmeasured(3), s3=172.4%(15); 0/1 fail; L7/passive/phase/encounters/58: s1=unmeasured(4), s2=unmeasured(5), s3=58.4%(14); 1/1 fail; L7/passive/phase/encounters/59: s1=unmeasured(9), s2=unmeasured(7), s3=183.2%(15); 0/1 fail; L7/passive/phase/encounters/60: s1=unmeasured(9), s2=unmeasured(6), s3=185.7%(13); 0/1 fail; L7/passive/phase/encounters/61: s1=unmeasured(9), s2=unmeasured(8), s3=78.5%(15); 1/1 fail; L7/passive/phase/encounters/62: s1=unmeasured(9), s2=unmeasured(8), s3=56.0%(15); 1/1 fail; L7/passive/phase/encounters/63: s1=unmeasured(9), s2=unmeasured(8), s3=211.3%(15); 0/1 fail; L7/passive/phase/encounters/64: s1=unmeasured(9), s2=unmeasured(7), s3=179.2%(15); 0/1 fail; L7/passive/phase/encounters/65: s1=unmeasured(9), s2=unmeasured(8), s3=177.1%(15); 0/1 fail; L7/passive/phase/encounters/66: s1=unmeasured(9), s2=unmeasured(8), s3=193.4%(15); 0/1 fail; L7/passive/phase/encounters/68: s1=unmeasured(9), s2=unmeasured(8), s3=151.0%(15); 0/1 fail; L7/passive/phase/encounters/70: s1=unmeasured(9), s2=unmeasured(8), s3=100.0%(15); 0/1 fail; L7/passive/phase/encounters/71: s1=unmeasured(9), s2=unmeasured(8), s3=75.4%(15); 1/1 fail; L7/passive/step/departure/20: s1=unmeasured(5), s2=100.0%(15), s3=100.0%(23); 0/2 fail; L7/60: 100.0% (163 samples); L7/63: 100.1% (166 samples); L8/354: 99.8% (31 samples); L8/359: 99.9% (32 samples); L8/362: 100.0% (32 samples); L8/363: 100.6% (32 samples); L8/364: 99.9% (32 samples); L8/365: 100.0% (32 samples); L8/366: 100.0% (32 samples); wait upper bounds: L5: 0.00%, L7: 0.31%, L8: 4.90% | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | PASS |
| L3-02 cohorts | 15/15, 30/30, 50/50 | 15/15, 30/30, 50/50 | 15/30/50 actual members on low tier | PASS |
| L3-02 stream | 16.73 s scheduled; 15 admitted; 16.57 s scheduled; 30 admitted; 17.08 s scheduled; 50 admitted | — | every cohort admitted within its ≤18 s stream | PASS |
| L3-02 alarm frame | 5/15 | — | ≥25% of opening wave on screen within 2 s | PASS |
| L3-03 first attack | 2.95 s | — | ≤10 s | PASS |
| L4-07 first attack | 8.83 s | — | ≤10 s | PASS |
| L3-06 squad counts/losses | — | 4 → army s1:3/s2:0/s3:0 (2/3 ≤2); bite | 3–4 at fallback; ≤2 at army (seeds 1–3: ≥2 valid, ≥2 of them ≤2); every loss a bite/kill/separation | PASS |
| L3-11 native competent rate | — | 5.39/min; 22 damage; 0 deaths | 3–25 player attacks/min | PASS |
| L4-05 directions/groups | 6 edges; ≥60°: true; max group 5 | — | ≥3 edges ≥60° apart; groups ≤5 at each source | PASS |
| L4-06 first breach | 52.72 s level / +19.90 s alarm; 65 alive | — | level clock 30–60 s; ≥60 alive at first breach | PASS |
| L4-06 sustained horde | minimum 54; 8760 observations; line break 190.00 s | — | ≥40 living in authored plaza from alarm +45 s through line break | PASS |
| L6-03/04 | Breach cohorts: see L6 wave table | — | breach 1 ≥6; breach 2 ≥10 | See wave flags |
| L8-04 | 12/12 across 4 outlets [3, 3, 3, 3] | — | ≥3 outlets ≥20m apart, ≥6/3 each (high/low); no pop-in | LEDGER PASS; visual pending |
| G-22 | See announced-wave table below | Informational | first attack ≤ 20 s; several reachable infected at start | See wave flags |
| L9-03 | Not measured by this harness | Not measured | ≥ 1 group/wanderer in camera frame per 60 s, each route | NOT TESTED (harness gap) |

## L1

Threat steps explicitly selected from the loaded mission definition:

- None; roadside infected are still measured.

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/pickup — pickup: Pick up the package at the courier depot | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-38.79, -34.84) | — |
| phase/morning — controller: morning | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (64.53, -9.88) | — |
| step/deliver — deliver: Deliver the package to the Medical Annex | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (65.63, -11.61) | — |
| phase/handover — controller: handover | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (65.63, -11.61) | — |
| phase/calm — controller: calm | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (65.63, -11.61) | — |
| phase/accident — controller: accident | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (65.31, -9.54) | — |
| step/escape — escape: Get away from the facility | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 5/5 | 5/5 | (65.31, -9.54) | — |
| phase/spread — controller: spread | L1-08 | 25.09 player + 0.00 group/min; 12.67 s | 25.09 player + 0.00 group/min; 12.67 s | 24/24 | 24/24 | (-73.91, 40.46) | — |
| step/weapon — weapon: Find something to defend yourself | — | 18.65 player + 0.00 group/min; 12.65 s | 18.65 player + 0.00 group/min; 12.65 s | 20/20 | 20/20 | (23.26, 37.31) | — |
| step/firestation — firestation: Get inside the fire station | — | 29.33 player + 0.00 group/min; 0.42 s | 29.33 player + 0.00 group/min; 0.42 s | 24/24 | 24/24 | (-73.91, 40.46) | — |
| phase/run-out — level-end run-out | — | 144.00 player + 0.00 group/min; 1.13 s | 144.00 player + 0.00 group/min; 1.13 s | 28/28 | 28/28 | (-76.04, 41.15) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## L2

Threat steps explicitly selected from the loaded mission definition:

- None; roadside infected are still measured.

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/calm — calm: Take the fire axe | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-73.98, 47.08) | — |
| step/axe — axe: Take the fire axe | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-73.20, 45.20) | — |
| phase/calm — controller: calm | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-73.98, 47.08) | — |
| step/board — board: Get on the fire truck | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-73.98, 47.08) | — |
| phase/alarm — controller: alarm | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-70.82, 41.50) | — |
| step/ride — ride: Ride with Engine 3 to Grove Market | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-42.84, -32.00) | — |
| phase/ride — controller: ride | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-42.84, -32.00) | — |
| step/doors — doors: Cover the firefighters while they force the doors | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-45.97, -36.77) | — |
| phase/arrived — controller: arrived | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-45.97, -36.77) | — |
| phase/doors — controller: doors | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-45.97, -36.77) | — |
| step/bridge — bridge: Reach the police checkpoint at the bridge | — | 177.02 player + 0.00 group/min; 3.28 s | 10.38 player + 0.00 group/min; 3.28 s | 0/4 | 0/27 | (81.40, 32.96) | — |
| phase/collapse — controller: collapse | L2-07 | 49.18 player + 0.00 group/min; 3.28 s | 32.47 player + 0.00 group/min; 3.28 s | 30/30 | 30/30 | (-65.50, -22.95) | — |
| phase/escape — controller: escape | L2-12 | 195.39 player + 0.00 group/min; 3.37 s | 7.01 player + 0.00 group/min; 3.07 s | 5/5 | 27/27 | (81.42, 37.84) | — |
| phase/checkpoint — controller: checkpoint | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/4 | 0/27 | (81.40, 32.96) | — |
| phase/run-out — level-end run-out | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/5 | 0/28 | (81.95, 32.30) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| market-ambush | l2.doorsOpen | 58.60 | 129.73 | 24 | 24 | — | 3.28 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/bridge`, `phase/checkpoint` at 150.52 s, 27/27 unreachable: `185@2` (12.48, -29.63); `191@5` (-57.58, -26.71); `201@10` (5.37, -4.30); `209@14` (-26.00, 4.33); `217@18` (-54.84, 37.51); `219@19` (-51.98, 14.70); `233@27` (-68.89, 2.96); `235@28` (-67.10, 14.46); `237@29` (-68.03, 15.21); `239@30` (-64.68, -4.16); `241@31` (-24.81, 48.63); `243@32` (-55.09, 30.42); `245@33` (-54.27, 28.31); `247@34` (-66.95, 18.10); `249@35` (33.55, -27.02); `251@36` (36.46, -28.36); `253@37` (39.15, -31.46); `255@38` (42.67, -32.91); `257@39` (-7.12, 48.03); `259@40` (81.28, 42.18); `261@41` (-33.74, -15.82); `263@42` (-34.41, 2.05); `265@43` (-28.97, 18.44); `267@44` (-11.50, 28.34); `269@45` (7.74, 26.23); `271@46` (26.46, 27.04); `275@48` (45.80, 29.70). Player (81.40, 32.96).
- `phase/run-out` at 155.12 s, 28/28 unreachable: `185@2` (14.12, -29.74); `191@5` (-51.82, -26.74); `201@10` (5.76, -2.14); `209@14` (-26.26, 9.63); `217@18` (-51.68, 34.25); `219@19` (-46.67, 14.45); `233@27` (-67.10, 4.04); `235@28` (-68.77, 14.92); `237@29` (-68.59, 13.75); `239@30` (-66.04, 1.27); `241@31` (-26.57, 49.06); `243@32` (-56.92, 31.55); `245@33` (-56.65, 33.25); `247@34` (-66.33, 20.95); `249@35` (36.86, -29.06); `251@36` (37.19, -30.64); `253@37` (39.96, -33.46); `255@38` (38.42, -30.40); `257@39` (-5.62, 48.58); `261@41` (-33.94, -14.42); `263@42` (-35.94, 3.47); `265@43` (-26.43, 17.04); `267@44` (-11.18, 26.48); `269@45` (6.27, 28.29); `271@46` (25.45, 26.63); `275@48` (46.15, 34.18); `297@59` (81.36, 39.56); `175@60` (5.89, -4.95). Player (81.95, 32.30).

## L3

Threat steps explicitly selected from the loaded mission definition:

- `defend` — Help defend the station (combat; L3-03).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/armory — armory: Take a handgun from the armory | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-139.91, -6.85) | — |
| phase/yard — controller: yard | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-134.95, 0.61) | — |
| step/defend — defend: Help defend the station | L3-03 | 149.56 player + 0.00 group/min; 2.95 s | 23.48 player + 0.00 group/min; 2.95 s | 32/32 | 24/24 | (-134.95, 0.61) | — |
| phase/attack — controller: attack | — | 149.56 player + 0.00 group/min; 2.95 s | 23.48 player + 0.00 group/min; 2.95 s | 32/32 | 24/24 | (-134.95, 0.61) | — |
| step/checkpoint — checkpoint: Get inside the army checkpoint | — | 943.04 player + 80.46 group/min; 0.12 s | 5.39 player + 6.16 group/min; 0.77 s | 77/77 | 0/36 | (-134.95, 0.61) | — |
| phase/fallback — controller: fallback | — | 943.04 player + 80.46 group/min; 0.12 s | 54.09 player + 78.13 group/min; 0.77 s | 77/77 | 11/11 | (-134.95, 0.61) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| station-0 | L3 scheduled wave.at (before admission) | 9.45 | 60.55 | 15 | 15 | — | 2.95 | — |
| station-1 | L3 scheduled wave.at (before admission) | 29.45 | 40.55 | 30 | 30 | — | 2.97 | — |
| station-2 | L3 scheduled wave.at (before admission) | 49.45 | 20.55 | 50 | 50 | — | 4.47 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/checkpoint`, `phase/corridor` at 188.98 s, 36/36 unreachable: `2192@1018` (143.76, 1.62); `2194@1019` (192.57, 0.56); `2196@1020` (149.91, 3.02); `2198@1021` (183.77, 2.45); `2200@1022` (152.23, 2.11); `2362@1096` (196.10, -2.76); `2464@1142` (152.88, 1.73); `2466@1143` (170.63, -0.58); `2468@1144` (153.91, 1.04); `2470@1145` (179.88, 0.95); `2472@1146` (132.22, 3.74); `2636@1220` (194.71, -1.52); `2770@1281` (196.76, -3.07); `2772@1282` (192.32, 1.22); `2774@1283` (193.72, -0.25); `2776@1284` (193.16, 0.16); `2778@1285` (195.43, -2.99); `2940@1358` (185.60, 3.05); `2942@1359` (188.50, 1.78); `2944@1360` (188.07, 2.51); `2946@1361` (184.90, 2.89); `2948@1362` (186.88, 2.80); `3110@1435` (169.93, -0.66); `3112@1436` (172.47, -0.79); `3114@1437` (173.55, -0.56); `3116@1438` (175.95, -0.34); `3118@1439` (175.20, -0.54); `3224@1486` (76.64, 3.60); `3226@1487` (79.50, 24.00); `3228@1488` (59.22, 24.00); `3230@1489` (71.89, 32.00); `3232@1490` (69.38, 24.00); `3234@1491` (91.46, 32.00); `3236@1492` (91.57, 24.00); `3238@1493` (110.72, 24.00); `3240@1494` (108.67, 32.00). Player (224.99, 0.20).
- `phase/done` at 190.97 s, 36/36 unreachable: `2192@1018` (148.38, 2.90); `2194@1019` (197.37, -3.24); `2196@1020` (155.84, -0.06); `2198@1021` (189.62, 2.47); `2200@1022` (157.94, -1.47); `2464@1142` (158.58, -1.87); `2466@1143` (177.31, -0.06); `2468@1144` (159.64, -2.50); `2470@1145` (186.22, 2.98); `2472@1146` (128.21, 4.11); `2772@1282` (196.73, -2.98); `2776@1284` (198.05, -3.05); `2940@1358` (189.35, 1.37); `2942@1359` (191.84, -1.03); `2944@1360` (192.86, 0.59); `2946@1361` (190.38, 0.93); `2948@1362` (191.39, -1.88); `3110@1435` (176.64, -0.17); `3112@1436` (179.04, 0.63); `3114@1437` (180.05, 1.02); `3116@1438` (182.30, 1.88); `3118@1439` (181.58, 1.59); `3280@1512` (167.34, -0.94); `3282@1513` (169.32, -0.23); `3284@1514` (164.84, -2.65); `3286@1515` (165.73, -1.30); `3288@1516` (166.54, -1.10); `3314@1527` (76.64, 3.60); `3316@1528` (91.46, 32.00); `3318@1529` (71.89, 32.00); `3320@1530` (79.50, 24.00); `3322@1531` (100.61, 32.00); `3324@1532` (110.72, 24.00); `3326@1533` (118.73, 32.00); `3328@1534` (118.74, 24.00); `3330@1535` (91.57, 24.00). Player (224.99, 0.20).

## L4

Threat steps explicitly selected from the loaded mission definition:

- `hold` — Hold the plaza with the army (combat; L4-07).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/ride — ride: Ride into Fairhaven with the convoy | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| phase/convoy — controller: convoy | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/quartermaster — quartermaster: Report to the quartermaster | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| phase/plaza — controller: plaza | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/hold — hold: Hold the plaza with the army | L4-07 | 898.42 player + 0.00 group/min; 8.83 s | 179.33 player + 0.00 group/min; 10.35 s | 79/79 | 79/79 | (-22.81, 0.59) | — |
| phase/war — controller: war | — | 898.42 player + 0.00 group/min; 8.83 s | 179.33 player + 0.00 group/min; 10.35 s | 79/79 | 79/79 | (-22.81, 0.59) | — |
| step/hide — hide: Run to the cellar via Lakeshore, Metro Road and Harbor Street | — | 731.21 player + 0.00 group/min; 0.05 s | 131.52 player + 0.00 group/min; 0.25 s | 80/80 | 80/80 | (-19.34, 3.73) | — |
| phase/collapse — controller: collapse | — | 731.21 player + 0.00 group/min; 0.05 s | 131.52 player + 0.00 group/min; 0.25 s | 80/80 | 80/80 | (-19.34, 3.73) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| war-0@1969 | l4.wave | 32.82 | 215.68 | 24 | 24 | — | 8.83 | — |
| war-1@2629 | l4.wave | 43.82 | 204.68 | 36 | 35 | — | 18.18 | — |
| breach-west | L4 breach.openAt | 52.72 | 195.78 | — | 95 | — | 4.92 | — |
| war-2@3289 | l4.wave | 54.82 | 193.68 | 48 | 23 | — | 107.78 | — |
| war-3@3949 | l4.wave | 65.82 | 182.68 | 54 | 9 | — | — | — |
| war--1@4009 | l4.wave | 66.82 | 181.68 | 15 | 0 | — | — | — |
| war-4@4609 | l4.wave | 76.82 | 171.68 | 54 | 0 | — | — | — |
| war-5@5269 | l4.wave | 87.82 | 160.68 | 54 | 0 | — | — | — |
| war-6@5929 | l4.wave | 98.82 | 149.68 | 54 | 0 | — | — | — |
| war-7@6589 | l4.wave | 109.82 | 138.68 | 54 | 0 | — | — | — |
| war-8@7249 | l4.wave | 120.82 | 127.68 | 54 | 0 | — | — | — |
| war-9@7909 | l4.wave | 131.82 | 116.68 | 54 | 0 | — | — | — |
| breach-north | L4 breach.openAt | 138.10 | 110.40 | — | 24 | — | 5.77 | — |
| war-10@8569 | l4.wave | 142.82 | 105.68 | 54 | 0 | — | — | — |
| war-11@9229 | l4.wave | 153.82 | 94.68 | 54 | 0 | — | — | — |
| war-12@9889 | l4.wave | 164.82 | 83.68 | 54 | 0 | — | — | — |
| war-13@10549 | l4.wave | 175.82 | 72.68 | 54 | 0 | — | — | — |
| breach-south | L4 breach.openAt | 179.87 | 68.63 | — | 4 | — | 6.07 | — |
| war-14@11209 | l4.wave | 186.82 | 61.68 | 54 | 0 | — | — | — |
| opening-alarm | L4 opening pending street cohorts | 32.82 | 215.68 | — | 0 | — | — | — |
| war-15@11869 | l4.wave | 197.82 | 50.68 | 54 | 0 | — | — | — |
| war-16@12529 | l4.wave | 208.82 | 39.68 | 54 | 0 | — | — | — |
| war-17@13189 | l4.wave | 219.82 | 28.68 | 54 | 0 | — | — | — |
| collapse-0@13609 | l4.wave | 226.82 | 21.68 | 6 | 0 | — | — | — |
| collapse-1@14149 | l4.wave | 235.82 | 12.68 | 6 | 0 | — | — | — |
| collapse-2@14689 | l4.wave | 244.82 | 3.68 | 6 | 0 | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/bar` at 711.28 s, 80/80 unreachable: `222@54` (-15.62, 26.04); `356@179` (-18.51, 23.48); `376@198` (-19.32, 23.39); `378@200` (-19.48, 21.97); `382@203` (-15.62, 26.75); `411@231` (-15.62, 25.11); `433@252` (-16.45, 23.46); `435@253` (-15.27, 22.49); `444@262` (-15.62, 24.20); `454@272` (-12.48, 27.68); `484@296` (-31.04, -1.48); `486@298` (-14.27, 26.54); `533@343` (-15.04, 23.78); `581@354` (-26.59, -4.38); `584@357` (-12.65, 24.89); `601@371` (-18.37, 21.87); `657@427` (-48.79, 51.66); `668@438` (-29.72, -8.94); `669@439` (77.26, 48.33); `670@440` (25.39, 51.95); `671@441` (52.21, 43.27); `712@481` (-61.11, -22.59); `715@484` (49.14, -22.77); `716@485` (46.09, -41.15); `734@503` (24.73, -34.87); `738@507` (-24.91, -3.53); `740@509` (-12.61, 24.17); `744@513` (-63.48, -35.70); `755@524` (57.37, -38.99); `761@530` (-26.96, -6.94); `770@538` (29.27, -45.89); `778@546` (-25.54, -4.38); `787@555` (-62.16, -24.17); `795@563` (-34.02, -8.47); `799@567` (-32.03, -8.72); `802@570` (54.03, -41.51); `810@578` (-28.70, -3.13); `811@579` (-28.11, -8.37); `813@581` (-24.61, -7.18); `814@582` (-25.52, -7.28); `815@583` (-26.40, -8.12); `819@587` (-28.03, -2.47); `823@591` (58.29, -38.90); `826@594` (-29.29, -8.13); `830@598` (17.66, -42.26); `831@599` (-61.58, -23.45); `838@606` (-27.15, -3.65); `839@607` (18.04, -18.38); `842@610` (-11.13, -45.48); `848@616` (18.73, -43.83); `849@617` (30.16, -35.00); `857@625` (24.27, -42.79); `858@626` (-27.19, -6.12); `859@627` (41.26, 49.98); `868@636` (-23.80, -3.89); `870@638` (13.42, 0.15); `871@639` (-27.03, -5.22); `872@640` (-27.81, -4.29); `873@641` (16.49, -16.79); `874@642` (-24.58, -4.38); `876@644` (16.76, -20.46); `877@645` (12.45, -2.61); `878@646` (-36.68, -14.67); `880@648` (-16.78, -11.68); `881@649` (-24.23, 1.21); `882@650` (-26.13, -6.60); `883@651` (-27.77, 7.35); `885@653` (24.64, -40.16); `886@654` (18.43, -0.58); `887@655` (-37.91, -12.98); `889@657` (17.85, -19.28); `890@658` (-43.86, 20.06); `892@660` (12.66, -27.21); `893@661` (15.85, -0.78); `895@663` (-18.34, -2.05); `896@664` (15.45, -30.67); `898@666` (-47.29, -22.28); `899@667` (-18.79, -18.89); `900@668` (12.58, -3.30); `901@669` (0.41, 44.23). Player (75.30, -6.40).
- `phase/cellar`, `step/wait` at 718.45 s, 80/80 unreachable: `222@54` (-15.62, 26.04); `356@179` (-18.51, 23.48); `376@198` (-19.32, 23.39); `378@200` (-19.48, 21.97); `382@203` (-15.62, 26.75); `411@231` (-15.62, 25.11); `433@252` (-16.45, 23.46); `435@253` (-15.27, 22.49); `444@262` (-15.62, 24.20); `454@272` (-12.48, 27.68); `484@296` (-31.04, -1.48); `486@298` (-14.27, 26.54); `533@343` (-15.04, 23.78); `581@354` (-26.91, -4.85); `582@355` (16.21, -28.83); `584@357` (-12.65, 24.89); `601@371` (-18.37, 21.87); `657@427` (-46.01, 51.45); `668@438` (-29.85, -8.95); `669@439` (76.66, 42.00); `670@440` (23.05, 47.47); `671@441` (52.86, 41.95); `712@481` (-62.20, -23.39); `715@484` (45.54, -20.14); `716@485` (45.78, -38.02); `734@503` (23.37, -36.65); `738@507` (-27.03, -3.94); `740@509` (-12.61, 24.17); `744@513` (-68.03, -39.65); `755@524` (57.28, -35.81); `761@530` (-25.54, -9.36); `770@538` (31.37, -43.85); `778@546` (-25.99, -4.35); `787@555` (-62.60, -25.33); `795@563` (-34.26, -8.49); `799@567` (-32.20, -8.73); `802@570` (54.22, -43.40); `810@578` (-28.68, -3.15); `811@579` (-28.74, -8.44); `813@581` (-24.31, -7.19); `814@582` (-27.02, -8.88); `815@583` (-27.83, -8.44); `819@587` (-28.02, -2.51); `823@591` (57.16, -41.84); `826@594` (-29.58, -8.07); `830@598` (16.09, -42.87); `831@599` (-62.38, -24.43); `838@606` (-27.82, -4.42); `839@607` (14.45, -20.35); `842@610` (-7.49, -44.01); `848@616` (18.87, -41.89); `849@617` (28.86, -35.00); `857@625` (23.29, -41.37); `858@626` (-27.82, -6.98); `859@627` (38.15, 54.34); `868@636` (-26.13, -3.35); `870@638` (17.30, 5.56); `871@639` (-27.05, -7.96); `872@640` (-27.69, -5.33); `873@641` (16.35, -19.28); `874@642` (-25.07, -4.38); `876@644` (15.94, -21.27); `877@645` (9.52, -6.85); `878@646` (-29.61, -18.18); `880@648` (-18.57, -8.33); `881@649` (-25.10, -1.09); `882@650` (-24.95, -6.53); `883@651` (-27.77, 7.34); `885@653` (18.09, -38.63); `886@654` (17.81, 5.05); `887@655` (-34.94, -15.94); `889@657` (15.53, -19.88); `890@658` (-42.05, 16.23); `892@660` (14.62, -21.55); `893@661` (18.44, -0.00); `895@663` (-14.97, 1.82); `896@664` (14.74, -22.86); `898@666` (-48.19, -22.27); `899@667` (-19.19, 5.99); `900@668` (10.90, -3.59). Player (74.65, -2.13).
- `phase/done` at 719.45 s, 80/80 unreachable: `222@54` (-15.62, 26.04); `356@179` (-18.51, 23.48); `376@198` (-19.32, 23.39); `378@200` (-19.48, 21.97); `382@203` (-15.62, 26.75); `411@231` (-15.62, 25.11); `433@252` (-16.45, 23.46); `435@253` (-15.27, 22.49); `444@262` (-15.62, 24.20); `454@272` (-12.48, 27.68); `484@296` (-31.04, -1.48); `486@298` (-14.27, 26.54); `533@343` (-15.04, 23.78); `581@354` (-26.77, -5.07); `582@355` (15.17, -26.40); `584@357` (-12.65, 24.89); `601@371` (-18.37, 21.87); `657@427` (-45.79, 51.47); `668@438` (-29.85, -8.95); `669@439` (76.66, 42.00); `670@440` (22.94, 47.51); `671@441` (52.86, 41.95); `712@481` (-62.20, -23.39); `715@484` (45.54, -20.09); `716@485` (45.76, -37.99); `734@503` (23.38, -36.70); `738@507` (-27.79, -3.32); `740@509` (-12.61, 24.17); `744@513` (-67.03, -38.89); `755@524` (56.62, -35.54); `761@530` (-26.31, -9.16); `770@538` (31.37, -43.85); `778@546` (-25.91, -4.38); `787@555` (-62.60, -25.33); `795@563` (-34.26, -8.49); `799@567` (-32.20, -8.73); `802@570` (55.21, -43.46); `810@578` (-28.70, -3.15); `811@579` (-28.90, -8.46); `813@581` (-24.31, -7.19); `814@582` (-27.16, -8.82); `815@583` (-27.99, -8.42); `819@587` (-28.04, -2.43); `823@591` (57.89, -42.72); `826@594` (-29.70, -8.01); `830@598` (17.30, -41.88); `831@599` (-62.38, -24.43); `838@606` (-27.82, -4.35); `839@607` (15.77, -22.68); `842@610` (-5.76, -43.90); `848@616` (17.85, -40.85); `849@617` (28.69, -36.43); `857@625` (23.12, -42.18); `858@626` (-27.82, -6.98); `859@627` (38.64, 55.52); `868@636` (-26.92, -4.16); `870@638` (16.23, 6.08); `871@639` (-27.19, -7.90); `872@640` (-27.70, -5.27); `873@641` (16.30, -21.93); `874@642` (-24.99, -4.38); `876@644` (18.11, -22.26); `877@645` (9.87, -6.09); `878@646` (-28.62, -18.67); `880@648` (-19.51, -5.76); `881@649` (-27.17, 0.58); `882@650` (-24.95, -6.53); `883@651` (-27.77, 7.34); `885@653` (18.30, -39.35); `886@654` (17.89, 5.66); `887@655` (-35.18, -15.58); `889@657` (15.69, -21.17); `890@658` (-42.11, 15.63); `892@660` (17.20, -22.15); `893@661` (18.45, -0.18); `895@663` (-15.23, -0.97); `896@664` (15.60, -23.57); `898@666` (-48.19, -22.27); `899@667` (-17.80, 5.19); `900@668` (10.87, -3.41). Player (74.65, -2.13).

## L5

Threat steps explicitly selected from the loaded mission definition:

- `look` — Look for anyone still alive (combat; L5-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/emerge — emerge: Unbar the cellar door | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/100 | 0/100 | (75.30, -5.39) | — |
| phase/cellar — controller: cellar | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/100 | 0/100 | (74.66, -1.77) | — |
| phase/emerged — controller: emerged | — | 138.00 player + 0.00 group/min; 2.78 s | 72.00 player + 0.00 group/min; 2.78 s | 100/100 | 100/100 | (-79.30, -44.28) | — |
| step/look — look: Look for anyone still alive | L5-05 | 599.87 player + 0.86 group/min; 0.18 s | 4.38 player + 0.00 group/min; 12.15 s | 100/100 | 45/45 | (37.61, -49.28) | — |
| phase/search — controller: search | — | 599.87 player + 0.86 group/min; 0.18 s | 4.38 player + 0.00 group/min; 12.15 s | 100/100 | 45/45 | (37.61, -49.28) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/emerge` at 0.02 s, 100/100 unreachable: `84@3` (-20.00, -37.60); `86@4` (-17.50, -36.10); `88@5` (-22.00, 10.00); `90@1` (46.00, 36.00); `91@6` (22.00, -37.40); `93@7` (-26.00, 40.00); `95@8` (-23.50, 41.50); `97@2` (-42.00, -41.50); `98@9` (2.00, 43.60); `100@10` (14.00, -2.00); `102@11` (-12.00, 18.00); `104@12` (44.00, -36.40); `106@13` (46.50, -34.90); `108@14` (-6.00, -37.40); `110@15` (10.00, 13.00); `112@16` (-46.00, -37.50); `114@17` (36.00, -37.40); `116@18` (-12.00, 43.60); `118@19` (14.00, -24.00); `120@20` (-60.00, 43.00); `122@21` (-4.00, 28.00); `124@22` (-40.00, -20.00); `126@23` (-8.90, 2.60); `128@24` (0.10, 2.60); `130@25` (53.50, 41.30); `132@26` (62.50, 41.30); `134@27` (-29.00, -2.70); `136@28` (-25.87, -44.40); `138@29` (-49.50, 50.00); `140@30` (-40.50, 50.00); `142@31` (68.00, -37.40); `144@32` (48.00, -12.00); `146@33` (40.00, 43.60); `148@34` (16.00, -12.00); `150@35` (4.00, -37.40); `152@36` (0.00, -12.00); `154@37` (-4.00, 14.00); `156@38` (-16.00, -12.00); `158@39` (-28.00, -37.40); `160@40` (-32.00, -12.00); `162@41` (-36.00, 14.00); `164@42` (-60.00, -37.40); `166@43` (-72.00, 43.60); `168@44` (64.00, 2.00); `170@45` (60.00, 28.00); `172@46` (48.00, 2.00); `174@47` (4.00, -24.00); `176@48` (-16.00, 2.00); `178@49` (-32.00, 2.00); `180@50` (-36.00, 28.00); `182@51` (56.00, -37.40); `184@52` (52.00, -12.00); `186@53` (48.00, 14.00); `188@54` (12.00, 43.60); `190@55` (8.00, -37.40); `192@56` (0.00, 14.00); `194@57` (-28.00, -12.00); `196@58` (-36.00, 43.60); `198@59` (-52.00, 43.60); `200@60` (-56.00, -37.40); `202@61` (-68.00, 43.60); `204@62` (64.00, 28.00); `206@63` (52.00, 2.00); `208@64` (48.00, 28.00); `210@65` (-16.00, 28.00); `212@66` (-28.00, 2.00); `214@67` (-32.00, 28.00); `216@68` (60.00, -37.40); `218@69` (52.00, 14.00); `220@70` (48.00, 43.60); `222@71` (32.00, 43.60); `224@72` (16.00, 43.60); `226@73` (12.00, -37.40); `228@74` (-8.00, -12.00); `230@75` (-24.00, -12.00); `232@76` (-40.00, -12.00); `234@77` (-48.00, 43.60); `236@78` (68.00, 28.00); `238@79` (56.00, 2.00); `240@80` (52.00, 28.00); `242@81` (-12.00, 28.00); `244@82` (-20.00, -24.00); `246@83` (-24.00, 2.00); `248@84` (-28.00, 28.00); `250@85` (68.00, 43.60); `252@86` (64.00, -37.40); `254@87` (36.00, 43.60); `256@88` (12.00, -12.00); `258@89` (-4.00, -12.00); `260@90` (-20.00, -12.00); `262@91` (-32.00, -37.40); `264@92` (-36.00, -12.00); `266@93` (-40.00, 14.00); `268@94` (-44.00, 43.60); `270@95` (-64.00, -37.40); `272@96` (-76.00, 43.60); `274@97` (60.00, 2.00); `276@98` (56.00, 28.00); `278@99` (48.00, -24.00); `280@100` (0.00, -24.00). Player (75.30, -5.39).
- `phase/cellar` at 1.00 s, 100/100 unreachable: `84@3` (-20.00, -37.60); `86@4` (-17.67, -36.22); `88@5` (-21.80, 9.90); `90@1` (46.00, 36.00); `91@6` (21.60, -37.20); `93@7` (-26.00, 40.00); `95@8` (-23.44, 41.39); `97@2` (-42.00, -41.50); `98@9` (2.30, 43.54); `100@10` (13.84, -2.29); `102@11` (-12.00, 17.98); `104@12` (43.89, -36.54); `106@13` (46.58, -35.10); `108@14` (-5.73, -37.26); `110@15` (10.01, 12.98); `112@16` (-46.14, -37.48); `114@17` (35.78, -37.29); `116@18` (-12.03, 43.62); `118@19` (13.92, -24.32); `120@20` (-60.11, 43.08); `122@21` (-4.05, 27.91); `124@22` (-40.01, -19.77); `126@23` (-8.90, 2.85); `128@24` (0.09, 2.55); `130@25` (53.22, 41.29); `132@26` (62.48, 41.30); `134@27` (-28.91, -2.70); `136@28` (-25.87, -44.40); `138@29` (-49.58, 49.96); `140@30` (-40.21, 49.83); `142@31` (68.43, -37.61); `144@32` (48.04, -11.61); `146@33` (39.95, 43.61); `148@34` (15.91, -12.28); `150@35` (4.00, -37.41); `152@36` (0.00, -12.04); `154@37` (-4.11, 14.00); `156@38` (-16.00, -11.80); `158@39` (-28.26, -37.27); `160@40` (-31.99, -11.99); `162@41` (-36.04, 14.18); `164@42` (-60.24, -37.41); `166@43` (-72.00, 43.60); `168@44` (64.08, 1.86); `170@45` (59.57, 28.24); `172@46` (48.09, 2.29); `174@47` (3.98, -23.99); `176@48` (-16.00, 2.00); `178@49` (-31.93, 2.07); `180@50` (-35.88, 27.98); `182@51` (55.92, -37.37); `184@52` (51.99, -11.99); `186@53` (48.37, 14.33); `188@54` (12.04, 43.79); `190@55` (8.00, -37.40); `192@56` (-0.01, 13.99); `194@57` (-27.96, -11.99); `196@58` (-35.96, 43.65); `198@59` (-52.03, 43.61); `200@60` (-56.15, -37.44); `202@61` (-68.14, 44.00); `204@62` (64.00, 28.00); `206@63` (51.80, 1.64); `208@64` (48.03, 27.99); `210@65` (-15.97, 28.00); `212@66` (-27.91, 1.81); `214@67` (-32.05, 28.01); `216@68` (60.19, -37.67); `218@69` (52.00, 14.03); `220@70` (48.45, 43.83); `222@71` (31.84, 43.72); `224@72` (15.72, 43.70); `226@73` (12.01, -37.38); `228@74` (-7.98, -11.89); `230@75` (-24.00, -12.00); `232@76` (-40.00, -12.00); `234@77` (-48.00, 43.60); `236@78` (67.97, 28.00); `238@79` (55.97, 1.98); `240@80` (51.92, 28.21); `242@81` (-12.00, 28.00); `244@82` (-20.14, -23.71); `246@83` (-23.66, 1.67); `248@84` (-28.06, 27.95); `250@85` (67.96, 43.71); `252@86` (64.11, -37.40); `254@87` (35.77, 43.72); `256@88` (12.20, -12.18); `258@89` (-3.69, -11.67); `260@90` (-20.03, -11.87); `262@91` (-31.69, -37.47); `264@92` (-36.00, -12.06); `266@93` (-39.85, 13.67); `268@94` (-44.00, 43.60); `270@95` (-64.14, -37.45); `272@96` (-76.17, 43.98); `274@97` (59.72, 1.84); `276@98` (55.97, 28.01); `278@99` (47.96, -24.07); `280@100` (-0.31, -23.83). Player (74.66, -1.77).
- `step/metro`, `phase/shelter` at 192.37 s, 37/37 unreachable: `90@104` (50.28, 39.61); `91@105` (11.26, -35.42); `93@106` (-25.36, 55.12); `97@108` (-41.70, -42.18); `98@109` (10.91, 42.15); `108@114` (-3.95, -41.09); `110@115` (-1.78, 2.28); `118@119` (13.11, -29.67); `120@120` (-63.68, 47.44); `128@124` (-15.51, 5.27); `132@126` (51.03, 44.72); `138@129` (-57.38, 46.25); `142@131` (80.47, -38.04); `146@133` (39.88, 46.90); `148@134` (15.49, -26.82); `150@135` (11.17, -42.88); `158@139` (-32.14, -38.88); `166@143` (-67.13, 45.14); `170@145` (52.61, 41.02); `172@146` (48.04, 4.34); `174@147` (-1.31, -15.55); `188@154` (33.74, 53.50); `190@155` (0.52, -38.79); `198@159` (-57.13, 41.93); `202@161` (-61.14, 47.28); `204@162` (51.29, 30.83); `220@170` (49.17, 45.92); `222@171` (28.39, 49.46); `226@173` (17.80, -28.51); `234@177` (-58.50, 48.36); `236@178` (71.94, 30.06); `240@180` (51.29, 21.93); `250@185` (62.77, 41.56); `252@186` (65.83, -39.31); `256@188` (11.11, -0.83); `272@196` (-66.71, 44.33); `280@200` (-3.96, -13.61). Player (38.28, -50.54).
- `phase/done` at 193.37 s, 38/38 unreachable: `90@104` (50.28, 39.61); `91@105` (11.26, -34.65); `93@106` (-25.36, 55.12); `97@108` (-41.70, -42.18); `98@109` (11.31, 41.02); `108@114` (-4.92, -40.33); `110@115` (-1.79, 2.33); `118@119` (13.66, -30.59); `120@120` (-62.67, 47.41); `128@124` (-16.45, 4.37); `132@126` (51.05, 44.67); `138@129` (-56.38, 45.82); `142@131` (80.47, -38.04); `146@133` (40.84, 47.87); `148@134` (15.04, -28.00); `150@135` (10.09, -42.23); `158@139` (-32.98, -38.07); `166@143` (-68.47, 45.24); `170@145` (51.60, 40.14); `172@146` (48.04, 4.34); `174@147` (-1.31, -15.55); `184@152` (50.97, -14.16); `188@154` (33.66, 53.74); `190@155` (1.54, -39.05); `198@159` (-57.01, 40.76); `202@161` (-61.08, 47.25); `204@162` (51.65, 29.88); `220@170` (48.89, 44.62); `222@171` (28.80, 48.46); `226@173` (18.02, -28.87); `234@177` (-58.50, 48.36); `236@178` (71.94, 30.06); `240@180` (52.41, 22.07); `250@185` (63.05, 42.54); `252@186` (64.80, -39.05); `256@188` (10.46, -0.58); `272@196` (-67.94, 44.41); `280@200` (-3.96, -13.61). Player (38.28, -50.54).

## L6

Threat steps explicitly selected from the loaded mission definition:

- `stop` — Stop the infected (combat; L6-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/shelter — shelter: Look around the shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| phase/shelter — controller: shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| step/stop — stop: Stop the infected | L6-05 | 139.89 player + 168.44 group/min; 2.08 s | 11.42 player + 28.55 group/min; 5.98 s | 20/20 | 2/2 | (0.33, 3.56) | — |
| phase/first — controller: first | — | 139.89 player + 168.44 group/min; 2.08 s | 11.42 player + 28.55 group/min; 5.98 s | 20/20 | 2/2 | (0.33, 3.56) | — |
| step/retreat — retreat: Cover the retreat through the tunnel | — | 685.15 player + 259.22 group/min; 0.03 s | 10.88 player + 8.80 group/min; 8.05 s | 30/30 | 16/16 | (0.33, 3.56) | — |
| phase/retreat — controller: retreat | — | 685.15 player + 259.22 group/min; 0.03 s | 10.88 player + 8.80 group/min; 8.05 s | 30/30 | 16/16 | (0.33, 3.56) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| l6.breach1 | l6.breach1 | 33.20 | 76.80 | 8 | 8 | — | 2.08 | — |
| l6.breach2 | l6.breach2 | 54.22 | 55.78 | 10 | 10 | — | 9.08 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## L7

Threat steps explicitly selected from the loaded mission definition:

- `corridor` — Bring the group to the evacuation corridor (combat; L7-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/rocket — rocket: Recover the rocket launcher beside the exit | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 98/98 | 98/98 | (273.01, 15.00) | — |
| phase/pickup — controller: pickup | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 98/98 | 98/98 | (273.01, 15.00) | — |
| step/corridor — corridor: Bring the group to the evacuation corridor | L7-05 | 160.87 player + 25.36 group/min; 0.80 s | 7.40 player + 0.00 group/min; 0.58 s | 96/96 | 59/59 | (-20.97, 47.84) | — |
| phase/encounters — controller: encounters | — | 182.00 player + 22.27 group/min; 0.80 s | 6.39 player + 0.00 group/min; 0.58 s | 98/98 | 1/1 | (-57.88, 47.26) | — |
| step/departure — departure: Get everyone aboard the bus | — | 190.40 player + 0.00 group/min; 0.07 s | 0.00 player + 0.00 group/min; — s | 98/98 | 0/0 | (35.94, 47.00) | — |
| phase/departing — controller: departing | — | 6.67 player + 0.00 group/min; 3.58 s | 0.00 player + 0.00 group/min; — s | 98/98 | 0/0 | (35.94, 47.00) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 99/99 | 0/0 | (40.00, 47.00) | — |

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
| step/escape — escape: Bring the survivors to the armored vehicle and board | L8-06 | 244.19 player + 8.23 group/min; 63.82 s | 1.91 player + 0.00 group/min; 61.97 s | 83/83 | 78/78 | (94.07, 77.20) | — |
| phase/sanctuary — controller: sanctuary | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (23.14, 64.15) | — |
| phase/breached — controller: breached | — | 430.63 player + 14.51 group/min; 3.82 s | 5.24 player + 0.00 group/min; 1.97 s | 83/83 | 78/78 | (94.07, 77.20) | — |
| step/depart — depart: Wait for everyone to board the armored vehicle | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 81/81 | 78/78 | (96.00, 74.00) | — |
| phase/boarding — controller: boarding | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 81/81 | 79/79 | (96.00, 74.00) | — |
| phase/run-out — level-end run-out | — | 24.00 player + 0.00 group/min; 2.65 s | — | 82/82 | — | (96.00, 74.00) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| tunnel-breach | L8 breachedAt/story.say | 60.00 | 84.58 | 12 | 12 | 3, 3, 3, 3 | 3.82 | — |
| tunnel-reinforcement@4200 | L8 nextWave clock | 70.00 | 74.58 | 16 | 16 | — | 2.98 | — |
| tunnel-reinforcement@4440 | L8 nextWave clock | 74.00 | 70.58 | 16 | 16 | — | 4.08 | — |
| tunnel-reinforcement@4680 | L8 nextWave clock | 78.00 | 66.58 | 16 | 16 | — | 2.92 | — |
| tunnel-reinforcement@4920 | L8 nextWave clock | 82.00 | 62.58 | 16 | 16 | — | 2.87 | — |
| tunnel-reinforcement@5160 | L8 nextWave clock | 86.00 | 58.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@5400 | L8 nextWave clock | 90.00 | 54.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@5640 | L8 nextWave clock | 94.00 | 50.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@5880 | L8 nextWave clock | 98.00 | 46.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6120 | L8 nextWave clock | 102.00 | 42.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6360 | L8 nextWave clock | 106.00 | 38.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6600 | L8 nextWave clock | 110.00 | 34.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6840 | L8 nextWave clock | 114.00 | 30.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7080 | L8 nextWave clock | 118.00 | 26.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7320 | L8 nextWave clock | 122.00 | 22.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7560 | L8 nextWave clock | 126.00 | 18.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7800 | L8 nextWave clock | 130.00 | 14.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8040 | L8 nextWave clock | 134.00 | 10.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8280 | L8 nextWave clock | 138.00 | 6.58 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8520 | L8 nextWave clock | 142.00 | 2.58 | 16 | 0 | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## L9

Threat steps explicitly selected from the loaded mission definition:

- None; roadside infected are still measured.

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/approach — approach: Drive toward the city | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 4/4 | 4/4 | (466.34, 3.29) | — |
| phase/driving — controller: driving | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 4/4 | 4/4 | (466.34, 3.29) | — |
| phase/approach — controller: approach | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 6/6 | 6/6 | (494.74, 1.14) | — |
| phase/fall — controller: fall | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 4/4 | 4/4 | (508.00, 0.00) | — |
| step/reach-outskirts — reach-outskirts: Get clear of the wreck | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 4/4 | 4/4 | (540.50, 0.87) | — |
| phase/impact — controller: impact | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 4/4 | 4/4 | (527.50, 2.60) | — |
| phase/crawl — controller: crawl | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 4/4 | 4/4 | (540.50, 0.87) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 4/4 | 4/4 | (547.00, 0.00) | — |

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
| step/military-zone — military-zone: Recover the machine gun at the checkpoint | — | 519.50 player + 0.00 group/min; 0.10 s | 8.36 player + 0.00 group/min; 36.52 s | 32/33 | 5/6 | (1849.80, 25.01) | — |
| step/research-campus — research-campus: Reach the research campus | — | 291.87 player + 0.00 group/min; 0.07 s | 12.17 player + 0.00 group/min; 12.08 s | 7/8 | 4/5 | (2457.69, -5.22) | — |
| step/research — research: Play the research recording | — | 355.61 player + 0.00 group/min; 1.27 s | 42.32 player + 0.00 group/min; 9.75 s | 52/53 | 31/32 | (2700.67, 41.45) | — |
| step/cure — cure: Pack the cure canister | — | 737.35 player + 0.00 group/min; 0.05 s | 0.00 player + 0.00 group/min; — s | 54/55 | 21/22 | (2705.10, 41.31) | — |
| step/research-exit — research-exit: Get the cure out of the laboratory | — | 642.24 player + 0.00 group/min; 0.42 s | 0.00 player + 0.00 group/min; — s | 53/54 | 0/1 | (2801.26, 44.78) | — |
| step/destroyed-corridor — destroyed-corridor: Carry the cure down the corridor and grab the rocket launcher | — | 875.59 player + 0.00 group/min; 0.08 s | 19.83 player + 0.00 group/min; 9.50 s | 54/55 | 18/19 | (2929.14, -4.99) | — |
| step/dispersal-complex — dispersal-complex: Bring the cure to the dispersal complex | — | 227.14 player + 0.00 group/min; 0.02 s | 5.54 player + 0.00 group/min; 43.53 s | 7/8 | 0/1 | (3687.65, -24.88) | — |
| step/install — install: Install the cure in the dispersal device | — | 298.66 player + 0.00 group/min; 0.03 s | 3.98 player + 0.00 group/min; 6.45 s | 19/20 | 0/1 | (4002.55, -37.13) | — |
| step/hold — hold: Charge the dispersal system | L10-11 | 977.53 player + 0.00 group/min; 0.15 s | 79.85 player + 0.00 group/min; 6.77 s | 94/95 | 37/38 | (4002.75, -28.71) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| dispersal-assault | L10 charge-active (not first spawn) | 990.72 | 59.98 | — | 75 | — | 4.67 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/industrial-area` at 190.28 s, 1/8 unreachable: `119@17` (1029.80, 80.00). Player (1252.90, 25.00).
- `step/military-zone` at 355.02 s, 1/6 unreachable: `119@17` (1496.54, 100.00). Player (1850.05, 25.01).
- `step/research-campus` at 528.15 s, 1/5 unreachable: `119@17` (1948.72, -75.00). Player (2462.27, -5.11).
- `step/research` at 590.77 s, 1/32 unreachable: `119@17` (2175.55, -75.00). Player (2697.03, 41.56).
- `step/cure` at 592.57 s, 1/22 unreachable: `119@17` (2182.07, -75.00). Player (2705.13, 41.31).
- `step/research-exit` at 614.02 s, 1/1 unreachable: `119@17` (2259.77, -75.00). Player (2801.59, 44.79).
- `step/destroyed-corridor` at 652.78 s, 1/19 unreachable: `119@17` (2397.00, -71.80). Player (2929.14, -4.99).
- `step/dispersal-complex` at 870.12 s, 1/1 unreachable: `119@17` (3015.85, 6.43). Player (3693.02, -24.95).
- `step/install` at 944.57 s, 1/1 unreachable: `119@17` (3274.58, 82.52). Player (3999.20, -35.56).
- `step/hold` at 1008.02 s, 1/38 unreachable: `119@17` (3494.02, 39.10). Player (4007.25, -16.31).
- `step/mega` at 1094.38 s, 1/1 unreachable: `119@17` (3797.00, -25.00). Player (3999.41, -28.99).

## Every fail flag

- None.

## Flag-to-criterion mapping

| Flag | Acceptance criterion |
|---|---|

Absolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.

## Defect triage provenance

Historical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.

Run `npm run qa:threat -- --maxWorkers=2` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat -- --maxWorkers=2`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.
