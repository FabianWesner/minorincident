# Threat calibration

Runtime main: `c8d4a8024bd9660f25df29d49cc2ddafe0100575`; harness base: `c8d4a8024bd9660f25df29d49cc2ddafe0100575`. Runtime source matches main: **true**. Seed 1 skilled routes are native completion runs, with a separate disposable kiting probe; L5/L7 follower pace additionally uses unchanged native seeds 2–3. Passive native routes are unchanged, **low** population set before mission preparation. During a marked combat phase (including L5’s opening street encounter and L10’s regional street fights before the cure), at the first nearby pressing horde of at least three infected, the kiting policy walks away, aims back and fires the selected weapon continuously for a 20-second encounter sample, then ends that disposable probe. The native completion receipt and state hash come from the uninterrupted skilled route. Kiting receipts retain attack starts and separately count landed infected attacks with positive damage while the courier physically moves after the final physics commit; missed and interrupted windups and courier shots cannot satisfy the hit floor. Set MI_THREAT_KITING_STYLE=circles for the constant circular movement policy; the default is retreat kiting. The floor is **2 landed hits/minute while moving**; rows distinguish short samples. At most 4 simulation workers across independent levels or extra follower seeds; 395.90 seconds, budget 600 seconds. Result: **6 acceptance fail flags**.

[Raw audit receipts](audit.json).

## Measurement contract

Every active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.

Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.

Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median (L5/L7: the same follower/phase must fail in at least two valid seeds out of seeds 1–3); the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.

Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. L10 includes the living hunters already within 30 m at console activation, alongside new assault admissions. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. Skilled completion is required for every level, alongside zero-windup checks in inventoried combat phases, L2 bridge ≥2/min, L5 search ≥3/min and L6 mortal damage ≥30 HP. L10’s ≥8/min floor applies to its stationary ground policy; the skilled route uses the protected mounted platform. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, 150 s for L8, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing. Redesigned route budgets are 600 s for L9 and 1,800 s for L10, including ordinary retries.

## Run coverage

| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |
|---|---|---:|---:|---:|---:|---:|
| L1 | complete | 115.07 | complete / firestation | 115.07 | 11 | 0 | 23.68 | 0 |
| L2 | complete | 148.32 | complete / bridge | 253.95 | 15 | 1 | 40.63 | 0 |
| L3 | complete | 193.40 | tick-budget / checkpoint | 70.00 | 6 | 3 | 248.56 | 0 |
| L4 | complete | 507.57 | tick-budget / hide | 250.00 | 8 | 26 | 221.02 | 0 |
| L5 | complete | 228.32 | tick-budget / look | 1200.00 | 5 | 0 | 242.56 | 0 |
| L6 | complete | 296.73 | tick-budget / retreat | 110.00 | 6 | 2 | 90.20 | 0 |
| L7 | complete | 128.67 | complete / bus-departure | 152.08 | 7 | 0 | 125.10 | 5 |
| L8 | complete | 176.78 | tick-budget / escape | 150.00 | 4 | 2 | 66.76 | 0 |
| L9 | complete | 217.37 | complete / reach-outskirts | 264.92 | 8 | 0 | 92.40 | 0 |
| L10 | complete | 1015.02 | tick-budget / hold | 941.45 | 11 | 1 | 259.96 | 1 |

## Kiting policy by level

The circle policy runs clockwise around a fixed walkable centre, at full run speed, for the same 20-second window. Radius is 4 m, reduced to 3 or 2 m when needed for the floor plan. Direct movement input avoids inherited click-route smoothing; local steering avoids live bodies and keeps the courier on supported ground. The centre stays fixed. It requires physical movement for at least 95% of controllable ticks; successful enemy pins/staggers are reported separately. Only hits while physically moving count, and their rate still uses the entire encounter window.

| Level | Style | Seconds | Moving seconds | Immobilized seconds | Attack starts | Hits landed while moving | Hits/min | Floor | Verdict |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| L1 | retreat | 20.00 | 20.00 | 0.00 | 14 | 7 | 21.00 | ≥2 landed/min when present | PASS |
| L2 | retreat | 20.00 | 20.00 | 0.00 | 1 | 1 | 3.00 | ≥2 landed/min when present | PASS |
| L3 | retreat | 20.00 | 20.00 | 0.00 | 2 | 1 | 3.00 | ≥2 landed/min when present | PASS |
| L4 | retreat | 19.17 | 19.17 | 0.00 | 23 | 8 | 25.04 | ≥2 landed/min when present | PASS |
| L5 | retreat | 20.00 | 20.00 | 0.00 | 1 | 1 | 3.00 | ≥2 landed/min when present | PASS |
| L6 | retreat | 20.00 | 20.00 | 0.00 | 5 | 4 | 12.00 | ≥2 landed/min when present | PASS |
| L7 | retreat | 20.00 | 20.00 | 0.00 | 12 | 1 | 3.00 | ≥2 landed/min when present | PASS |
| L8 | retreat | 18.00 | 18.00 | 0.00 | 16 | 10 | 33.33 | ≥2 landed/min when present | PASS |
| L9 | retreat | 0.00 | — | — | 0 | 0 | 0.00 | ≥2 landed/min when present | N/A: driving policy |
| L10 | retreat | 20.00 | 20.00 | 0.00 | 2 | 0 | 0.00 | ≥2 landed/min when present | FAIL |

## Acceptance criteria matrix

