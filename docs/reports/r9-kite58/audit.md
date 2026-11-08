# Threat calibration

Runtime main: `d6ff72c1fb6c2243ac8595edc84f045b2ddde2ea`; harness base: `d0a02b22df99bacc9312f0438d68755f6301fb63`. Runtime source matches main: **false**. Seed 1 skilled routes include kiting; L5/L7 follower pace additionally uses unchanged native seeds 2–3. Passive native routes are unchanged, **low** population set before mission preparation. During a marked combat phase (including L5’s opening street encounter), at the first nearby pressing horde, the kiting policy walks away, aims back and fires the selected weapon continuously for a 20-second encounter sample, then walks back to the sampled route point and resumes the native route. Attack starts are infected windups targeting the courier, including interrupted windups; courier shots are not counted. The floor is **2 attacks/minute while kiting**; rows distinguish short samples. At most 4 simulation workers across independent levels or extra follower seeds; 324.49 seconds, budget 600 seconds. Result: **0 acceptance fail flags**.

[Raw audit receipts](audit.json).

## Measurement contract

Every active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.

Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.

Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median (L5/L7: the same follower/phase must fail in at least two valid seeds out of seeds 1–3); the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.

Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. The skilled route also gates zero windups in every inventoried combat phase, L2 bridge ≥2/min, L5 search ≥3/min, L10 hold ≥8/min and L6 mortal damage ≥30 HP. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing.

## Run coverage

| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |
|---|---|---:|---:|---:|---:|---:|
| L1 | complete | 115.17 | complete / firestation | 115.17 | 11 | 0 | 89.83 | 0 |
| L2 | complete | 152.95 | complete / bridge | 173.08 | 15 | 1 | 85.13 | 0 |
| L3 | complete | 219.90 | tick-budget / checkpoint | 70.00 | 6 | 3 | 144.40 | 0 |
| L4 | complete | 329.97 | tick-budget / hide | 248.50 | 8 | 26 | 187.59 | 0 |
| L5 | complete | 220.65 | tick-budget / look | 1200.00 | 5 | 0 | 288.13 | 0 |
| L6 | complete | 289.93 | tick-budget / retreat | 110.00 | 6 | 2 | 48.15 | 0 |
| L7 | complete | 103.28 | complete / bus-departure | 110.65 | 7 | 0 | 48.31 | 0 |
| L8 | complete | 95.38 | complete / depart | 143.50 | 6 | 20 | 56.81 | 0 |
| L9 | complete | 128.13 | complete / reach-outskirts | 128.13 | 8 | 0 | 23.91 | 0 |
| L10 | complete | 1288.02 | tick-budget / hold | 1049.72 | 12 | 1 | 87.62 | 0 |

## Kiting policy by level

| Level | Kiting seconds | Infected attack starts | Attacks/min while kiting | Floor | Verdict |
|---|---:|---:|---:|---:|---|
| L1 | 15.78 | 19 | 72.23 | ≥2/min when present | PASS |
| L2 | 20.00 | 1 | 3.00 | ≥2/min when present | PASS |
| L3 | 20.00 | 4 | 12.00 | ≥2/min when present | PASS |
| L4 | 20.45 | 20 | 58.68 | ≥2/min when present | PASS |
| L5 | 20.00 | 2 | 6.00 | ≥2/min when present | PASS |
| L6 | 20.00 | 1 | 3.00 | ≥2/min when present | PASS |
| L7 | 20.00 | 1 | 3.00 | ≥2/min when present | PASS |
| L8 | 20.00 | 6 | 18.00 | ≥2/min when present | PASS |
| L9 | 0.00 | 0 | 0.00 | ≥2/min when present | N/A: driving policy |
| L10 | 18.00 | 72 | 240.00 | ≥2/min when present | PASS |

## Acceptance criteria matrix

| Criterion | Passive measured | Skilled measured | Expected | Verdict |
|---|---:|---:|---|---|
| L1-08 | 32.41 | — | ≥ 3/min | PASS |
| L2-07 | 93.33 | — | ≥ 4/min | PASS |
| L2-07 reach | 100.00% | — | ≥ 90% | PASS |
| L2-12 | — | 17.17 | ≥ 2 and ≤ 20/min | PASS |
| L3-03 | 114.39 | — | ≥ 4/min | PASS |
| L3-03 reach | 100.00% | — | ≥ 90% | PASS |
| L4-07 | 916.11 | — | ≥ 6/min | PASS |
| L4-07 reach | 100.00% | — | ≥ 90% | PASS |
| L5-05 | 630.57 + 0.45 group | — | ≥ 3/min | PASS |
| L6-05 | 139.89 | — | ≥ 4/min | PASS |
| L6-05 reach | 100.00% | — | ≥ 95% | PASS |
| L6-06 | 100.00% | — | ≥ 95% | PASS |
| L7-05 | 51.37 + 50.70 group | — | ≥ 6/min | PASS |
| L8-06 | 164.51 + 8.29 group | — | ≥ 4/min | PASS |
| L10-11 | 821.51 | — | ≥ 8/min | PASS |
| G-13 | none | L5/complete/step/look/18: s1=104.0%(150), s2=100.4%(156), s3=100.6%(152); 0/3 fail; L5/complete/step/look/31: s1=103.7%(134), s2=100.0%(133), s3=99.2%(126); 0/3 fail; L5/complete/step/look/30: s1=100.0%(111), s2=99.8%(109), s3=100.5%(109); 0/3 fail; L5/complete/step/look/32: s1=99.6%(82), s2=101.2%(76), s3=100.0%(79); 0/3 fail; L5/complete/step/look/28: s1=98.7%(48), s2=97.4%(42), s3=96.7%(46); 0/3 fail; L5/complete/phase/search/18: s1=104.0%(150), s2=100.4%(156), s3=100.6%(152); 0/3 fail; L5/complete/phase/search/31: s1=103.7%(134), s2=100.0%(133), s3=99.2%(126); 0/3 fail; L5/complete/phase/search/30: s1=100.0%(111), s2=99.8%(109), s3=100.5%(109); 0/3 fail; L5/complete/phase/search/32: s1=99.6%(82), s2=101.2%(76), s3=100.0%(79); 0/3 fail; L5/complete/phase/search/28: s1=98.7%(48), s2=97.4%(42), s3=96.7%(46); 0/3 fail; L5/complete/step/metro/18: s1=100.0%(45), s2=105.1%(47), s3=101.1%(45); 0/3 fail; L5/complete/step/metro/28: s1=100.0%(45), s2=100.2%(47), s3=101.0%(45); 0/3 fail; L5/complete/step/metro/29: s1=100.0%(45), s2=100.6%(47), s3=100.5%(44); 0/3 fail; L5/complete/step/metro/30: s1=99.2%(44), s2=98.9%(47), s3=99.3%(45); 0/3 fail; L5/complete/step/metro/31: s1=100.0%(45), s2=99.8%(47), s3=99.3%(45); 0/3 fail; L5/complete/step/metro/32: s1=99.6%(45), s2=97.8%(47), s3=99.5%(46); 0/3 fail; L5/complete/phase/metro/18: s1=100.0%(45), s2=105.1%(47), s3=101.1%(45); 0/3 fail; L5/complete/phase/metro/28: s1=100.0%(45), s2=100.2%(47), s3=101.0%(45); 0/3 fail; L5/complete/phase/metro/29: s1=100.0%(45), s2=100.6%(47), s3=100.5%(44); 0/3 fail; L5/complete/phase/metro/30: s1=99.2%(44), s2=98.9%(47), s3=99.3%(45); 0/3 fail; L5/complete/phase/metro/31: s1=100.0%(45), s2=99.8%(47), s3=99.3%(45); 0/3 fail; L5/complete/phase/metro/32: s1=99.6%(45), s2=97.8%(47), s3=99.5%(46); 0/3 fail; L5/passive/step/look/18: s1=100.0%(28), s2=100.0%(28), s3=100.0%(2271); 0/3 fail; L5/passive/phase/search/18: s1=100.0%(28), s2=100.0%(28), s3=100.0%(2271); 0/3 fail; L5/28: 98.7% (48 samples); L5/31: 103.7% (134 samples); L7/complete/step/corridor/20: s1=100.0%(126), s2=100.0%(126), s3=100.0%(126); 0/3 fail; L7/complete/step/corridor/51: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/52: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/53: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/54: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/55: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/56: s1=100.0%(146), s2=100.0%(145), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/57: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/58: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/59: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/60: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/61: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/62: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/63: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/64: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/65: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/66: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/67: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/68: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/69: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/70: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/71: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/72: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/73: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/step/corridor/74: s1=100.0%(146), s2=100.0%(146), s3=100.0%(146); 0/3 fail; L7/complete/phase/encounters/20: s1=100.0%(142), s2=100.0%(137), s3=100.0%(132); 0/3 fail; L7/complete/phase/encounters/51: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/52: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/53: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/54: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/55: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/56: s1=100.0%(169), s2=100.0%(168), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/57: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/58: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/59: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/60: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/61: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/62: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/63: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/64: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/65: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/66: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/67: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/68: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/69: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/70: s1=100.0%(169), s2=100.0%(165), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/71: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/72: s1=100.0%(169), s2=100.0%(169), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/73: s1=100.0%(169), s2=100.0%(166), s3=100.0%(169); 0/3 fail; L7/complete/phase/encounters/74: s1=100.0%(169), s2=100.0%(168), s3=100.0%(169); 0/3 fail; L7/complete/step/departure/20: s1=98.4%(16), s2=98.8%(11), s3=unmeasured(6); 0/2 fail; L7/complete/step/departure/51: s1=100.8%(25), s2=101.2%(26), s3=101.1%(26); 0/3 fail; L7/complete/step/departure/52: s1=100.8%(25), s2=100.6%(26), s3=103.0%(26); 0/3 fail; L7/complete/step/departure/53: s1=100.8%(25), s2=100.1%(26), s3=105.1%(26); 0/3 fail; L7/complete/step/departure/54: s1=100.8%(25), s2=101.2%(26), s3=90.8%(26); 1/3 fail; L7/complete/step/departure/55: s1=99.4%(25), s2=100.8%(26), s3=106.4%(26); 0/3 fail; L7/complete/step/departure/56: s1=100.8%(25), s2=99.3%(26), s3=96.3%(26); 0/3 fail; L7/complete/step/departure/57: s1=100.1%(25), s2=101.2%(26), s3=103.3%(26); 0/3 fail; L7/complete/step/departure/58: s1=98.7%(25), s2=99.1%(26), s3=89.5%(26); 1/3 fail; L7/complete/step/departure/59: s1=98.7%(25), s2=98.2%(26), s3=92.9%(26); 1/3 fail; L7/complete/step/departure/60: s1=100.8%(25), s2=100.0%(26), s3=91.4%(26); 1/3 fail; L7/complete/step/departure/61: s1=99.7%(25), s2=99.0%(26), s3=92.8%(26); 1/3 fail; L7/complete/step/departure/62: s1=99.3%(25), s2=100.1%(26), s3=91.2%(26); 1/3 fail; L7/complete/step/departure/63: s1=97.9%(25), s2=99.0%(26), s3=102.6%(26); 0/3 fail; L7/complete/step/departure/64: s1=98.7%(25), s2=99.0%(26), s3=95.6%(26); 0/3 fail; L7/complete/step/departure/65: s1=100.8%(25), s2=100.6%(26), s3=94.5%(26); 1/3 fail; L7/complete/step/departure/66: s1=96.5%(25), s2=99.6%(26), s3=102.9%(26); 0/3 fail; L7/complete/step/departure/67: s1=100.1%(25), s2=100.7%(26), s3=108.0%(26); 0/3 fail; L7/complete/step/departure/68: s1=100.8%(25), s2=101.2%(26), s3=98.8%(26); 0/3 fail; L7/complete/step/departure/69: s1=99.9%(25), s2=99.1%(26), s3=97.5%(26); 0/3 fail; L7/complete/step/departure/70: s1=100.8%(25), s2=101.2%(22), s3=99.2%(26); 0/3 fail; L7/complete/step/departure/71: s1=99.4%(25), s2=99.0%(26), s3=100.8%(26); 0/3 fail; L7/complete/step/departure/72: s1=100.8%(25), s2=101.2%(26), s3=105.8%(26); 0/3 fail; L7/complete/step/departure/73: s1=98.7%(25), s2=97.0%(23), s3=110.5%(26); 0/3 fail; L7/complete/step/departure/74: s1=100.0%(25), s2=98.3%(25), s3=104.7%(26); 0/3 fail; L7/passive/step/corridor/20: s1=99.8%(101), s2=89.7%(90), s3=99.7%(107); 1/3 fail; L7/passive/step/corridor/53: s1=99.8%(38), s2=103.7%(13), s3=unmeasured(5); 0/2 fail; L7/passive/step/corridor/54: s1=99.8%(34), s2=unmeasured(5), s3=unmeasured(8); 0/1 fail; L7/passive/step/corridor/55: s1=100.0%(28), s2=unmeasured(6), s3=unmeasured(4); 0/1 fail; L7/passive/step/corridor/56: s1=115.1%(19), s2=unmeasured(8), s3=unmeasured(5); 0/1 fail; L7/passive/step/corridor/57: s1=107.0%(18), s2=unmeasured(4), s3=unmeasured(6); 0/1 fail; L7/passive/step/corridor/59: s1=114.8%(11), s2=unmeasured(7), s3=unmeasured(6); 0/1 fail; L7/passive/step/corridor/60: s1=67.2%(11), s2=unmeasured(4), s3=unmeasured(5); 1/1 fail; L7/passive/step/corridor/67: s1=96.7%(10), s2=unmeasured(6), s3=unmeasured(6); 0/1 fail; L7/passive/step/corridor/73: s1=100.3%(11), s2=unmeasured(8), s3=unmeasured(7); 0/1 fail; L7/passive/step/corridor/74: s1=100.9%(10), s2=unmeasured(9), s3=100.0%(10); 0/2 fail; L7/passive/step/corridor/52: s1=unmeasured(6), s2=100.0%(17), s3=unmeasured(5); 0/1 fail; L7/passive/step/corridor/51: s1=unmeasured(5), s2=unmeasured(4), s3=107.3%(15); 0/1 fail; L7/passive/phase/encounters/20: s1=99.8%(110), s2=89.7%(102), s3=99.7%(123); 1/3 fail; L7/passive/phase/encounters/53: s1=99.8%(38), s2=103.7%(13), s3=unmeasured(5); 0/2 fail; L7/passive/phase/encounters/54: s1=99.8%(34), s2=unmeasured(5), s3=unmeasured(8); 0/1 fail; L7/passive/phase/encounters/55: s1=100.0%(28), s2=unmeasured(6), s3=unmeasured(4); 0/1 fail; L7/passive/phase/encounters/56: s1=115.1%(19), s2=unmeasured(8), s3=unmeasured(5); 0/1 fail; L7/passive/phase/encounters/57: s1=107.0%(18), s2=unmeasured(4), s3=unmeasured(6); 0/1 fail; L7/passive/phase/encounters/59: s1=114.8%(11), s2=unmeasured(7), s3=unmeasured(6); 0/1 fail; L7/passive/phase/encounters/60: s1=67.2%(11), s2=unmeasured(4), s3=unmeasured(5); 1/1 fail; L7/passive/phase/encounters/67: s1=96.7%(10), s2=unmeasured(6), s3=unmeasured(6); 0/1 fail; L7/passive/phase/encounters/73: s1=100.3%(11), s2=unmeasured(8), s3=unmeasured(7); 0/1 fail; L7/passive/phase/encounters/74: s1=100.9%(10), s2=unmeasured(9), s3=100.0%(10); 0/2 fail; L7/passive/phase/encounters/52: s1=unmeasured(6), s2=100.0%(17), s3=unmeasured(5); 0/1 fail; L7/passive/phase/encounters/51: s1=unmeasured(5), s2=unmeasured(4), s3=107.3%(15); 0/1 fail; L7/passive/step/departure/20: s1=unmeasured(9), s2=100.0%(12), s3=100.0%(16); 0/2 fail; L7/60: 100.0% (169 samples); L7/63: 100.0% (169 samples); L8/354: 99.8% (31 samples); L8/359: 99.9% (32 samples); L8/362: 100.0% (32 samples); L8/363: 100.6% (32 samples); L8/364: 99.9% (32 samples); L8/365: 100.0% (32 samples); L8/366: 100.0% (32 samples); wait upper bounds: L5: 1.03%, L7: 1.54%, L8: 4.90% | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | PASS |
| L3-02 cohorts | 15/15, 25/25, 35/35 | 15/15, 25/25, 35/35 | 15/25/35 actual members on low tier | PASS |
| L3-02 stream | 16.73 s scheduled; 15 admitted; 15.93 s scheduled; 25 admitted; 16.65 s scheduled; 35 admitted | — | every cohort admitted within its ≤18 s stream | PASS |
| L3-02 alarm frame | 5/15 | — | ≥25% of opening wave on screen within 2 s | PASS |
| L3-03 first attack | 2.95 s | — | ≤10 s | PASS |
| L4-07 first attack | 8.83 s | — | ≤10 s | PASS |
| L3-06 squad counts/losses | — | 4 → army s1:4/s2:4/s3:0 (2/3 ≥2);  | 3–4 at fallback; ≥2 at army (PO 2026-11-07; seeds 1–3: ≥2 valid, ≥2 of them ≥2); every loss a bite/kill/separation | PASS |
| L3-07 squad hits and player damage | — | 2/3 seeds pass (s1:189 hits, 102.29999999999924HP, s2:157 hits, 11HP, s3:93 hits, 11HP) | officer hits>0; player damage<100HP; 2 of 3 valid seeds pass | PASS |
| L3-08 segment density and concurrent cap | — | 2/3 seeds pass (s1:15/21/29, s2:11/24/19, s3:17/23/25) | medianS1<S2<S3;max≤100 low; 2 of 3 valid seeds pass | PASS |
| L3-11 native competent rate | — | s1:30.19/min, s2:3.54/min, s3:12.11/min; 2/3 | 3–25 infected attacks against player/min; 2 of 3 valid seeds pass | PASS |
| L4-05 directions/groups | 6 edges; ≥60°: true; max group 5 | — | ≥3 edges ≥60° apart; groups ≤5 at each source | PASS |
| L4-06 first breach | 52.72 s level / +19.90 s alarm; 70 alive | — | level clock 30–60 s; ≥60 alive at first breach | PASS |
| L4-06 sustained horde | minimum 51; 8760 observations; line break 190.00 s | — | ≥40 living in authored plaza from alarm +45 s through line break | PASS |
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
| phase/spread — controller: spread | L1-08 | 32.41 player + 0.00 group/min; 12.75 s | 32.41 player + 0.00 group/min; 12.75 s | 26/26 | 26/26 | (-73.90, 40.46) | — |
| step/weapon — weapon: Find something to defend yourself | — | 22.27 player + 0.00 group/min; 12.73 s | 22.27 player + 0.00 group/min; 12.73 s | 20/20 | 20/20 | (23.29, 37.31) | — |
| step/firestation — firestation: Get inside the fire station | — | 39.10 player + 0.00 group/min; 0.02 s | 39.10 player + 0.00 group/min; 0.02 s | 26/26 | 26/26 | (-73.90, 40.46) | — |
| phase/run-out — level-end run-out | — | 156.00 player + 0.00 group/min; 0.37 s | 156.00 player + 0.00 group/min; 0.37 s | 28/28 | 28/28 | (-76.04, 41.15) | — |

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
| step/bridge — bridge: Reach the police checkpoint at the bridge | — | 185.01 player + 0.00 group/min; 3.28 s | 17.17 player + 0.00 group/min; 3.28 s | 0/2 | 0/23 | (81.40, 32.95) | — |
| phase/collapse — controller: collapse | L2-07 | 93.33 player + 0.00 group/min; 3.28 s | 31.47 player + 0.00 group/min; 3.28 s | 30/30 | 30/30 | (-12.02, 47.68) | — |
| phase/escape — controller: escape | L2-12 | 253.87 player + 0.00 group/min; 0.23 s | 14.03 player + 0.00 group/min; 11.22 s | 3/3 | 24/24 | (81.42, 37.78) | — |
| phase/checkpoint — controller: checkpoint | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/2 | 0/23 | (81.40, 32.95) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/2 | 0/23 | (81.40, 32.95) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| market-ambush | l2.doorsOpen | 58.60 | 114.48 | 24 | 24 | — | 3.28 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/bridge`, `phase/checkpoint` at 152.35 s, 23/23 unreachable: `185@2` (-23.96, -4.09); `201@10` (-26.33, -8.95); `209@14` (1.36, -4.18); `219@19` (-6.72, 16.03); `221@20` (-26.16, -9.85); `235@28` (-64.04, -1.82); `237@29` (-65.03, 12.03); `239@30` (-20.10, 47.44); `241@31` (-14.61, 47.96); `243@32` (-17.26, 46.91); `245@33` (-65.11, 23.47); `247@34` (-35.26, 29.56); `249@35` (36.29, -29.28); `255@38` (41.36, -34.80); `259@40` (-6.96, 48.11); `261@41` (-6.05, 48.11); `263@42` (12.69, 41.94); `275@48` (-33.83, 1.71); `277@49` (-26.38, 21.37); `279@50` (-11.51, 28.34); `281@51` (7.09, 26.24); `283@52` (25.15, 28.72); `295@58` (47.46, 28.12). Player (81.40, 32.96).
- `phase/done` at 152.95 s, 23/23 unreachable: `185@2` (-23.34, -4.03); `201@10` (-26.33, -8.13); `209@14` (2.91, -4.25); `219@19` (-6.05, 16.03); `221@20` (-26.17, -9.04); `235@28` (-64.87, -1.89); `237@29` (-65.03, 12.03); `239@30` (-19.48, 47.81); `241@31` (-15.39, 48.04); `243@32` (-17.29, 46.90); `245@33` (-65.08, 23.49); `247@34` (-35.19, 28.81); `249@35` (35.69, -29.12); `255@38` (41.36, -34.81); `259@40` (-6.69, 48.55); `261@41` (-5.92, 48.05); `263@42` (12.95, 41.40); `275@48` (-33.23, 1.34); `277@49` (-26.38, 21.37); `279@50` (-11.48, 28.38); `281@51` (6.51, 26.25); `283@52` (25.18, 28.89); `295@58` (47.46, 28.12). Player (81.40, 32.96).

## L3

Threat steps explicitly selected from the loaded mission definition:

- `defend` — Help defend the station (combat; L3-03).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/armory — armory: Take a handgun from the armory | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-139.91, -6.85) | — |
| phase/yard — controller: yard | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-134.95, 0.61) | — |
| step/defend — defend: Help defend the station | L3-03 | 114.39 player + 0.00 group/min; 2.95 s | 21.08 player + 0.00 group/min; 2.95 s | 26/26 | 21/21 | (-134.95, 0.61) | — |
| phase/attack — controller: attack | — | 114.39 player + 0.00 group/min; 2.95 s | 21.08 player + 0.00 group/min; 2.95 s | 26/26 | 21/21 | (-134.95, 0.61) | — |
| step/checkpoint — checkpoint: Get inside the army checkpoint | — | 839.08 player + 18.32 group/min; 0.05 s | 30.19 player + 9.74 group/min; 0.92 s | 52/53 | 0/40 | (-134.95, 0.61) | — |
| phase/fallback — controller: fallback | — | 839.08 player + 18.32 group/min; 0.05 s | 17.20 player + 5.73 group/min; 0.92 s | 52/53 | 6/6 | (-134.95, 0.61) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| station-0 | L3 scheduled wave.at (before admission) | 9.45 | 60.55 | 15 | 15 | — | 2.95 | — |
| station-1 | L3 scheduled wave.at (before admission) | 29.45 | 40.55 | 25 | 25 | — | 2.97 | — |
| station-2 | L3 scheduled wave.at (before admission) | 49.45 | 20.55 | 35 | 35 | — | 4.42 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/checkpoint`, `phase/corridor` at 219.45 s, 40/40 unreachable: `825@443` (198.96, 0.58); `897@479` (190.48, 1.37); `919@490` (190.60, -0.61); `939@500` (185.52, 3.04); `947@504` (191.33, -1.14); `955@508` (191.61, 0.55); `967@514` (177.38, -0.09); `981@521` (172.71, -0.66); `1791@902` (191.35, 2.27); `1793@903` (189.92, -0.83); `1795@904` (188.77, 1.90); `1797@905` (191.00, 0.89); `1799@906` (162.65, -2.92); `1961@979` (193.02, -1.03); `2063@1025` (169.30, -0.77); `2065@1026` (172.02, -0.68); `2067@1027` (179.65, 0.85); `2069@1028` (170.38, -0.77); `2071@1029` (144.15, 1.42); `2233@1102` (190.12, 0.55); `2235@1103` (190.79, 0.23); `2369@1164` (190.66, 2.15); `2371@1165` (190.99, 3.11); `2373@1166` (189.61, 1.04); `2377@1168` (191.17, 1.57); `2449@1202` (188.92, 1.00); `2451@1203` (188.96, 0.10); `2453@1204` (187.34, 2.55); `2455@1205` (187.88, 2.11); `2457@1206` (189.44, 1.73); `2467@1211` (174.06, -0.50); `2469@1212` (176.71, -0.21); `2471@1213` (179.00, 0.54); `2473@1214` (181.05, 1.31); `2475@1215` (175.00, -0.58); `2477@1216` (165.92, -0.94); `2479@1217` (167.91, -0.07); `2481@1218` (163.78, -3.58); `2483@1219` (164.38, -1.75); `2485@1220` (165.76, -1.62). Player (224.93, 1.19).
- `phase/done` at 219.90 s, 40/40 unreachable: `825@443` (198.96, 0.58); `897@479` (190.50, 1.37); `919@490` (190.47, -0.41); `939@500` (186.95, 2.86); `947@504` (191.17, -0.52); `955@508` (191.65, 0.62); `967@514` (178.83, 0.39); `981@521` (174.24, -0.52); `1791@902` (191.32, 2.35); `1793@903` (189.90, -0.81); `1795@904` (189.13, 1.68); `1797@905` (190.99, 0.86); `1799@906` (164.06, -2.39); `1961@979` (194.38, -1.74); `2063@1025` (170.83, -0.82); `2065@1026` (173.54, -0.59); `2067@1027` (181.05, 1.45); `2069@1028` (171.91, -0.82); `2071@1029` (143.77, 0.57); `2233@1102` (190.15, 0.21); `2235@1103` (191.13, 0.18); `2369@1164` (190.69, 2.04); `2371@1165` (190.99, 3.23); `2373@1166` (189.99, 0.89); `2377@1168` (191.39, 1.41); `2449@1202` (189.33, 0.70); `2451@1203` (188.96, 0.10); `2453@1204` (188.42, 1.67); `2455@1205` (188.71, 1.02); `2457@1206` (189.81, 1.57); `2467@1211` (175.58, -0.43); `2469@1212` (178.15, 0.23); `2471@1213` (180.43, 1.08); `2473@1214` (182.47, 1.90); `2475@1215` (176.47, -0.22); `2477@1216` (167.34, -0.90); `2479@1217` (169.32, -0.23); `2481@1218` (164.84, -2.65); `2483@1219` (165.73, -1.30); `2485@1220` (166.56, -1.10). Player (224.99, 0.21).