| Criterion | Passive measured | Skilled measured | Expected | Verdict |
|---|---:|---:|---|---|
| L1-08 | 32.49 | — | ≥ 3/min | PASS |
| L2-07 | 141.33 | — | ≥ 4/min | PASS |
| L2-07 reach | 100.00% | — | ≥ 90% | PASS |
| L2-12 | — | 23.41 | ≥ 2 and ≤ 20/min | FAIL |
| L3-03 | 79.70 | — | ≥ 4/min | PASS |
| L3-03 reach | 100.00% | — | ≥ 90% | PASS |
| L4-07 | 1126.42 | — | ≥ 6/min | PASS |
| L4-07 reach | 100.00% | — | ≥ 90% | PASS |
| L5-05 | 411.85 + 0.71 group | — | ≥ 3/min | PASS |
| L6-05 | 165.58 | — | ≥ 4/min | PASS |
| L6-05 reach | 100.00% | — | ≥ 95% | PASS |
| L6-06 | 100.00% | — | ≥ 95% | PASS |
| L7-05 | 245.37 + 242.19 group | — | ≥ 6/min | PASS |
| L8-06 | 222.67 + 55.33 group | — | ≥ 4/min | PASS |
| L10-11 | 479.55 | — | ≥ 8/min | PASS |
| G-13 | 20 (78% of group median), 64 (92% of group median), 68 (79% of group median), 74 (90% of group median) | L5/complete/step/look/18: s1=100.3%(151), s2=103.5%(153), s3=101.6%(151); 0/3 fail; L5/complete/step/look/31: s1=100.0%(126), s2=99.2%(128), s3=100.7%(123); 0/3 fail; L5/complete/step/look/30: s1=100.1%(104), s2=100.0%(106), s3=99.6%(104); 0/3 fail; L5/complete/step/look/32: s1=98.9%(77), s2=100.1%(77), s3=100.0%(75); 0/3 fail; L5/complete/step/look/28: s1=97.8%(42), s2=95.1%(42), s3=95.4%(41); 0/3 fail; L5/complete/phase/search/18: s1=100.3%(151), s2=103.5%(153), s3=101.6%(151); 0/3 fail; L5/complete/phase/search/31: s1=100.0%(126), s2=99.2%(128), s3=100.7%(123); 0/3 fail; L5/complete/phase/search/30: s1=100.1%(104), s2=100.0%(106), s3=99.6%(104); 0/3 fail; L5/complete/phase/search/32: s1=98.9%(77), s2=100.1%(77), s3=100.0%(75); 0/3 fail; L5/complete/phase/search/28: s1=97.8%(42), s2=95.1%(42), s3=95.4%(41); 0/3 fail; L5/complete/step/metro/18: s1=104.8%(60), s2=100.9%(42), s3=101.3%(44); 0/3 fail; L5/complete/step/metro/32: s1=100.2%(59), s2=99.7%(42), s3=99.7%(46); 0/3 fail; L5/complete/step/metro/29: s1=99.8%(57), s2=100.2%(41), s3=100.7%(44); 0/3 fail; L5/complete/step/metro/30: s1=105.2%(55), s2=100.8%(43), s3=100.3%(42); 0/3 fail; L5/complete/step/metro/31: s1=98.5%(58), s2=99.7%(42), s3=98.6%(45); 0/3 fail; L5/complete/step/metro/28: s1=94.5%(58), s2=99.8%(42), s3=99.2%(44); 1/3 fail; L5/complete/phase/metro/18: s1=104.8%(60), s2=100.9%(42), s3=101.1%(43); 0/3 fail; L5/complete/phase/metro/32: s1=100.2%(59), s2=99.7%(42), s3=99.9%(44); 0/3 fail; L5/complete/phase/metro/29: s1=99.8%(57), s2=100.2%(41), s3=101.0%(42); 0/3 fail; L5/complete/phase/metro/30: s1=105.2%(55), s2=100.8%(43), s3=100.1%(42); 0/3 fail; L5/complete/phase/metro/31: s1=98.5%(58), s2=99.7%(42), s3=99.6%(43); 0/3 fail; L5/complete/phase/metro/28: s1=94.5%(58), s2=99.8%(42), s3=99.6%(43); 1/3 fail; L5/passive/step/look/18: s1=100.0%(25), s2=100.0%(15), s3=100.0%(15); 0/3 fail; L5/passive/phase/search/18: s1=100.0%(25), s2=100.0%(15), s3=100.0%(15); 0/3 fail; L5/28: 97.8% (42 samples); L5/31: 100.0% (126 samples); L7/complete/step/corridor/20: s1=100.0%(129), s2=100.0%(116), s3=100.0%(122); 0/3 fail; L7/complete/step/corridor/51: s1=100.0%(141), s2=100.2%(140), s3=100.1%(140); 0/3 fail; L7/complete/step/corridor/52: s1=100.0%(141), s2=100.0%(139), s3=100.0%(140); 0/3 fail; L7/complete/step/corridor/53: s1=100.0%(143), s2=100.0%(138), s3=100.0%(140); 0/3 fail; L7/complete/step/corridor/54: s1=100.0%(141), s2=100.0%(138), s3=100.0%(140); 0/3 fail; L7/complete/step/corridor/55: s1=100.0%(141), s2=100.0%(138), s3=100.0%(142); 0/3 fail; L7/complete/step/corridor/56: s1=100.0%(140), s2=100.0%(142), s3=100.0%(140); 0/3 fail; L7/complete/step/corridor/57: s1=100.0%(141), s2=100.0%(138), s3=100.0%(142); 0/3 fail; L7/complete/step/corridor/58: s1=100.0%(141), s2=100.0%(140), s3=100.0%(140); 0/3 fail; L7/complete/step/corridor/59: s1=100.0%(142), s2=100.0%(142), s3=100.0%(138); 0/3 fail; L7/complete/step/corridor/60: s1=100.0%(144), s2=100.0%(142), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/61: s1=100.0%(145), s2=100.0%(146), s3=100.0%(142); 0/3 fail; L7/complete/step/corridor/62: s1=100.0%(144), s2=100.0%(145), s3=100.0%(144); 0/3 fail; L7/complete/step/corridor/63: s1=100.0%(144), s2=100.0%(144), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/64: s1=100.0%(146), s2=100.0%(142), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/65: s1=100.0%(145), s2=100.0%(143), s3=100.1%(145); 0/3 fail; L7/complete/step/corridor/66: s1=100.0%(144), s2=100.0%(144), s3=100.0%(144); 0/3 fail; L7/complete/step/corridor/67: s1=100.0%(145), s2=100.0%(144), s3=100.0%(143); 0/3 fail; L7/complete/step/corridor/68: s1=100.0%(145), s2=100.0%(148), s3=100.0%(145); 0/3 fail; L7/complete/step/corridor/69: s1=100.0%(145), s2=100.0%(145), s3=100.0%(144); 0/3 fail; L7/complete/step/corridor/70: s1=100.0%(147), s2=100.0%(147), s3=100.0%(145); 0/3 fail; L7/complete/step/corridor/71: s1=100.0%(146), s2=100.0%(147), s3=100.0%(144); 0/3 fail; L7/complete/step/corridor/72: s1=100.0%(146), s2=100.0%(146), s3=100.0%(145); 0/3 fail; L7/complete/step/corridor/73: s1=100.0%(147), s2=100.0%(148), s3=100.0%(145); 0/3 fail; L7/complete/step/corridor/74: s1=100.0%(147), s2=100.0%(146), s3=100.0%(145); 0/3 fail; L7/complete/phase/encounters/20: s1=100.0%(141), s2=100.0%(136), s3=100.0%(142); 0/3 fail; L7/complete/phase/encounters/51: s1=100.0%(157), s2=100.0%(160), s3=100.1%(157); 0/3 fail; L7/complete/phase/encounters/52: s1=100.0%(161), s2=100.0%(159), s3=100.0%(161); 0/3 fail; L7/complete/phase/encounters/53: s1=100.0%(166), s2=100.1%(154), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/54: s1=100.0%(164), s2=100.0%(160), s3=100.0%(160); 0/3 fail; L7/complete/phase/encounters/55: s1=100.0%(162), s2=100.0%(152), s3=100.0%(164); 0/3 fail; L7/complete/phase/encounters/56: s1=100.0%(161), s2=100.0%(163), s3=100.0%(159); 0/3 fail; L7/complete/phase/encounters/57: s1=100.0%(160), s2=100.0%(154), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/58: s1=100.0%(153), s2=100.0%(159), s3=100.0%(159); 0/3 fail; L7/complete/phase/encounters/59: s1=100.0%(165), s2=100.0%(158), s3=100.0%(159); 0/3 fail; L7/complete/phase/encounters/60: s1=100.0%(166), s2=100.0%(160), s3=100.0%(163); 0/3 fail; L7/complete/phase/encounters/61: s1=100.0%(170), s2=100.0%(164), s3=100.0%(162); 0/3 fail; L7/complete/phase/encounters/62: s1=100.0%(168), s2=100.0%(164), s3=100.0%(165); 0/3 fail; L7/complete/phase/encounters/63: s1=100.0%(169), s2=100.0%(162), s3=100.0%(165); 0/3 fail; L7/complete/phase/encounters/64: s1=100.0%(159), s2=100.0%(164), s3=100.0%(165); 0/3 fail; L7/complete/phase/encounters/65: s1=100.0%(171), s2=100.0%(160), s3=100.1%(167); 0/3 fail; L7/complete/phase/encounters/66: s1=100.0%(164), s2=100.0%(163), s3=100.0%(166); 0/3 fail; L7/complete/phase/encounters/67: s1=100.0%(170), s2=100.0%(164), s3=100.0%(165); 0/3 fail; L7/complete/phase/encounters/68: s1=100.0%(169), s2=100.0%(170), s3=100.0%(167); 0/3 fail; L7/complete/phase/encounters/69: s1=100.0%(170), s2=100.0%(162), s3=100.0%(166); 0/3 fail; L7/complete/phase/encounters/70: s1=100.0%(170), s2=100.0%(165), s3=100.0%(167); 0/3 fail; L7/complete/phase/encounters/71: s1=100.0%(171), s2=100.0%(163), s3=100.0%(166); 0/3 fail; L7/complete/phase/encounters/72: s1=100.0%(171), s2=100.0%(166), s3=100.0%(167); 0/3 fail; L7/complete/phase/encounters/73: s1=100.0%(172), s2=100.0%(163), s3=100.0%(167); 0/3 fail; L7/complete/phase/encounters/74: s1=100.0%(172), s2=100.0%(165), s3=100.0%(167); 0/3 fail; L7/complete/step/departure/20: s1=92.1%(12), s2=78.1%(21), s3=99.9%(23); 2/3 fail; L7/complete/step/departure/51: s1=103.2%(16), s2=102.2%(21), s3=100.1%(20); 0/3 fail; L7/complete/step/departure/52: s1=99.0%(20), s2=87.0%(20), s3=102.2%(24); 1/3 fail; L7/complete/step/departure/53: s1=105.5%(23), s2=105.3%(18), s3=100.0%(25); 0/3 fail; L7/complete/step/departure/54: s1=100.3%(23), s2=89.6%(25), s3=102.3%(23); 1/3 fail; L7/complete/step/departure/55: s1=99.3%(24), s2=103.0%(16), s3=94.7%(25); 1/3 fail; L7/complete/step/departure/56: s1=100.4%(21), s2=94.2%(22), s3=102.3%(22); 1/3 fail; L7/complete/step/departure/57: s1=100.8%(20), s2=100.5%(18), s3=99.9%(23); 0/3 fail; L7/complete/step/departure/58: s1=97.7%(12), s2=87.5%(22), s3=100.4%(22); 1/3 fail; L7/complete/step/departure/59: s1=93.2%(24), s2=99.3%(17), s3=100.1%(24); 1/3 fail; L7/complete/step/departure/60: s1=100.0%(22), s2=92.3%(18), s3=101.7%(23); 1/3 fail; L7/complete/step/departure/61: s1=83.9%(28), s2=101.1%(19), s3=99.8%(23); 1/3 fail; L7/complete/step/departure/62: s1=101.4%(24), s2=100.0%(22), s3=101.2%(24); 0/3 fail; L7/complete/step/departure/63: s1=96.4%(26), s2=99.9%(18), s3=98.5%(25); 0/3 fail; L7/complete/step/departure/64: s1=101.2%(13), s2=93.5%(24), s3=91.6%(25); 2/3 fail; L7/complete/step/departure/65: s1=98.0%(29), s2=102.9%(19), s3=94.6%(25); 1/3 fail; L7/complete/step/departure/66: s1=100.6%(23), s2=98.6%(19), s3=98.1%(25); 0/3 fail; L7/complete/step/departure/67: s1=100.1%(28), s2=105.3%(23), s3=98.6%(25); 0/3 fail; L7/complete/step/departure/68: s1=86.2%(25), s2=105.3%(25), s3=79.0%(25); 2/3 fail; L7/complete/step/departure/69: s1=96.1%(28), s2=104.0%(18), s3=101.2%(25); 0/3 fail; L7/complete/step/departure/70: s1=103.5%(26), s2=100.2%(20), s3=102.3%(25); 0/3 fail; L7/complete/step/departure/71: s1=100.3%(27), s2=96.9%(16), s3=92.3%(25); 1/3 fail; L7/complete/step/departure/72: s1=103.6%(28), s2=105.3%(20), s3=102.3%(25); 0/3 fail; L7/complete/step/departure/73: s1=95.9%(28), s2=105.3%(16), s3=100.0%(25); 0/3 fail; L7/complete/step/departure/74: s1=94.0%(27), s2=90.4%(22), s3=100.8%(25); 2/3 fail; L7/passive/step/corridor/20: s1=100.0%(113), s2=unmeasured(4), s3=unmeasured(4); 0/1 fail; L7/passive/phase/encounters/20: s1=100.0%(125), s2=unmeasured(4), s3=unmeasured(4); 0/1 fail; L7/passive/step/departure/20: s1=100.0%(12), s2=unmeasured(0), s3=unmeasured(0); 0/1 fail; L7/60: 100.0% (166 samples); L7/63: 100.0% (169 samples); L8/354: 99.9% (78 samples); L8/359: 99.9% (83 samples); L8/362: 100.1% (83 samples); L8/363: 99.9% (83 samples); L8/364: 100.2% (83 samples); L8/365: 100.1% (83 samples); L8/366: 99.9% (83 samples); wait upper bounds: L5: 3.07%, L7: 20.20%, L8: 0.00% | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | FAIL |
| L3-02 cohorts | 15/15, 25/25, 35/35 | 15/15, 25/25, 35/35 | 15/25/35 actual members on low tier | PASS |
| L3-02 stream | 16.73 s scheduled; 15 admitted; 15.93 s scheduled; 25 admitted; 16.65 s scheduled; 35 admitted | — | every cohort admitted within its ≤18 s stream | PASS |
| L3-02 alarm frame | 5/15 | — | ≥25% of opening wave on screen within 2 s | PASS |
| L3-03 first attack | 3.35 s | — | ≤10 s | PASS |
| L4-07 first attack | 8.20 s | — | ≤10 s | PASS |
| L3-06 squad counts/losses | — | 4 → army s1:2/s2:4/s3:0 (2/3 ≥2); bite, bite | 3–4 at fallback; ≥2 at army (PO 2026-11-07; seeds 1–3: ≥2 valid, ≥2 of them ≥2); every loss a bite/kill/separation | PASS |
| L3-07 squad hits and player damage | — | 3/3 seeds pass (s1:118 hits, 11HP, s2:149 hits, 4.4HP, s3:40 hits, 55HP) | officer hits>0; player damage<100HP; 2 of 3 valid seeds pass | PASS |
| L3-08 segment density and concurrent cap | — | 2/3 seeds pass (s1:11/21/32, s2:11/22/21, s3:13/29/40) | medianS1<S2<S3;max≤100 low; 2 of 3 valid seeds pass | PASS |
| L3-11 native competent rate | — | s1:9.03/min, s2:8.67/min, s3:231.20/min; 2/3 | 3–25 infected attacks against player/min; 2 of 3 valid seeds pass | PASS |
| L4-05 directions/groups | 6 edges; ≥60°: true; max group 5 | — | ≥3 edges ≥60° apart; groups ≤5 at each source | PASS |
| L4-06 first breach | 50.08 s level / +17.27 s alarm; 68 alive | — | level clock 30–60 s; ≥60 alive at first breach | PASS |
| L4-06 sustained horde | minimum 60; 8235 observations; line break 182.25 s | — | ≥40 living in authored plaza from alarm +45 s through line break | PASS |
| L6-03/04 | Breach cohorts: see L6 wave table | — | breach 1 ≥6; breach 2 ≥10 | See wave flags |
| L8-04 | 13/12 across 4 outlets [3, 3, 4, 3] | — | ≥3 outlets ≥20m apart, ≥6/3 each (high/low); no pop-in | LEDGER PASS; visual pending |
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
| phase/spread — controller: spread | L1-08 | 32.49 player + 0.00 group/min; 12.30 s | 32.49 player + 0.00 group/min; 12.30 s | 23/24 | 23/24 | (-73.92, 40.47) | — |
| step/weapon — weapon: Find something to defend yourself | — | 11.19 player + 0.00 group/min; 12.28 s | 11.19 player + 0.00 group/min; 12.28 s | 20/20 | 20/20 | (23.26, 37.31) | — |
| step/firestation — firestation: Get inside the fire station | — | 46.47 player + 0.00 group/min; 0.38 s | 46.47 player + 0.00 group/min; 0.38 s | 23/24 | 23/24 | (-73.92, 40.47) | — |
| phase/run-out — level-end run-out | — | 192.00 player + 0.00 group/min; 0.98 s | 192.00 player + 0.00 group/min; 0.98 s | 28/28 | 28/28 | (-75.97, 41.13) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `phase/spread`, `step/firestation` at 109.53 s, 1/24 unreachable: `147@1` (40.62, -5.37). Player (-73.92, 40.47).

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
| step/bridge — bridge: Reach the police checkpoint at the bridge | — | 161.86 player + 0.00 group/min; 3.28 s | 23.41 player + 0.00 group/min; 3.28 s | 0/3 | 0/18 | (81.40, 32.95) | — |
| phase/collapse — controller: collapse | L2-07 | 141.33 player + 0.00 group/min; 3.28 s | 48.23 player + 0.00 group/min; 3.28 s | 30/30 | 30/30 | (-31.90, 38.38) | — |
| phase/escape — controller: escape | L2-12 | 170.96 player + 0.00 group/min; 0.42 s | 18.08 player + 0.00 group/min; 0.73 s | 4/4 | 19/19 | (81.42, 37.78) | — |
| phase/checkpoint — controller: checkpoint | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/3 | 0/18 | (81.40, 32.95) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/3 | 0/18 | (81.40, 32.95) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| market-ambush | l2.doorsOpen | 58.60 | 195.35 | 24 | 24 | — | 3.28 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/bridge`, `phase/checkpoint` at 147.72 s, 18/18 unreachable: `199@9` (-61.77, -18.56); `209@14` (-59.98, 7.83); `227@23` (-60.63, 1.70); `235@27` (-68.92, 21.74); `237@28` (-67.92, 9.45); `241@30` (-64.58, 28.75); `245@32` (-37.00, 30.43); `251@35` (60.30, -10.41); `253@36` (37.69, -32.04); `255@37` (-14.34, 47.40); `257@38` (3.68, 48.09); `259@39` (-7.52, 48.07); `267@43` (48.08, 46.13); `273@46` (-34.03, 2.46); `275@47` (-29.58, 21.17); `277@48` (-13.27, 28.82); `279@49` (6.08, 27.02); `281@50` (27.27, 26.76). Player (81.40, 32.95).
- `phase/done` at 148.32 s, 18/18 unreachable: `199@9` (-62.42, -19.10); `209@14` (-59.98, 7.71); `227@23` (-60.53, 1.21); `235@27` (-69.01, 22.52); `237@28` (-67.92, 9.45); `241@30` (-64.12, 28.47); `245@32` (-37.74, 32.70); `251@35` (60.30, -10.41); `253@36` (37.62, -31.99); `255@37` (-14.34, 47.40); `257@38` (4.31, 48.48); `259@39` (-7.77, 48.13); `267@43` (48.39, 46.69); `273@46` (-34.03, 2.46); `275@47` (-30.08, 23.04); `277@48` (-13.21, 28.33); `279@49` (6.06, 26.90); `281@50` (27.33, 26.76). Player (81.40, 32.95).

## L3

Threat steps explicitly selected from the loaded mission definition:

- `defend` — Help defend the station (combat; L3-03).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/armory — armory: Take a handgun from the armory | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-139.91, -6.85) | — |
| phase/yard — controller: yard | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-134.95, 0.61) | — |
| step/defend — defend: Help defend the station | L3-03 | 79.70 player + 0.00 group/min; 3.35 s | 16.03 player + 0.00 group/min; 23.87 s | 24/24 | 18/18 | (-134.95, 0.61) | — |
| phase/attack — controller: attack | — | 79.70 player + 0.00 group/min; 3.35 s | 16.03 player + 0.00 group/min; 23.87 s | 24/24 | 18/18 | (-134.95, 0.61) | — |
| step/checkpoint — checkpoint: Get inside the army checkpoint | — | 278.03 player + 46.64 group/min; 0.17 s | 9.03 player + 4.71 group/min; 0.03 s | 38/39 | 0/43 | (-134.95, 0.61) | — |
| phase/fallback — controller: fallback | — | 278.03 player + 46.64 group/min; 0.17 s | 21.39 player + 14.26 group/min; 0.03 s | 38/39 | 7/7 | (-134.95, 0.61) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| station-0 | L3 scheduled wave.at (before admission) | 9.45 | 60.55 | 15 | 15 | — | 3.35 | — |
| station-1 | L3 scheduled wave.at (before admission) | 29.45 | 40.55 | 25 | 25 | — | 3.43 | — |
| station-2 | L3 scheduled wave.at (before admission) | 49.45 | 20.55 | 35 | 35 | — | 9.43 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/checkpoint`, `phase/corridor` at 188.07 s, 43/43 unreachable: `731@315` (199.87, 4.35); `871@385` (199.07, 5.45); `925@412` (200.42, 3.58); `929@414` (189.34, 0.48); `963@431` (182.60, 1.64); `969@434` (200.87, 2.78); `977@438` (189.56, 2.49); `981@440` (181.33, 1.51); `1019@459` (203.74, 3.09); `1091@495` (202.90, 4.18); `1197@548` (199.99, 2.52); `1851@849` (180.43, 1.14); `1853@850` (181.27, 1.97); `1855@851` (183.77, 2.89); `1857@852` (188.87, 2.52); `1859@853` (183.91, 2.04); `2023@927` (193.91, -1.77); `2025@928` (187.19, 4.22); `2157@988` (177.72, 0.26); `2159@989` (163.66, -2.56); `2161@990` (161.38, -3.03); `2163@991` (162.13, -3.01); `2165@992` (152.24, 2.01); `2327@1065` (190.49, 2.21); `2329@1066` (188.63, 1.63); `2331@1067` (189.43, 3.18); `2333@1068` (188.24, 2.21); `2335@1069` (190.51, 2.90); `2467@1129` (184.37, 3.24); `2469@1130` (184.38, 2.54); `2471@1131` (183.93, 3.78); `2473@1132` (191.20, 2.99); `2475@1133` (187.80, 4.52); `2495@1143` (182.61, 2.34); `2497@1144` (183.32, 1.65); `2499@1145` (181.97, 1.36); `2501@1146` (181.97, 2.06); `2503@1147` (183.30, 2.37); `2505@1148` (171.85, -0.71); `2507@1149` (173.86, -0.40); `2509@1150` (176.32, -0.12); `2511@1151` (170.61, -1.01); `2513@1152` (172.50, -0.37). Player (226.45, 1.11).
- `phase/run-out` at 192.40 s, 81/81 unreachable: `731@315` (199.87, 4.35); `871@385` (199.07, 5.45); `925@412` (200.42, 3.58); `929@414` (189.96, 2.79); `963@431` (183.11, 1.94); `969@434` (200.87, 2.78); `977@438` (190.73, -1.73); `981@440` (185.28, 3.59); `1019@459` (203.74, 3.09); `1091@495` (202.90, 4.18); `1197@548` (199.99, 2.52); `1851@849` (181.47, 1.48); `1853@850` (182.77, 3.05); `1855@851` (184.46, 2.82); `1857@852` (191.59, 0.66); `1859@853` (184.31, 2.06); `2025@928` (185.14, 2.92); `2157@988` (183.10, 1.24); `2159@989` (177.60, 0.36); `2161@990` (175.13, -0.28); `2163@991` (176.06, -0.05); `2165@992` (165.29, -1.78); `2329@1066` (190.06, 1.49); `2331@1067` (190.92, 0.79); `2333@1068` (191.84, 2.16); `2467@1129` (182.08, 2.91); `2469@1130` (185.76, 3.87); `2471@1131` (183.47, 2.99); `2473@1132` (191.20, 0.00); `2475@1133` (190.49, 0.25); `2495@1143` (182.57, 2.37); `2497@1144` (183.75, 1.66); `2499@1145` (182.46, 1.67); `2501@1146` (181.93, 2.13); `2503@1147` (183.68, 2.34); `2505@1148` (180.78, 1.51); `2507@1149` (182.25, 1.00); `2509@1150` (181.24, 2.21); `2511@1151` (180.53, 0.84); `2513@1152` (181.23, 0.84); `2515@1153` (-63.52, 26.09); `2517@1154` (-74.86, 24.21); `2519@1155` (-66.96, 0.44); `2521@1156` (-50.58, 2.61); `2523@1157` (-41.60, -1.54); `2525@1158` (-73.92, -4.16); `2527@1159` (-79.95, -0.36); `2529@1160` (-70.96, -31.07); `2531@1161` (-76.51, -21.98); `2533@1162` (-32.47, -26.07); `2535@1163` (-48.86, -22.85); `2537@1164` (-51.06, -29.52); `2539@1165` (-38.12, -31.36); `2541@1166` (-59.80, -30.54); `2543@1167` (-67.37, -22.44); `2545@1168` (-42.22, 26.35); `2547@1169` (-31.35, 24.19); `2549@1170` (-20.49, 25.96); `2551@1171` (-48.07, 29.94); `2553@1172` (-71.61, 24.11); `2555@1173` (-63.23, 24.42); `2557@1174` (-67.26, 3.69); `2559@1175` (-48.58, 3.90); `2561@1176` (-43.72, -2.51); `2563@1177` (-73.03, -3.92); `2565@1178` (-79.45, -23.73); `2567@1179` (-69.36, -31.72); `2569@1180` (-33.78, -24.13); `2571@1181` (-50.20, -32.63); `2573@1182` (-43.51, 24.04); `2575@1183` (-46.60, 31.58); `2577@1184` (-47.49, -23.22); `2579@1185` (-21.43, 24.13); `2581@1186` (-33.12, 24.02); `2583@1187` (-46.85, 3.60); `2585@1188` (-68.77, 3.60); `2587@1189` (-78.13, -23.40); `2589@1190` (-64.43, 23.99); `2591@1191` (-72.77, 24.00); `2593@1192` (-44.13, -3.60); `2595@1193` (-69.56, -32.62). Player (225.15, 0.12).

## L4

Threat steps explicitly selected from the loaded mission definition:

- `hold` — Hold the plaza with the army (combat; L4-07).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/ride — ride: Ride into Fairhaven with the convoy | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| phase/convoy — controller: convoy | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/quartermaster — quartermaster: Report to the quartermaster | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| phase/plaza — controller: plaza | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/hold — hold: Hold the plaza with the army | L4-07 | 1126.42 player + 0.00 group/min; 8.20 s | 243.03 player + 0.00 group/min; 10.28 s | 80/80 | 80/80 | (-22.85, 0.74) | — |
| phase/war — controller: war | — | 1126.42 player + 0.00 group/min; 8.20 s | 243.03 player + 0.00 group/min; 10.28 s | 80/80 | 80/80 | (-22.85, 0.74) | — |
| step/hide — hide: Run to the cellar via Lakeshore, Metro Road and Harbor Street | — | 664.38 player + 0.00 group/min; 0.02 s | 112.06 player + 0.00 group/min; 0.10 s | 80/80 | 69/69 | (-5.74, 26.14) | — |
| phase/collapse — controller: collapse | — | 664.38 player + 0.00 group/min; 0.02 s | 112.06 player + 0.00 group/min; 0.10 s | 80/80 | 69/69 | (-5.74, 26.14) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| war-0@1969 | l4.wave | 32.82 | 217.18 | 24 | 24 | — | 8.20 | — |
| war-1@2629 | l4.wave | 43.82 | 206.18 | 36 | 34 | — | 12.30 | — |
| breach-west | L4 breach.openAt | 50.75 | 199.25 | — | 108 | — | 4.58 | — |
| war-2@3289 | l4.wave | 54.82 | 195.18 | 48 | 26 | — | 120.07 | — |
| war-3@3949 | l4.wave | 65.82 | 184.18 | 54 | 11 | — | 131.17 | — |
| war--1@4009 | l4.wave | 66.82 | 183.18 | 15 | 3 | — | 154.70 | — |
| war-4@4609 | l4.wave | 76.82 | 173.18 | 54 | 0 | — | — | — |
| war-5@5269 | l4.wave | 87.82 | 162.18 | 54 | 0 | — | — | — |
| war-6@5929 | l4.wave | 98.82 | 151.18 | 54 | 0 | — | — | — |
| war-7@6589 | l4.wave | 109.82 | 140.18 | 54 | 0 | — | — | — |
| war-8@7249 | l4.wave | 120.82 | 129.18 | 54 | 0 | — | — | — |
| war-9@7909 | l4.wave | 131.82 | 118.18 | 54 | 0 | — | — | — |
| breach-north | L4 breach.openAt | 141.55 | 108.45 | — | 26 | — | 8.00 | — |
| war-10@8569 | l4.wave | 142.82 | 107.18 | 54 | 0 | — | — | — |
| war-11@9229 | l4.wave | 153.82 | 96.18 | 54 | 0 | — | — | — |
| war-12@9889 | l4.wave | 164.82 | 85.18 | 54 | 0 | — | — | — |
| breach-south | L4 breach.openAt | 167.67 | 82.33 | — | 5 | — | 5.10 | — |
| war-13@10549 | l4.wave | 175.82 | 74.18 | 54 | 0 | — | — | — |
| war-14@11209 | l4.wave | 186.82 | 63.18 | 54 | 0 | — | — | — |
| opening-alarm | L4 opening pending street cohorts | 32.82 | 217.18 | — | 0 | — | — | — |
| war-15@11869 | l4.wave | 197.82 | 52.18 | 54 | 0 | — | — | — |
| war-16@12529 | l4.wave | 208.82 | 41.18 | 54 | 0 | — | — | — |
| war-17@13189 | l4.wave | 219.82 | 30.18 | 54 | 0 | — | — | — |
| collapse-0@13609 | l4.wave | 226.82 | 23.18 | 6 | 0 | — | — | — |
| collapse-1@14149 | l4.wave | 235.82 | 14.18 | 6 | 0 | — | — | — |
| collapse-2@14689 | l4.wave | 244.82 | 5.18 | 6 | 0 | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/bar` at 499.40 s, 69/69 unreachable: `211@43` (-17.60, -3.86); `264@93` (-14.25, 28.33); `369@190` (-11.41, 27.20); `393@213` (-65.04, 44.48); `405@225` (-24.86, -3.78); `414@233` (-13.74, 42.22); `434@251` (-16.36, 41.37); `454@270` (-64.11, 44.43); `455@271` (-64.73, 45.12); `462@278` (-17.70, -1.87); `476@289` (-16.24, 24.68); `478@290` (47.01, -11.58); `486@298` (-12.17, 24.75); `498@305` (-16.26, 25.52); `500@307` (-9.97, 29.94); `504@311` (-24.96, -2.46); `506@313` (-16.79, -2.82); `508@315` (-10.79, 29.71); `509@316` (-6.51, 22.14); `510@317` (-15.64, 27.51); `511@318` (-5.89, 21.15); `513@320` (-14.82, 35.07); `515@322` (-6.57, 24.17); `517@324` (3.98, -4.00); `518@325` (-4.14, 30.62); `520@327` (1.11, 8.66); `521@328` (-16.95, 22.00); `523@330` (-9.54, 27.16); `524@331` (-19.49, 2.91); `526@333` (0.81, 26.26); `529@336` (-14.73, 26.98); `531@338` (23.02, -36.20); `568@349` (-58.94, 42.96); `644@413` (76.54, 49.55); `645@414` (69.67, 49.96); `646@415` (37.83, 48.24); `651@420` (-13.26, 18.94); `707@476` (49.30, -27.59); `713@482` (38.20, -34.87); `719@488` (24.92, -41.96); `726@495` (18.48, 24.31); `734@503` (-16.04, -2.29); `735@504` (-22.30, 42.44); `738@507` (16.96, 35.93); `739@508` (-16.75, 45.87); `740@509` (-14.78, 3.56); `745@514` (-12.11, 36.99); `747@516` (-12.14, 48.09); `748@517` (-18.88, 42.42); `749@518` (54.86, -38.58); `750@519` (43.54, -40.46); `751@520` (-16.01, 1.56); `756@525` (54.39, -42.46); `767@536` (-16.80, -36.05); `768@537` (30.26, -43.97); `769@538` (13.09, 1.42); `770@539` (14.84, 4.31); `771@540` (3.03, 53.61); `772@541` (3.61, 54.32); `773@542` (17.45, -26.60); `774@543` (16.34, -27.74); `775@544` (9.54, 1.94); `776@545` (-1.29, 7.13); `777@546` (-12.22, 25.75); `778@547` (-11.40, 23.82); `779@548` (-22.52, 20.59); `780@549` (-25.72, 30.73); `781@550` (15.24, -4.89); `782@551` (10.58, -0.92). Player (75.30, -6.40).
- `phase/cellar`, `step/wait` at 506.57 s, 80/80 unreachable: `211@43` (-16.38, -4.57); `264@93` (-14.46, 28.33); `369@190` (-11.41, 27.20); `393@213` (-65.04, 44.48); `405@225` (-25.15, -3.16); `414@233` (-13.74, 42.22); `434@251` (-16.36, 41.37); `454@270` (-64.11, 44.43); `455@271` (-64.73, 45.12); `462@278` (-14.02, -2.96); `474@287` (-27.56, 10.08); `476@289` (-16.24, 24.68); `478@290` (50.13, -12.85); `479@291` (0.16, 3.19); `486@298` (-11.87, 24.14); `498@305` (-14.76, 29.99); `500@307` (-9.57, 37.03); `504@311` (-25.92, -1.58); `508@315` (-16.08, 32.77); `509@316` (-3.87, 24.96); `510@317` (-16.28, 27.12); `511@318` (-10.64, 25.75); `513@320` (-17.12, 31.90); `515@322` (-7.19, 18.89); `517@324` (4.07, -4.00); `518@325` (-3.61, 33.54); `520@327` (3.56, -3.51); `521@328` (-16.95, 22.00); `523@330` (-7.79, 25.66); `526@333` (0.30, 27.06); `529@336` (-14.73, 26.98); `531@338` (23.07, -35.67); `532@339` (-7.37, 24.93); `533@340` (-13.19, 14.33); `534@341` (-18.79, -31.43); `535@342` (-15.52, -19.86); `537@344` (-8.13, 39.77); `559@345` (9.25, 52.45); `562@346` (6.14, 54.66); `563@347` (-4.36, 33.53); `564@348` (-20.92, -16.62); `568@349` (-56.50, 43.38); `569@350` (-21.38, 0.46); `570@351` (-13.93, -6.12); `571@352` (-15.08, -4.41); `572@353` (-58.06, 38.18); `576@354` (-14.46, 1.90); `644@413` (78.99, 42.38); `645@414` (69.15, 51.15); `646@415` (38.38, 48.91); `651@420` (-13.51, 18.84); `707@476` (53.05, -27.59); `713@482` (34.76, -37.54); `719@488` (26.97, -43.22); `726@495` (14.91, 21.79); `734@503` (-16.25, -3.22); `735@504` (-22.58, 45.79); `738@507` (10.99, 35.73); `739@508` (-15.43, 47.05); `740@509` (-17.60, 6.30); `745@514` (-10.34, 37.97); `747@516` (-6.73, 48.80); `748@517` (-22.24, 41.36); `749@518` (49.23, -40.35); `750@519` (38.28, -37.73); `756@525` (52.66, -40.47); `767@536` (-20.90, -35.89); `768@537` (31.37, -44.55); `769@538` (14.97, -0.78); `770@539` (16.43, 0.87); `772@541` (6.69, 51.34); `773@542` (14.88, -20.69); `774@543` (14.77, -21.98); `775@544` (13.13, 4.05); `776@545` (0.90, 2.11); `777@546` (-14.40, 12.90); `778@547` (-12.94, 19.56); `779@548` (-15.21, -2.40); `781@550` (17.11, -9.48); `782@551` (7.61, 2.27). Player (74.65, -2.13).
- `phase/done` at 507.57 s, 80/80 unreachable: `211@43` (-16.44, -4.50); `264@93` (-14.46, 28.33); `369@190` (-11.41, 27.20); `393@213` (-65.04, 44.48); `405@225` (-25.24, -3.16); `414@233` (-13.74, 42.22); `434@251` (-16.36, 41.37); `454@270` (-64.11, 44.43); `455@271` (-64.73, 45.12); `462@278` (-14.69, -2.33); `474@287` (-27.56, 10.08); `476@289` (-16.24, 24.68); `478@290` (50.15, -12.85); `479@291` (-0.65, 0.08); `486@298` (-12.04, 24.00); `498@305` (-14.89, 30.17); `500@307` (-9.49, 37.27); `508@315` (-16.28, 33.16); `509@316` (-4.04, 25.39); `510@317` (-16.28, 26.91); `511@318` (-11.11, 25.95); `513@320` (-16.98, 31.90); `515@322` (-7.69, 18.49); `517@324` (4.07, -4.00); `518@325` (-3.49, 34.14); `520@327` (3.56, -3.51); `521@328` (-16.95, 22.00); `523@330` (-7.87, 25.23); `526@333` (0.79, 27.20); `529@336` (-14.73, 26.98); `531@338` (23.37, -36.02); `532@339` (-11.55, 24.51); `533@340` (-16.61, 10.54); `534@341` (-18.79, -30.85); `535@342` (-14.87, -20.67); `537@344` (-8.37, 40.83); `559@345` (9.47, 52.10); `562@346` (5.91, 54.81); `563@347` (-4.40, 33.50); `564@348` (-21.87, -15.02); `568@349` (-56.63, 41.50); `569@350` (-22.19, 0.38); `570@351` (-11.71, -6.86); `571@352` (-15.13, -4.96); `572@353` (-57.59, 37.74); `576@354` (-14.41, 1.80); `581@355` (18.06, -35.87); `644@413` (78.99, 42.38); `645@414` (69.82, 50.70); `646@415` (38.69, 48.19); `651@420` (-13.51, 18.84); `707@476` (53.05, -27.59); `713@482` (34.74, -37.54); `719@488` (26.96, -43.26); `726@495` (14.83, 21.76); `734@503` (-16.23, -3.20); `735@504` (-22.63, 45.86); `738@507` (10.81, 35.78); `739@508` (-15.25, 46.89); `740@509` (-19.43, 9.27); `745@514` (-10.35, 37.97); `747@516` (-6.42, 48.69); `748@517` (-22.40, 41.22); `749@518` (48.86, -40.39); `750@519` (37.95, -37.49); `756@525` (52.09, -40.84); `767@536` (-19.96, -36.55); `768@537` (31.46, -44.87); `769@538` (15.51, -0.89); `770@539` (17.34, 0.76); `772@541` (7.06, 51.34); `773@542` (14.42, -19.39); `774@543` (14.67, -20.32); `775@544` (13.34, 5.07); `776@545` (0.61, 0.46); `777@546` (-18.54, 8.65); `778@547` (-12.94, 19.55); `779@548` (-15.76, -1.56); `781@550` (17.97, -10.29); `782@551` (6.33, 2.27). Player (74.65, -2.13).

## L5

Threat steps explicitly selected from the loaded mission definition:

- `look` — Look for anyone still alive (combat; L5-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/emerge — emerge: Unbar the cellar door | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/100 | 0/100 | (75.30, -5.39) | — |
| phase/cellar — controller: cellar | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/100 | 0/100 | (74.66, -1.77) | — |
| phase/emerged — controller: emerged | — | 60.00 player + 0.00 group/min; 5.78 s | 60.00 player + 0.00 group/min; 5.78 s | 100/100 | 100/100 | (-79.30, -44.28) | — |
| step/look — look: Look for anyone still alive | L5-05 | 411.85 player + 0.71 group/min; 0.08 s | 10.74 player + 0.00 group/min; 0.08 s | 99/99 | 41/41 | (37.84, -48.55) | — |
| phase/search — controller: search | — | 411.85 player + 0.71 group/min; 0.08 s | 10.74 player + 0.00 group/min; 0.08 s | 99/99 | 41/41 | (37.84, -48.55) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/emerge` at 0.02 s, 100/100 unreachable: `84@3` (-20.00, -37.60); `86@4` (-17.50, -36.10); `88@5` (14.00, 28.00); `90@6` (-22.00, 10.00); `92@1` (46.00, 36.00); `93@7` (22.00, -37.40); `95@8` (-26.00, 40.00); `97@9` (-23.50, 41.50); `99@2` (-42.00, -41.50); `100@10` (2.00, 43.60); `102@11` (14.00, -2.00); `104@12` (-12.00, 18.00); `106@13` (44.00, -36.40); `108@14` (46.50, -34.90); `110@15` (-6.00, -37.40); `112@16` (10.00, 13.00); `114@17` (-46.00, -37.50); `116@18` (36.00, -37.40); `118@19` (-12.00, 43.60); `120@20` (14.00, -24.00); `122@21` (-60.00, 43.00); `124@22` (-4.00, 28.00); `126@23` (-40.00, -20.00); `128@24` (-8.90, 2.60); `130@25` (0.10, 2.60); `132@26` (53.50, 41.30); `134@27` (62.50, 41.30); `136@28` (-29.00, -2.70); `138@29` (-34.87, -44.40); `140@30` (-25.87, -44.40); `142@31` (-49.50, 50.00); `144@32` (-40.50, 50.00); `146@33` (68.00, -37.40); `148@34` (48.00, -12.00); `150@35` (40.00, 43.60); `152@36` (16.00, -12.00); `154@37` (4.00, -37.40); `156@38` (0.00, -12.00); `158@39` (-4.00, 14.00); `160@40` (-16.00, -12.00); `162@41` (-28.00, -37.40); `164@42` (-32.00, -12.00); `166@43` (-36.00, 14.00); `168@44` (-60.00, -37.40); `170@45` (-72.00, 43.60); `172@46` (64.00, 2.00); `174@47` (60.00, 28.00); `176@48` (48.00, 2.00); `178@49` (4.00, -24.00); `180@50` (-16.00, 2.00); `182@51` (-32.00, 2.00); `184@52` (-36.00, 28.00); `186@53` (56.00, -37.40); `188@54` (52.00, -12.00); `190@55` (48.00, 14.00); `192@56` (12.00, 43.60); `194@57` (8.00, -37.40); `196@58` (0.00, 14.00); `198@59` (-28.00, -12.00); `200@60` (-36.00, 43.60); `202@61` (-52.00, 43.60); `204@62` (-56.00, -37.40); `206@63` (-68.00, 43.60); `208@64` (64.00, 28.00); `210@65` (52.00, 2.00); `212@66` (48.00, 28.00); `214@67` (-16.00, 28.00); `216@68` (-28.00, 2.00); `218@69` (-32.00, 28.00); `220@70` (60.00, -37.40); `222@71` (52.00, 14.00); `224@72` (48.00, 43.60); `226@73` (32.00, 43.60); `228@74` (16.00, 43.60); `230@75` (12.00, -37.40); `232@76` (-8.00, -12.00); `234@77` (-24.00, -12.00); `236@78` (-40.00, -12.00); `238@79` (-48.00, 43.60); `240@80` (68.00, 28.00); `242@81` (56.00, 2.00); `244@82` (52.00, 28.00); `246@83` (-12.00, 28.00); `248@84` (-20.00, -24.00); `250@85` (-24.00, 2.00); `252@86` (-28.00, 28.00); `254@87` (68.00, 43.60); `256@88` (64.00, -37.40); `258@89` (36.00, 43.60); `260@90` (12.00, -12.00); `262@91` (-4.00, -12.00); `264@92` (-20.00, -12.00); `266@93` (-32.00, -37.40); `268@94` (-36.00, -12.00); `270@95` (-40.00, 14.00); `272@96` (-44.00, 43.60); `274@97` (-64.00, -37.40); `276@98` (-76.00, 43.60); `278@99` (60.00, 2.00); `280@100` (56.00, 28.00). Player (75.30, -5.39).
- `phase/cellar` at 1.00 s, 100/100 unreachable: `84@3` (-20.00, -37.60); `86@4` (-17.69, -36.19); `88@5` (14.00, 28.22); `90@6` (-21.66, 9.70); `92@1` (46.00, 36.00); `93@7` (22.00, -37.40); `95@8` (-25.88, 39.99); `97@9` (-23.43, 41.80); `99@2` (-42.00, -41.50); `100@10` (1.73, 43.79); `102@11` (14.00, -2.02); `104@12` (-11.99, 17.82); `106@13` (44.21, -36.42); `108@14` (46.34, -35.15); `110@15` (-5.98, -37.39); `112@16` (10.07, 12.88); `114@17` (-46.25, -37.51); `116@18` (36.03, -37.38); `118@19` (-12.06, 43.93); `120@20` (14.01, -23.86); `122@21` (-59.99, 42.89); `124@22` (-4.21, 28.10); `126@23` (-39.75, -20.01); `128@24` (-8.88, 2.56); `130@25` (0.34, 2.45); `132@26` (53.51, 41.31); `134@27` (62.45, 41.38); `136@28` (-29.00, -2.70); `138@29` (-34.96, -44.43); `140@30` (-25.56, -44.27); `142@31` (-49.73, 49.58); `144@32` (-40.88, 50.11); `146@33` (67.95, -37.41); `148@34` (48.26, -12.13); `150@35` (39.99, 43.61); `152@36` (15.99, -11.97); `154@37` (4.11, -37.42); `156@38` (-0.20, -12.06); `158@39` (-4.12, 14.27); `160@40` (-16.01, -11.99); `162@41` (-28.17, -37.34); `164@42` (-32.22, -12.10); `166@43` (-36.00, 14.00); `168@44` (-60.16, -37.44); `170@45` (-72.44, 43.83); `172@46` (64.15, 1.73); `174@47` (59.98, 28.01); `176@48` (48.00, 2.00); `178@49` (3.91, -23.95); `180@50` (-16.11, 1.94); `182@51` (-32.04, 1.93); `184@52` (-36.01, 28.01); `186@53` (55.51, -37.35); `188@54` (51.98, -11.80); `190@55` (48.00, 14.00); `192@56` (11.99, 43.60); `194@57` (7.97, -37.43); `196@58` (-0.04, 14.05); `198@59` (-28.03, -12.00); `200@60` (-36.06, 43.74); `202@61` (-52.42, 43.69); `204@62` (-56.00, -37.40); `206@63` (-67.93, 44.01); `208@64` (63.97, 28.00); `210@65` (51.99, 1.97); `212@66` (48.11, 27.82); `214@67` (-15.96, 28.03); `216@68` (-28.04, 2.33); `218@69` (-31.98, 27.98); `220@70` (59.72, -37.82); `222@71` (52.13, 14.15); `224@72` (48.04, 43.90); `226@73` (31.98, 43.61); `228@74` (15.90, 43.65); `230@75` (12.00, -37.40); `232@76` (-8.00, -12.00); `234@77` (-24.00, -12.00); `236@78` (-39.97, -12.01); `238@79` (-48.04, 43.59); `240@80` (67.78, 28.00); `242@81` (56.00, 2.00); `244@82` (52.21, 27.76); `246@83` (-11.66, 27.67); `248@84` (-20.04, -24.07); `250@85` (-24.11, 1.96); `252@86` (-28.00, 27.89); `254@87` (67.79, 43.76); `256@88` (63.74, -37.46); `258@89` (36.28, 43.96); `260@90` (12.10, -12.08); `262@91` (-3.88, -12.29); `264@92` (-20.05, -11.96); `266@93` (-31.64, -37.43); `268@94` (-36.00, -12.00); `270@95` (-40.05, 14.14); `272@96` (-44.29, 43.30); `274@97` (-63.75, -37.61); `276@98` (-76.03, 43.61); `278@99` (59.93, 1.96); `280@100` (55.67, 28.12). Player (74.66, -1.77).
- `step/metro`, `phase/shelter` at 227.32 s, 25/25 unreachable: `84@3` (-23.55, -40.07); `92@1` (49.11, 38.41); `93@7` (15.81, -36.63); `99@2` (-43.07, -40.52); `102@11` (15.66, -6.28); `110@15` (-13.64, -44.51); `118@19` (-1.27, 47.92); `120@20` (14.45, -14.80); `130@25` (-4.70, -5.04); `134@27` (39.41, 51.41); `146@33` (59.85, -37.03); `152@36` (11.68, -17.04); `154@37` (-0.81, -37.22); `170@45` (-57.35, 32.60); `172@46` (65.25, -3.31); `174@47` (55.18, 20.77); `178@49` (6.32, -22.75); `194@57` (0.73, -36.03); `206@63` (-64.59, 46.86); `208@64` (48.39, 23.86); `230@75` (18.28, -36.89); `232@76` (-5.17, -1.29); `254@87` (72.27, 48.99); `260@90` (14.29, -5.66); `262@91` (-14.72, -16.19). Player (38.20, -50.05).
- `phase/done` at 228.32 s, 25/25 unreachable: `84@3` (-24.43, -39.51); `92@1` (49.11, 38.41); `93@7` (15.81, -36.63); `99@2` (-43.07, -40.52); `102@11` (15.69, -7.65); `110@15` (-13.64, -44.51); `118@19` (-0.25, 47.59); `120@20` (15.46, -14.86); `130@25` (-3.84, -5.84); `134@27` (39.41, 51.41); `146@33` (60.89, -37.92); `152@36` (12.14, -17.98); `154@37` (-0.23, -36.19); `170@45` (-57.51, 33.93); `172@46` (65.25, -2.76); `174@47` (54.20, 20.58); `178@49` (6.32, -22.75); `194@57` (1.43, -36.87); `206@63` (-63.32, 47.25); `208@64` (48.47, 25.09); `230@75` (18.28, -36.89); `232@76` (-5.13, -1.29); `254@87` (71.21, 48.71); `260@90` (14.52, -4.65); `262@91` (-14.72, -16.19). Player (38.20, -50.05).