## L4

Threat steps explicitly selected from the loaded mission definition:

- `hold` — Hold the plaza with the army (combat; L4-07).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/ride — ride: Ride into Fairhaven with the convoy | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| phase/convoy — controller: convoy | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/quartermaster — quartermaster: Report to the quartermaster | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| phase/plaza — controller: plaza | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/hold — hold: Hold the plaza with the army | L4-07 | 916.11 player + 0.00 group/min; 8.83 s | 203.08 player + 0.00 group/min; 10.33 s | 80/80 | 79/79 | (-22.85, 0.74) | — |
| phase/war — controller: war | — | 916.11 player + 0.00 group/min; 8.83 s | 203.08 player + 0.00 group/min; 10.33 s | 80/80 | 79/79 | (-22.85, 0.74) | — |
| step/hide — hide: Run to the cellar via Lakeshore, Metro Road and Harbor Street | — | 633.10 player + 0.00 group/min; 0.23 s | 31.93 player + 0.00 group/min; 0.10 s | 80/80 | 80/80 | (-2.70, 19.88) | — |
| phase/collapse — controller: collapse | — | 633.10 player + 0.00 group/min; 0.23 s | 31.93 player + 0.00 group/min; 0.10 s | 80/80 | 80/80 | (-2.70, 19.88) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| war-0@1969 | l4.wave | 32.82 | 215.68 | 24 | 24 | — | 8.83 | — |
| war-1@2629 | l4.wave | 43.82 | 204.68 | 36 | 34 | — | 16.00 | — |
| breach-west | L4 breach.openAt | 52.72 | 195.78 | — | 107 | — | 8.28 | — |
| war-2@3289 | l4.wave | 54.82 | 193.68 | 48 | 23 | — | 86.68 | — |
| war-3@3949 | l4.wave | 65.82 | 182.68 | 54 | 14 | — | 150.25 | — |
| war--1@4009 | l4.wave | 66.82 | 181.68 | 15 | 4 | — | — | — |
| war-4@4609 | l4.wave | 76.82 | 171.68 | 54 | 0 | — | — | — |
| war-5@5269 | l4.wave | 87.82 | 160.68 | 54 | 0 | — | — | — |
| war-6@5929 | l4.wave | 98.82 | 149.68 | 54 | 0 | — | — | — |
| war-7@6589 | l4.wave | 109.82 | 138.68 | 54 | 0 | — | — | — |
| war-8@7249 | l4.wave | 120.82 | 127.68 | 54 | 0 | — | — | — |
| war-9@7909 | l4.wave | 131.82 | 116.68 | 54 | 0 | — | — | — |
| breach-north | L4 breach.openAt | 138.08 | 110.42 | — | 27 | — | 6.23 | — |
| war-10@8569 | l4.wave | 142.82 | 105.68 | 54 | 0 | — | — | — |
| war-11@9229 | l4.wave | 153.82 | 94.68 | 54 | 0 | — | — | — |
| war-12@9889 | l4.wave | 164.82 | 83.68 | 54 | 0 | — | — | — |
| breach-south | L4 breach.openAt | 173.73 | 74.77 | — | 4 | — | 5.65 | — |
| war-13@10549 | l4.wave | 175.82 | 72.68 | 54 | 0 | — | — | — |
| war-14@11209 | l4.wave | 186.82 | 61.68 | 54 | 0 | — | — | — |
| opening-alarm | L4 opening pending street cohorts | 32.82 | 215.68 | — | 0 | — | — | — |
| war-15@11869 | l4.wave | 197.82 | 50.68 | 54 | 0 | — | — | — |
| war-16@12529 | l4.wave | 208.82 | 39.68 | 54 | 0 | — | — | — |
| war-17@13189 | l4.wave | 219.82 | 28.68 | 54 | 0 | — | — | — |
| collapse-0@13609 | l4.wave | 226.82 | 21.68 | 6 | 0 | — | — | — |
| collapse-1@14149 | l4.wave | 235.82 | 12.68 | 6 | 0 | — | — | — |
| collapse-2@14689 | l4.wave | 244.82 | 3.68 | 6 | 0 | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/bar` at 321.80 s, 80/80 unreachable: `187@20` (-70.25, 43.46); `361@184` (-72.58, 45.55); `363@186` (-62.16, -39.20); `364@187` (-68.87, 43.58); `365@188` (-72.08, 42.82); `370@193` (-69.01, 44.85); `374@197` (-68.07, 47.18); `384@207` (-72.42, 43.55); `395@214` (-67.98, 44.38); `396@215` (-68.16, 43.71); `413@230` (-71.25, 42.79); `427@244` (-68.56, 42.81); `440@256` (-69.22, 42.99); `444@260` (-66.70, 45.44); `445@261` (-67.02, 46.04); `446@262` (-67.62, 46.40); `447@263` (-68.90, 47.51); `452@268` (-70.34, 45.31); `453@269` (-67.41, 45.47); `455@271` (-69.58, 46.35); `457@273` (-67.35, 44.77); `466@281` (-71.85, 46.60); `479@290` (-71.39, 43.48); `480@291` (-71.26, 44.49); `485@296` (-69.57, 43.59); `489@300` (-71.83, 44.09); `491@302` (-69.35, 44.25); `494@304` (-71.02, 45.15); `498@308` (-70.54, 44.63); `500@309` (-70.06, 44.13); `503@312` (-71.68, 45.77); `507@316` (-69.57, 45.65); `508@317` (-70.20, 46.69); `515@324` (-71.02, 46.68); `517@326` (-68.67, 44.25); `519@328` (-70.18, 45.99); `524@332` (-69.72, 44.99); `525@333` (-68.95, 45.98); `526@334` (-70.49, 47.37); `530@338` (-69.69, 47.14); `531@339` (-68.33, 46.39); `532@340` (-70.86, 45.83); `533@341` (-67.98, 45.07); `540@348` (-72.65, 44.44); `542@350` (-67.74, 43.10); `543@351` (-70.77, 43.97); `544@352` (-71.99, 44.98); `574@358` (-68.97, 46.66); `583@360` (-68.59, 45.40); `585@361` (-67.39, 43.92); `590@365` (-66.68, 44.52); `593@368` (-68.01, 45.79); `596@370` (-69.88, 42.79); `601@371` (-70.56, 42.85); `623@391` (18.36, 38.12); `628@396` (-29.27, 46.66); `630@398` (23.81, 47.70); `631@399` (45.76, -39.11); `632@400` (50.90, -45.72); `633@401` (53.98, -26.10); `640@408` (50.36, -43.18); `647@415` (27.26, -41.41); `648@416` (9.52, 2.06); `651@419` (18.32, -24.31); `653@421` (17.50, -25.12); `654@422` (13.62, -7.51); `655@423` (8.76, 2.84); `657@425` (21.30, -43.82); `659@427` (-20.74, 42.70); `660@428` (-21.50, 47.90); `661@429` (-15.45, -4.99); `662@430` (10.78, -4.05); `663@431` (-8.45, 43.78); `664@432` (14.15, -0.28); `665@433` (-15.58, 11.81); `666@434` (-23.66, 35.35); `667@435` (-23.41, 38.20); `668@436` (42.80, -37.31); `669@437` (54.71, -39.15); `670@438` (-6.81, 41.89). Player (75.30, -6.40).
- `phase/cellar`, `step/wait` at 328.97 s, 80/80 unreachable: `187@20` (-70.66, 43.46); `361@184` (-72.21, 46.71); `363@186` (-63.28, -39.54); `364@187` (-69.32, 43.78); `365@188` (-73.17, 45.31); `370@193` (-69.12, 44.82); `374@197` (-68.18, 47.35); `383@206` (1.04, 2.81); `384@207` (-72.52, 45.81); `395@214` (-68.21, 44.61); `396@215` (-68.67, 43.52); `403@222` (2.73, 52.00); `405@224` (-16.76, 9.09); `413@230` (-73.32, 43.19); `427@244` (-70.43, 42.79); `440@256` (-71.35, 42.91); `444@260` (-67.06, 45.39); `445@261` (-67.26, 46.32); `446@262` (-67.91, 46.52); `447@263` (-68.97, 47.79); `452@268` (-70.29, 45.47); `453@269` (-67.67, 45.75); `455@271` (-69.67, 46.44); `457@273` (-67.56, 44.92); `466@281` (-71.74, 46.03); `479@290` (-72.77, 43.81); `480@291` (-71.20, 44.64); `485@296` (-70.00, 43.62); `489@300` (-71.78, 44.28); `491@302` (-69.81, 44.29); `494@304` (-71.01, 45.32); `498@308` (-70.53, 44.82); `500@309` (-70.53, 44.14); `503@312` (-71.91, 45.18); `507@316` (-69.64, 45.73); `508@317` (-70.22, 46.89); `515@324` (-71.25, 46.82); `517@326` (-68.79, 44.21); `519@328` (-70.31, 46.16); `524@332` (-69.79, 45.00); `525@333` (-69.06, 46.12); `526@334` (-70.71, 47.50); `530@338` (-69.84, 47.57); `531@339` (-68.59, 46.62); `532@340` (-70.99, 46.00); `533@341` (-68.16, 45.28); `540@348` (-73.41, 44.42); `542@350` (-69.57, 42.89); `543@351` (-71.18, 43.93); `544@352` (-72.60, 44.65); `574@358` (-69.21, 46.97); `583@360` (-68.85, 45.45); `585@361` (-67.93, 43.89); `590@365` (-67.10, 44.25); `593@368` (-68.39, 45.95); `596@370` (-71.99, 43.48); `601@371` (-72.52, 42.82); `623@391` (14.89, 40.00); `628@396` (-32.85, 45.79); `630@398` (23.86, 53.92); `631@399` (45.82, -39.25); `632@400` (50.23, -41.28); `633@401` (53.34, -20.48); `640@408` (56.77, -45.47); `647@415` (25.89, -42.25); `648@416` (11.25, 1.95); `651@419` (17.18, -28.47); `653@421` (16.64, -29.35); `654@422` (15.84, -2.23); `655@423` (4.73, 3.02); `657@425` (20.97, -40.57); `659@427` (-18.24, 46.64); `660@428` (-20.91, 44.83); `662@430` (9.52, -1.19); `663@431` (-10.98, 41.08); `664@432` (13.54, 0.76); `666@434` (-19.68, 6.46); `668@436` (16.99, -33.54); `669@437` (68.70, -40.45); `670@438` (-3.17, 39.64). Player (74.65, -2.13).
- `phase/done` at 329.97 s, 80/80 unreachable: `187@20` (-70.72, 43.45); `361@184` (-72.40, 46.71); `363@186` (-63.28, -39.54); `364@187` (-69.38, 43.85); `365@188` (-73.23, 45.43); `370@193` (-69.16, 44.74); `374@197` (-68.16, 47.34); `383@206` (0.67, 2.82); `384@207` (-72.50, 45.80); `395@214` (-68.24, 44.62); `396@215` (-68.79, 43.48); `403@222` (2.95, 52.03); `405@224` (-16.76, 9.09); `413@230` (-72.88, 42.96); `416@233` (-13.68, 1.20); `427@244` (-70.48, 42.80); `440@256` (-71.38, 43.22); `444@260` (-67.09, 45.41); `445@261` (-67.24, 46.35); `446@262` (-67.92, 46.50); `447@263` (-68.94, 47.80); `452@268` (-70.30, 45.46); `453@269` (-67.70, 45.80); `455@271` (-69.67, 46.44); `457@273` (-67.59, 44.94); `466@281` (-71.74, 46.19); `479@290` (-72.94, 43.79); `480@291` (-71.15, 44.63); `485@296` (-70.04, 43.64); `489@300` (-71.80, 44.41); `491@302` (-69.96, 44.32); `494@304` (-70.98, 45.31); `498@308` (-70.49, 44.80); `500@309` (-70.65, 44.14); `503@312` (-71.80, 45.31); `507@316` (-69.64, 45.74); `508@317` (-70.20, 46.89); `515@324` (-71.08, 46.85); `517@326` (-68.77, 44.16); `519@328` (-70.30, 46.16); `524@332` (-69.79, 45.00); `525@333` (-69.05, 46.12); `526@334` (-70.69, 47.63); `530@338` (-69.82, 47.62); `531@339` (-68.61, 46.64); `532@340` (-70.98, 45.99); `533@341` (-68.19, 45.30); `540@348` (-73.34, 44.54); `542@350` (-69.61, 42.96); `543@351` (-71.31, 43.92); `544@352` (-72.57, 44.86); `574@358` (-69.23, 46.99); `583@360` (-69.02, 45.41); `585@361` (-67.96, 43.82); `590@365` (-67.16, 44.24); `593@368` (-68.38, 45.97); `596@370` (-72.20, 43.68); `601@371` (-72.05, 42.83); `623@391` (14.87, 40.01); `628@396` (-32.88, 45.77); `630@398` (23.87, 53.99); `631@399` (45.78, -39.26); `632@400` (50.16, -41.23); `633@401` (53.34, -20.40); `640@408` (56.91, -45.47); `647@415` (25.73, -42.05); `648@416` (11.41, 2.17); `653@421` (18.13, -29.27); `654@422` (16.27, -2.00); `655@423` (4.31, 3.02); `657@425` (21.09, -40.30); `659@427` (-17.73, 46.79); `660@428` (-21.51, 44.54); `662@430` (9.52, -0.96); `663@431` (-11.34, 41.08); `664@432` (13.19, 0.55); `666@434` (-19.42, 5.72); `668@436` (17.33, -31.41); `669@437` (69.19, -41.91); `670@438` (-2.40, 39.64). Player (74.65, -2.13).

## L5

Threat steps explicitly selected from the loaded mission definition:

- `look` — Look for anyone still alive (combat; L5-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/emerge — emerge: Unbar the cellar door | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/100 | 0/100 | (75.30, -5.39) | — |
| phase/cellar — controller: cellar | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/100 | 0/100 | (74.66, -1.77) | — |
| phase/emerged — controller: emerged | — | 138.00 player + 0.00 group/min; 2.52 s | 99.00 player + 0.00 group/min; 2.52 s | 100/100 | 100/100 | (-79.30, -44.28) | — |
| step/look — look: Look for anyone still alive | L5-05 | 630.57 player + 0.45 group/min; 0.10 s | 6.88 player + 0.00 group/min; 12.52 s | 100/100 | 45/45 | (37.54, -48.23) | — |
| phase/search — controller: search | — | 630.57 player + 0.45 group/min; 0.10 s | 6.88 player + 0.00 group/min; 12.52 s | 100/100 | 45/45 | (37.54, -48.23) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/emerge` at 0.02 s, 100/100 unreachable: `84@3` (-20.00, -37.60); `86@4` (-17.50, -36.10); `88@5` (-22.00, 10.00); `90@1` (46.00, 36.00); `91@6` (22.00, -37.40); `93@7` (-26.00, 40.00); `95@8` (-23.50, 41.50); `97@2` (-42.00, -41.50); `98@9` (2.00, 43.60); `100@10` (14.00, -2.00); `102@11` (-12.00, 18.00); `104@12` (44.00, -36.40); `106@13` (46.50, -34.90); `108@14` (-6.00, -37.40); `110@15` (10.00, 13.00); `112@16` (-46.00, -37.50); `114@17` (36.00, -37.40); `116@18` (-12.00, 43.60); `118@19` (14.00, -24.00); `120@20` (-60.00, 43.00); `122@21` (-4.00, 28.00); `124@22` (-40.00, -20.00); `126@23` (-8.90, 2.60); `128@24` (0.10, 2.60); `130@25` (53.50, 41.30); `132@26` (62.50, 41.30); `134@27` (-29.00, -2.70); `136@28` (-25.87, -44.40); `138@29` (-49.50, 50.00); `140@30` (-40.50, 50.00); `142@31` (68.00, -37.40); `144@32` (48.00, -12.00); `146@33` (40.00, 43.60); `148@34` (16.00, -12.00); `150@35` (4.00, -37.40); `152@36` (0.00, -12.00); `154@37` (-4.00, 14.00); `156@38` (-16.00, -12.00); `158@39` (-28.00, -37.40); `160@40` (-32.00, -12.00); `162@41` (-36.00, 14.00); `164@42` (-60.00, -37.40); `166@43` (-72.00, 43.60); `168@44` (64.00, 2.00); `170@45` (60.00, 28.00); `172@46` (48.00, 2.00); `174@47` (4.00, -24.00); `176@48` (-16.00, 2.00); `178@49` (-32.00, 2.00); `180@50` (-36.00, 28.00); `182@51` (56.00, -37.40); `184@52` (52.00, -12.00); `186@53` (48.00, 14.00); `188@54` (12.00, 43.60); `190@55` (8.00, -37.40); `192@56` (0.00, 14.00); `194@57` (-28.00, -12.00); `196@58` (-36.00, 43.60); `198@59` (-52.00, 43.60); `200@60` (-56.00, -37.40); `202@61` (-68.00, 43.60); `204@62` (64.00, 28.00); `206@63` (52.00, 2.00); `208@64` (48.00, 28.00); `210@65` (-16.00, 28.00); `212@66` (-28.00, 2.00); `214@67` (-32.00, 28.00); `216@68` (60.00, -37.40); `218@69` (52.00, 14.00); `220@70` (48.00, 43.60); `222@71` (32.00, 43.60); `224@72` (16.00, 43.60); `226@73` (12.00, -37.40); `228@74` (-8.00, -12.00); `230@75` (-24.00, -12.00); `232@76` (-40.00, -12.00); `234@77` (-48.00, 43.60); `236@78` (68.00, 28.00); `238@79` (56.00, 2.00); `240@80` (52.00, 28.00); `242@81` (-12.00, 28.00); `244@82` (-20.00, -24.00); `246@83` (-24.00, 2.00); `248@84` (-28.00, 28.00); `250@85` (68.00, 43.60); `252@86` (64.00, -37.40); `254@87` (36.00, 43.60); `256@88` (12.00, -12.00); `258@89` (-4.00, -12.00); `260@90` (-20.00, -12.00); `262@91` (-32.00, -37.40); `264@92` (-36.00, -12.00); `266@93` (-40.00, 14.00); `268@94` (-44.00, 43.60); `270@95` (-64.00, -37.40); `272@96` (-76.00, 43.60); `274@97` (60.00, 2.00); `276@98` (56.00, 28.00); `278@99` (48.00, -24.00); `280@100` (0.00, -24.00). Player (75.30, -5.39).
- `phase/cellar` at 1.00 s, 100/100 unreachable: `84@3` (-20.00, -37.60); `86@4` (-17.67, -36.22); `88@5` (-21.80, 9.90); `90@1` (46.00, 36.00); `91@6` (21.60, -37.20); `93@7` (-26.00, 40.00); `95@8` (-23.44, 41.39); `97@2` (-42.00, -41.50); `98@9` (2.30, 43.54); `100@10` (13.84, -2.29); `102@11` (-12.00, 17.98); `104@12` (43.89, -36.54); `106@13` (46.58, -35.10); `108@14` (-5.73, -37.26); `110@15` (10.01, 12.98); `112@16` (-46.14, -37.48); `114@17` (35.78, -37.29); `116@18` (-12.03, 43.62); `118@19` (13.92, -24.32); `120@20` (-60.11, 43.08); `122@21` (-4.05, 27.91); `124@22` (-40.01, -19.77); `126@23` (-8.90, 2.85); `128@24` (0.09, 2.55); `130@25` (53.22, 41.29); `132@26` (62.48, 41.30); `134@27` (-28.91, -2.70); `136@28` (-25.87, -44.40); `138@29` (-49.58, 49.96); `140@30` (-40.21, 49.83); `142@31` (68.43, -37.61); `144@32` (48.04, -11.61); `146@33` (39.95, 43.61); `148@34` (15.91, -12.28); `150@35` (4.00, -37.41); `152@36` (0.00, -12.04); `154@37` (-4.11, 14.00); `156@38` (-16.00, -11.80); `158@39` (-28.26, -37.27); `160@40` (-31.99, -11.99); `162@41` (-36.04, 14.18); `164@42` (-60.24, -37.41); `166@43` (-72.00, 43.60); `168@44` (64.08, 1.86); `170@45` (59.57, 28.24); `172@46` (48.09, 2.29); `174@47` (3.98, -23.99); `176@48` (-16.00, 2.00); `178@49` (-31.93, 2.07); `180@50` (-35.88, 27.98); `182@51` (55.92, -37.37); `184@52` (51.99, -11.99); `186@53` (48.37, 14.33); `188@54` (12.04, 43.79); `190@55` (8.00, -37.40); `192@56` (-0.01, 13.99); `194@57` (-27.96, -11.99); `196@58` (-35.96, 43.65); `198@59` (-52.03, 43.61); `200@60` (-56.15, -37.44); `202@61` (-68.14, 44.00); `204@62` (64.00, 28.00); `206@63` (51.80, 1.64); `208@64` (48.03, 27.99); `210@65` (-15.97, 28.00); `212@66` (-27.91, 1.81); `214@67` (-32.05, 28.01); `216@68` (60.19, -37.67); `218@69` (52.00, 14.03); `220@70` (48.45, 43.83); `222@71` (31.84, 43.72); `224@72` (15.72, 43.70); `226@73` (12.01, -37.38); `228@74` (-7.98, -11.89); `230@75` (-24.00, -12.00); `232@76` (-40.00, -12.00); `234@77` (-48.00, 43.60); `236@78` (67.97, 28.00); `238@79` (55.97, 1.98); `240@80` (51.92, 28.21); `242@81` (-12.00, 28.00); `244@82` (-20.14, -23.71); `246@83` (-23.66, 1.67); `248@84` (-28.06, 27.95); `250@85` (67.96, 43.71); `252@86` (64.11, -37.40); `254@87` (35.77, 43.72); `256@88` (12.20, -12.18); `258@89` (-3.69, -11.67); `260@90` (-20.03, -11.87); `262@91` (-31.69, -37.47); `264@92` (-36.00, -12.06); `266@93` (-39.85, 13.67); `268@94` (-44.00, 43.60); `270@95` (-64.14, -37.45); `272@96` (-76.17, 43.98); `274@97` (59.72, 1.84); `276@98` (55.97, 28.01); `278@99` (47.96, -24.07); `280@100` (-0.31, -23.83). Player (74.66, -1.77).
- `step/metro`, `phase/shelter` at 219.65 s, 33/33 unreachable: `90@104` (50.67, 41.38); `91@105` (13.02, -40.13); `97@108` (-41.70, -42.17); `98@109` (-0.44, 47.43); `112@116` (-73.91, -37.95); `116@118` (-8.47, 34.34); `118@119` (13.64, -34.87); `128@124` (-6.49, 15.01); `138@129` (-57.66, 45.35); `142@131` (69.39, -42.53); `148@134` (17.03, -6.81); `156@138` (-18.04, 1.77); `164@142` (-72.12, -42.40); `168@144` (59.89, 1.04); `174@147` (12.83, -24.45); `182@151` (62.41, -40.35); `188@154` (7.31, 48.02); `190@155` (17.17, -33.73); `200@160` (-76.21, -43.38); `202@161` (-59.90, 39.23); `204@162` (75.05, 30.82); `224@172` (30.37, 45.63); `226@173` (12.80, -32.63); `228@174` (-5.58, -8.68); `236@178` (62.61, 28.78); `244@182` (-15.87, -22.78); `246@183` (-21.44, -5.66); `250@185` (65.94, 42.56); `252@186` (59.58, -36.29); `270@195` (-76.35, -39.72); `272@196` (-70.85, 48.08); `276@198` (46.55, 36.58); `280@200` (-2.59, -16.95). Player (38.20, -50.07).
- `phase/done` at 220.65 s, 33/33 unreachable: `90@104` (50.67, 41.38); `91@105` (14.35, -39.83); `97@108` (-41.70, -42.17); `98@109` (-0.08, 48.57); `112@116` (-73.91, -37.95); `116@118` (-9.73, 34.24); `118@119` (12.59, -34.89); `128@124` (-6.49, 15.01); `138@129` (-57.77, 45.26); `142@131` (70.58, -42.01); `148@134` (17.02, -5.51); `156@138` (-18.62, 2.72); `164@142` (-71.31, -43.22); `168@144` (58.70, 1.19); `174@147` (12.82, -25.45); `182@151` (61.34, -40.76); `188@154` (8.44, 48.19); `190@155` (17.33, -33.07); `200@160` (-77.14, -42.59); `202@161` (-59.45, 40.28); `204@162` (75.05, 30.82); `224@172` (30.01, 45.51); `226@173` (13.27, -32.11); `228@174` (-5.62, -8.75); `236@178` (62.61, 28.78); `244@182` (-15.39, -22.63); `246@183` (-22.24, -6.80); `250@185` (65.10, 43.14); `252@186` (58.52, -36.31); `270@195` (-75.05, -39.94); `272@196` (-71.92, 47.47); `276@198` (46.33, 37.60); `280@200` (-2.40, -17.96). Player (38.20, -50.07).