## L6

Threat steps explicitly selected from the loaded mission definition:

- `stop` — Stop the infected (combat; L6-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/shelter — shelter: Look around the shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| phase/shelter — controller: shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| step/stop — stop: Stop the infected | L6-05 | 165.58 player + 179.86 group/min; 1.95 s | 2.85 player + 14.27 group/min; 6.00 s | 20/20 | 0/0 | (0.33, 3.56) | — |
| phase/first — controller: first | — | 165.58 player + 179.86 group/min; 1.95 s | 2.85 player + 14.27 group/min; 6.00 s | 20/20 | 0/0 | (0.33, 3.56) | — |
| step/retreat — retreat: Cover the retreat through the tunnel | — | 664.71 player + 257.07 group/min; 0.17 s | 17.80 player + 11.61 group/min; 6.87 s | 30/30 | 22/22 | (0.33, 3.56) | — |
| phase/retreat — controller: retreat | — | 664.71 player + 257.07 group/min; 0.17 s | 17.80 player + 11.61 group/min; 6.87 s | 30/30 | 22/22 | (0.33, 3.56) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| l6.breach1 | l6.breach1 | 33.20 | 76.80 | 8 | 8 | — | 1.95 | — |
| l6.breach2 | l6.breach2 | 54.22 | 55.78 | 10 | 10 | — | 11.05 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## L7

Threat steps explicitly selected from the loaded mission definition:

- `corridor` — Bring the group to the evacuation corridor (combat; L7-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/rocket — rocket: Recover the rocket launcher beside the exit | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 98/98 | 98/98 | (273.01, 15.00) | — |
| phase/pickup — controller: pickup | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 98/98 | 98/98 | (273.01, 15.00) | — |
| step/corridor — corridor: Bring the group to the evacuation corridor | L7-05 | 245.37 player + 242.19 group/min; 1.30 s | 102.53 player + 30.62 group/min; 0.28 s | 97/97 | 61/62 | (-16.54, 47.76) | — |
| phase/encounters — controller: encounters | — | 255.79 player + 223.45 group/min; 1.30 s | 142.77 player + 40.44 group/min; 0.28 s | 98/98 | 21/22 | (-59.84, 47.07) | — |
| step/departure — departure: Get everyone aboard the bus | — | 209.48 player + 0.00 group/min; 5.27 s | 123.62 player + 70.64 group/min; 6.88 s | 97/97 | 0/1 | (35.94, 47.00) | — |
| phase/departing — controller: departing | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 97/97 | 0/1 | (35.94, 47.00) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 96/96 | 0/1 | (40.00, 47.00) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/corridor` at 84.23 s, 1/62 unreachable: `249@175` (30.42, 38.24). Player (-23.48, 47.43).
- `phase/encounters` at 96.50 s, 1/22 unreachable: `249@175` (31.49, 38.48). Player (-57.13, 46.84).
- `step/departure`, `phase/departing` at 127.67 s, 1/1 unreachable: `249@175` (31.57, 38.45). Player (35.94, 47.00).
- `phase/boarding` at 118.15 s, 1/1 unreachable: `249@175` (30.83, 37.22). Player (-70.31, 47.49).
- `phase/done` at 128.67 s, 1/1 unreachable: `249@175` (31.26, 37.94). Player (40.00, 47.00).

## L8

Threat steps explicitly selected from the loaded mission definition:

- `escape` — Lead the group to the armored vehicle (breach combat; L8-06).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/sanctuary — sanctuary: Follow Nadia to the central plaza | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-2.20, -0.05) | — |
| phase/sanctuary — controller: sanctuary | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-2.20, -0.05) | — |
| step/escape — escape: Lead the group to the armored vehicle | L8-06 | 222.67 player + 55.33 group/min; 17.93 s | 26.85 player + 4.09 group/min; 18.97 s | 50/50 | 39/39 | (13.01, 19.14) | — |
| phase/breached — controller: breached | — | 222.67 player + 55.33 group/min; 17.93 s | 26.85 player + 4.09 group/min; 18.97 s | 50/50 | 39/39 | (13.01, 19.14) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| tunnel-breach | L8 breachedAt/story.say | 60.00 | 90.00 | 12 | 13 | 3, 3, 4, 3 | 17.93 | — |
| tunnel-reinforcement@4200 | L8 nextWave clock | 70.00 | 80.00 | 16 | 4 | — | 15.18 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/depart`, `phase/boarding` at 170.78 s, 35/36 unreachable: `425@5` (-58.20, -16.10); `427@6` (-61.34, 52.89); `429@7` (-60.31, -7.74); `435@10` (93.75, 75.52); `437@11` (58.06, 37.18); `439@1` (17.52, -6.23); `440@12` (65.39, 49.02); `444@2` (18.46, 24.78); `446@4` (32.33, 62.19); `447@14` (88.79, 63.75); `455@18` (-65.08, -5.05); `459@20` (-64.73, -3.47); `461@21` (95.37, 77.68); `463@22` (58.28, 44.01); `402@23` (3.67, -15.59); `403@25` (3.40, -16.91); `405@26` (12.18, -4.17); `400@27` (56.77, 35.01); `404@28` (3.11, -15.02); `399@29` (-62.01, 31.85); `406@30` (2.00, -15.91); `401@31` (56.93, 28.91); `407@32` (3.23, -16.16); `409@33` (63.03, 28.98); `408@34` (3.73, -14.65); `410@35` (62.82, 35.10); `411@36` (-7.83, 19.26); `413@37` (-6.21, 13.61); `414@38` (-2.58, 12.46); `398@39` (63.26, -30.22); `415@40` (0.04, 14.89); `397@41` (-64.08, -27.92); `417@42` (-5.09, 19.49); `418@43` (-59.16, -33.78); `416@44` (-1.30, 18.25). Player (139.00, 80.00).
- `phase/run-out` at 175.78 s, 34/35 unreachable: `425@5` (-63.05, -17.96); `427@6` (-67.03, 54.99); `429@7` (-58.48, -12.59); `431@8` (91.78, 76.78); `433@9` (94.12, 75.23); `437@11` (58.93, 37.01); `439@1` (22.91, -6.24); `440@12` (70.97, 48.48); `444@2` (20.51, 20.78); `455@18` (-71.42, -5.34); `459@20` (-65.75, -7.35); `461@21` (95.63, 80.97); `463@22` (62.48, 47.13); `402@23` (3.71, -15.71); `403@25` (3.40, -16.91); `405@26` (3.88, -14.50); `400@27` (59.78, 27.70); `404@28` (2.78, -15.14); `399@29` (-58.54, 30.61); `406@30` (2.00, -15.91); `401@31` (64.05, 31.81); `407@32` (3.19, -16.20); `409@33` (59.98, 36.35); `408@34` (3.46, -15.05); `410@35` (55.62, 32.11); `411@36` (-4.18, 12.76); `413@37` (-0.26, 17.02); `414@38` (-3.31, 19.17); `398@39` (61.46, -33.41); `415@40` (-7.11, 19.36); `397@41` (-61.13, -28.99); `417@42` (-7.73, 14.25); `418@43` (-60.79, -27.14); `416@44` (-7.93, 18.06). Player (146.00, 80.00).

## L9

Threat steps explicitly selected from the loaded mission definition:

- None; roadside infected are still measured.

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/approach — approach: Drive toward the city | — | 0.72 player + 0.00 group/min; 133.15 s | 0.00 player + 0.00 group/min; — s | worst 16/23; last 56/57 | 58/59 | (486.39, -6.57) | — |
| phase/driving — controller: driving | — | 0.72 player + 0.00 group/min; 133.15 s | 0.00 player + 0.00 group/min; — s | worst 16/23; last 56/57 | 58/59 | (486.39, -6.57) | — |
| phase/approach — controller: approach | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 67/67 | 64/64 | (492.29, 0.66) | — |
| phase/fall — controller: fall | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 69/69 | 64/64 | (498.29, 8.06) | — |
| step/reach-outskirts — reach-outskirts: Crawl out of the wreck | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 92/92 | 91/91 | (547.00, 0.00) | — |
| phase/impact — controller: impact | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 71/71 | 67/67 | (527.50, 2.60) | — |
| phase/crawl — controller: crawl | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 92/92 | 91/91 | (547.00, 0.00) | — |
| phase/done — controller: done | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 92/92 | 91/91 | (547.00, 0.00) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/approach`, `phase/driving` at 68.02 s, 7/23 unreachable: `674@1` (-430.00, 0.00); `676@2` (-570.00, -120.00); `677@3` (-570.00, -120.00); `678@4` (-570.00, -120.00); `679@5` (-570.00, -120.00); `680@6` (-570.00, -120.00); `681@7` (-570.00, -120.00). Player (54.49, -298.83).

## L10

Threat steps explicitly selected from the loaded mission definition:

- `hold` — Hold the console (assault combat; L10-11).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/crash — crash: Get away from the river | — | 95.13 player + 0.00 group/min; 4.23 s | 22.53 player + 0.00 group/min; 4.23 s | 6/6 | 5/5 | (636.28, -11.80) | — |
| step/farmstead — farmstead: Find a way through the farms | — | 252.79 player + 0.00 group/min; 0.03 s | 2.69 player + 0.00 group/min; 1.18 s | 12/12 | 8/8 | (1853.43, 24.87) | — |
| step/restricted-zone — restricted-zone: Get through the restricted zone | — | 367.85 player + 0.00 group/min; 0.10 s | 0.39 player + 0.00 group/min; 129.93 s | 12/12 | 10/10 | (2463.13, -6.29) | — |
| step/research-hangar — research-hangar: Enter the hangar | — | 349.86 player + 0.00 group/min; 0.13 s | 0.00 player + 0.00 group/min; — s | 12/12 | 10/10 | (2703.32, 50.65) | — |
| step/research — research: Enter the hangar | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 11/12 | 11/12 | (2699.46, 65.48) | — |
| step/cure — cure: Bring the cure to the dispersal complex | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 11/12 | 11/12 | (2699.46, 65.48) | — |
| step/research-exit — research-exit: Bring the cure to the dispersal complex | — | 140.11 player + 0.00 group/min; 2.92 s | 0.00 player + 0.00 group/min; — s | 12/12 | 11/11 | (2799.37, 45.69) | — |
| step/delivery-corridor — delivery-corridor: Bring the cure to the dispersal complex | — | 359.05 player + 0.00 group/min; 0.05 s | 0.00 player + 0.00 group/min; — s | 12/12 | 9/9 | (2931.95, 1.63) | — |
| step/dispersal-complex — dispersal-complex: Bring the cure to the dispersal complex | — | 367.07 player + 0.00 group/min; 0.05 s | 0.34 player + 0.00 group/min; 48.88 s | 12/12 | 10/10 | (3687.76, -22.09) | — |
| step/install — install: Install the cure | — | 391.68 player + 0.00 group/min; 0.07 s | 0.00 player + 0.00 group/min; — s | 12/12 | 9/9 | (4000.92, -38.74) | — |
| step/hold — hold: Hold the console | L10-11 | 479.55 player + 0.00 group/min; 0.18 s | 2.88 player + 0.00 group/min; 18.93 s | 14/14 | 2/2 | (4002.48, -28.56) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| dispersal-assault | L10 charge-active (not first spawn) | 881.47 | 59.98 | — | 13 | — | 0.00 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/research` at 582.07 s, 1/12 unreachable: `109@13` (2693.72, 35.22). Player (2699.46, 65.48).
- `step/cure` at 582.08 s, 1/12 unreachable: `109@13` (2693.72, 35.28). Player (2699.46, 65.48).

## Every fail flag

- L7/FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT
- L7/step/departure:SLOW_FOLLOWER:20
- L7/step/departure:SLOW_FOLLOWER:64
- L7/step/departure:SLOW_FOLLOWER:68
- L7/step/departure:SLOW_FOLLOWER:74
- L10/KITING_LANDED_HITS_BELOW_2:0.00

## Flag-to-criterion mapping

| Flag | Acceptance criterion |
|---|---|
| L7/FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT | G-13 |
| L7/step/departure:SLOW_FOLLOWER:20 | G-13 |
| L7/step/departure:SLOW_FOLLOWER:64 | G-13 |
| L7/step/departure:SLOW_FOLLOWER:68 | G-13 |
| L7/step/departure:SLOW_FOLLOWER:74 | G-13 |
| L10/KITING_LANDED_HITS_BELOW_2:0.00 | see level-specific threat criterion |

Absolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.

## Defect triage provenance

Historical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.

Run `npm run qa:threat` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.