## L6

Threat steps explicitly selected from the loaded mission definition:

- `stop` — Stop the infected (combat; L6-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/shelter — shelter: Look around the shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| phase/shelter — controller: shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| step/stop — stop: Stop the infected | L6-05 | 139.89 player + 168.44 group/min; 2.08 s | 11.42 player + 28.55 group/min; 5.98 s | 20/20 | 2/2 | (0.33, 3.56) | — |
| phase/first — controller: first | — | 139.89 player + 168.44 group/min; 2.08 s | 11.42 player + 28.55 group/min; 5.98 s | 20/20 | 2/2 | (0.33, 3.56) | — |
| step/retreat — retreat: Cover the retreat through the tunnel | — | 685.15 player + 259.22 group/min; 0.03 s | 13.03 player + 3.80 group/min; 8.05 s | 30/30 | 18/18 | (0.33, 3.56) | — |
| phase/retreat — controller: retreat | — | 685.15 player + 259.22 group/min; 0.03 s | 13.03 player + 3.80 group/min; 8.05 s | 30/30 | 18/18 | (0.33, 3.56) | — |

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
| step/corridor — corridor: Bring the group to the evacuation corridor | L7-05 | 51.37 player + 50.70 group/min; 0.80 s | 7.41 player + 0.00 group/min; 0.58 s | 96/96 | 60/60 | (-15.93, 47.91) | — |
| phase/encounters — controller: encounters | — | 48.51 player + 44.96 group/min; 0.80 s | 6.40 player + 0.00 group/min; 0.58 s | 96/96 | 2/2 | (-57.88, 47.26) | — |
| step/departure — departure: Get everyone aboard the bus | — | 14.65 player + 0.00 group/min; 0.10 s | 0.00 player + 0.00 group/min; — s | 98/98 | 0/0 | (35.94, 47.00) | — |
| phase/departing — controller: departing | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 98/98 | 0/0 | (35.94, 47.00) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 96/96 | 0/0 | (40.00, 47.00) | — |

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
| step/escape — escape: Bring the survivors to the armored vehicle and board | L8-06 | 164.51 player + 8.29 group/min; 62.52 s | 1.91 player + 0.00 group/min; 61.97 s | 70/70 | 77/77 | (92.39, 77.96) | — |
| phase/sanctuary — controller: sanctuary | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (23.14, 64.15) | — |
| phase/breached — controller: breached | — | 291.87 player + 14.71 group/min; 2.52 s | 5.24 player + 0.00 group/min; 1.97 s | 70/70 | 77/77 | (92.39, 77.96) | — |
| step/depart — depart: Wait for everyone to board the armored vehicle | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 73/73 | 77/77 | (96.00, 74.00) | — |
| phase/boarding — controller: boarding | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 73/73 | 77/77 | (96.00, 74.00) | — |
| phase/run-out — level-end run-out | — | 0.00 player + 0.00 group/min; — s | — | 74/74 | — | (96.00, 74.00) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| tunnel-breach | L8 breachedAt/story.say | 60.00 | 83.50 | 12 | 12 | 3, 3, 3, 3 | 2.52 | — |
| tunnel-reinforcement@4200 | L8 nextWave clock | 70.00 | 73.50 | 16 | 16 | — | 2.98 | — |
| tunnel-reinforcement@4440 | L8 nextWave clock | 74.00 | 69.50 | 16 | 16 | — | 3.12 | — |
| tunnel-reinforcement@4680 | L8 nextWave clock | 78.00 | 65.50 | 16 | 16 | — | 2.08 | — |
| tunnel-reinforcement@4920 | L8 nextWave clock | 82.00 | 61.50 | 16 | 16 | — | 2.07 | — |
| tunnel-reinforcement@5160 | L8 nextWave clock | 86.00 | 57.50 | 16 | 1 | — | — | — |
| tunnel-reinforcement@5400 | L8 nextWave clock | 90.00 | 53.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@5640 | L8 nextWave clock | 94.00 | 49.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@5880 | L8 nextWave clock | 98.00 | 45.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6120 | L8 nextWave clock | 102.00 | 41.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6360 | L8 nextWave clock | 106.00 | 37.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6600 | L8 nextWave clock | 110.00 | 33.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@6840 | L8 nextWave clock | 114.00 | 29.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7080 | L8 nextWave clock | 118.00 | 25.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7320 | L8 nextWave clock | 122.00 | 21.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7560 | L8 nextWave clock | 126.00 | 17.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@7800 | L8 nextWave clock | 130.00 | 13.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8040 | L8 nextWave clock | 134.00 | 9.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8280 | L8 nextWave clock | 138.00 | 5.50 | 16 | 0 | — | — | — |
| tunnel-reinforcement@8520 | L8 nextWave clock | 142.00 | 1.50 | 16 | 0 | — | — | — |

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
| step/residential-fringe — residential-fringe: Recover the handgun at the checkpoint | — | 155.49 player + 0.00 group/min; 5.32 s | 8.24 player + 0.00 group/min; 5.32 s | 7/7 | 5/5 | (763.90, 25.00) | — |
| step/industrial-area — industrial-area: Recover the shotgun at the checkpoint | — | 382.23 player + 0.00 group/min; 0.03 s | 7.68 player + 0.00 group/min; 28.43 s | 18/19 | 7/8 | (1247.11, 25.01) | — |
| step/military-zone — military-zone: Recover the machine gun at the checkpoint | — | 521.45 player + 0.00 group/min; 0.13 s | 8.36 player + 0.00 group/min; 36.52 s | 31/32 | 5/6 | (1850.23, 25.01) | — |
| step/research-campus — research-campus: Reach the research campus | — | 789.15 player + 0.00 group/min; 0.03 s | 12.17 player + 0.00 group/min; 12.08 s | 44/45 | 4/5 | (2457.06, -5.22) | — |
| step/research — research: Play the research recording | — | 765.10 player + 0.00 group/min; 0.02 s | 42.32 player + 0.00 group/min; 9.75 s | 54/55 | 31/32 | (2697.41, 41.55) | — |
| step/cure — cure: Pack the cure canister | — | 650.60 player + 0.00 group/min; 0.02 s | 0.00 player + 0.00 group/min; — s | 54/55 | 21/22 | (2705.13, 41.31) | — |
| step/research-exit — research-exit: Get the cure out of the laboratory | — | 607.68 player + 0.00 group/min; 0.08 s | 0.00 player + 0.00 group/min; — s | 54/55 | 0/1 | (2801.27, 44.78) | — |
| step/destroyed-corridor — destroyed-corridor: Carry the cure down the corridor and grab the rocket launcher | — | 892.37 player + 0.00 group/min; 0.08 s | 19.83 player + 0.00 group/min; 9.50 s | 54/55 | 18/19 | (2929.14, -4.99) | — |
| step/dispersal-complex — dispersal-complex: Bring the cure to the dispersal complex | — | 252.58 player + 0.00 group/min; 0.05 s | 5.54 player + 0.00 group/min; 43.53 s | 8/9 | 0/1 | (3692.44, -24.94) | — |
| step/install — install: Install the cure in the dispersal device | — | 352.09 player + 0.00 group/min; 0.05 s | 3.98 player + 0.00 group/min; 6.45 s | 20/21 | 0/1 | (4002.11, -36.93) | — |
| step/hold — hold: Charge the dispersal system | L10-11 | 821.51 player + 0.00 group/min; 0.10 s | 73.12 player + 0.00 group/min; 6.77 s | 94/95 | 29/30 | (4002.46, -28.80) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| dispersal-assault | L10 charge-active (not first spawn) | 989.73 | 59.98 | — | 74 | — | 4.67 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/industrial-area` at 190.28 s, 1/8 unreachable: `119@17` (1029.80, 80.00). Player (1252.90, 25.00).
- `step/military-zone` at 355.02 s, 1/6 unreachable: `119@17` (1496.54, 100.00). Player (1850.05, 25.01).
- `step/research-campus` at 528.15 s, 1/5 unreachable: `119@17` (1948.72, -75.00). Player (2462.27, -5.11).
- `step/research` at 590.77 s, 1/32 unreachable: `119@17` (2175.55, -75.00). Player (2697.03, 41.56).
- `step/cure` at 592.57 s, 1/22 unreachable: `119@17` (2182.07, -75.00). Player (2705.13, 41.31).
- `step/research-exit` at 614.02 s, 1/1 unreachable: `119@17` (2259.77, -75.00). Player (2801.59, 44.79).
- `step/destroyed-corridor` at 652.78 s, 1/19 unreachable: `119@17` (2397.00, -69.47). Player (2929.14, -4.99).
- `step/dispersal-complex` at 870.12 s, 1/1 unreachable: `119@17` (3050.92, 16.74). Player (3693.02, -24.95).
- `step/install` at 944.57 s, 1/1 unreachable: `119@17` (3320.88, 93.77). Player (3999.20, -35.56).
- `step/hold` at 1008.02 s, 1/30 unreachable: `119@17` (3549.59, 21.55). Player (3999.49, -39.11).
- `step/mega` at 1106.38 s, 1/1 unreachable: `119@17` (3895.53, -25.00). Player (4001.96, -26.28).

## Every fail flag

- None.

## Flag-to-criterion mapping

| Flag | Acceptance criterion |
|---|---|

Absolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.

## Defect triage provenance

Historical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.

Run `npm run qa:threat` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.
