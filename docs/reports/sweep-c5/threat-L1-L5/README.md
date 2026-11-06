# Threat calibration

Runtime main: `4f2b75e42e69fd213de28e0701d8c7a04d4972d7`; harness base: `6fcc2d21e545db722516c481ef8d242c05e276c2`. Runtime source matches main: **false**. Seed 1, skilled and passive native routes, **low** population set before mission preparation. Sequential simulation only; 267.28 seconds, budget 600 seconds. Result: **2 acceptance fail flags**.

[Raw audit receipts](audit.json).

## Measurement contract

Every active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.

Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.

Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median; the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.

Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. The skilled route also gates zero windups in every inventoried combat phase, L2 bridge ≥2/min, L5 search ≥3/min, L10 hold ≥8/min and L6 mortal damage ≥30 HP. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing.

## Run coverage

| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |
|---|---|---:|---:|---:|---:|---:|
| L1 | complete | 115.08 | complete / firestation | 115.08 | 11 | 0 | 10.49 | 0 |
| L2 | complete | 156.12 | complete / bridge | 188.33 | 15 | 1 | 20.00 | 0 |
| L3 | complete | 266.70 | tick-budget / checkpoint | 70.00 | 6 | 3 | 21.56 | 0 |
| L4 | complete | 307.72 | tick-budget / hide | 248.50 | 8 | 26 | 131.32 | 1 |
| L5 | complete | 206.58 | tick-budget / look | 1200.00 | 5 | 0 | 83.90 | 0 |

## Acceptance criteria matrix

| Criterion | Passive measured | Skilled measured | Expected | Verdict |
|---|---:|---:|---|---|
| L1-08 | 25.09 | — | ≥ 3/min | PASS |
| L2-07 | 49.18 (12.20 s) | — | ≥ 4/min | SHORT WINDOW |
| L2-07 reach | 100.00% | — | ≥ 90% | PASS |
| L2-12 | — | 10.38 | ≥ 2 and ≤ 20/min | PASS |
| L3-03 | 89.20 | — | ≥ 4/min | PASS |
| L3-03 reach | 100.00% | — | ≥ 90% | PASS |
| L4-07 | 953.37 | — | ≥ 6/min | PASS |
| L4-07 reach | 100.00% | — | ≥ 90% | PASS |
| L5-05 | 673.08 + 0.66 group | — | ≥ 3/min | PASS |
| L6-05 | not measured | — | ≥ 4/min | NOT MEASURED |
| L6-05 reach | not measured | — | ≥ 95% | NOT MEASURED |
| L6-06 | not measured | — | ≥ 95% | NOT MEASURED |
| L7-05 | not measured | — | ≥ 6/min | NOT MEASURED |
| L8-06 | not measured | — | ≥ 4/min | NOT MEASURED |
| L10-11 | not measured | — | ≥ 8/min | NOT MEASURED |
| G-13 | none | L5/28: 99.0% (45 samples); L5/31: 101.4% (124 samples); wait upper bounds: L5: 0.00% | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | PASS |
| L3-02 cohorts | 15/15, 30/30, 50/50 | 15/15, 30/30, 50/50 | 15/30/50 actual members on low tier | PASS |
| L3-02 stream | 16.73 s scheduled; 15 admitted; 16.57 s scheduled; 30 admitted; 17.08 s scheduled; 50 admitted | — | every cohort admitted within its ≤18 s stream | PASS |
| L3-02 alarm frame | 5/15 | — | ≥25% of opening wave on screen within 2 s | PASS |
| L3-03 first attack | 3.92 s | — | ≤10 s | PASS |
| L4-07 first attack | 9.33 s | — | ≤10 s | PASS |
| L3-06 squad counts/losses | — | 4 → 2; bite, bite | 3–4 at fallback; ≤2 at army; every loss a bite/kill/separation | PASS |
| L3-11 native competent rate | — | 18.47/min; 144 damage; 1 deaths | 3–25 player attacks/min | PASS |
| L4-05 directions/groups | 6 edges; ≥60°: true; max group 5 | — | ≥3 edges ≥60° apart; groups ≤5 at each source | PASS |
| L4-06 first breach | 52.72 s level / +19.90 s alarm; 65 alive | — | level clock 30–60 s; ≥60 alive at first breach | PASS |
| L4-06 sustained horde | minimum 72; 8760 observations; line break 190.00 s | — | ≥40 living in authored plaza from alarm +45 s through line break | PASS |
| L6-03/04 | Breach cohorts: see L6 wave table | — | breach 1 ≥6; breach 2 ≥10 | See wave flags |
| L8-04 | not measured | — | ≥3 outlets ≥20m apart, ≥6/3 each (high/low); no pop-in | FAIL |
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
| step/defend — defend: Help defend the station | L3-03 | 89.20 player + 0.00 group/min; 3.92 s | 20.25 player + 0.00 group/min; 24.90 s | 29/29 | 23/23 | (-134.95, 0.61) | — |
| phase/attack — controller: attack | — | 89.20 player + 0.00 group/min; 3.92 s | 20.25 player + 0.00 group/min; 24.90 s | 29/29 | 23/23 | (-134.95, 0.61) | — |
| step/checkpoint — checkpoint: Get inside the army checkpoint | — | 328.79 player + 120.74 group/min; 0.15 s | 18.47 player + 3.90 group/min; 2.22 s | 60/61 | 0/25 | (-134.95, 0.61) | — |
| phase/fallback — controller: fallback | — | 328.79 player + 120.74 group/min; 0.15 s | 80.90 player + 0.00 group/min; 2.22 s | 60/61 | 18/18 | (-134.95, 0.61) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| station-0 | L3 scheduled wave.at (before admission) | 9.45 | 60.55 | 15 | 15 | — | 3.92 | — |
| station-1 | L3 scheduled wave.at (before admission) | 29.45 | 40.55 | 30 | 30 | — | 3.62 | — |
| station-2 | L3 scheduled wave.at (before admission) | 49.45 | 20.55 | 50 | 50 | — | 8.97 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/checkpoint`, `phase/corridor` at 266.57 s, 25/25 unreachable: `2251@1332` (168.76, -0.68); `2253@1333` (190.05, 0.97); `2255@1334` (192.62, -1.08); `2259@1336` (145.05, 2.12); `2557@1471` (146.21, 1.31); `2559@1472` (146.78, 0.90); `2561@1473` (145.71, -0.07); `2563@1474` (169.60, -0.63); `2565@1475` (184.33, 2.96); `2729@1549` (193.25, -0.80); `2897@1625` (191.18, 1.71); `2899@1626` (195.21, -2.13); `2901@1627` (195.82, -2.57); `2903@1628` (190.69, 0.63); `2905@1629` (190.80, -1.16); `3037@1689` (189.02, 2.39); `3039@1690` (188.54, 1.58); `3041@1691` (183.90, 2.40); `3043@1692` (185.53, 2.97); `3045@1693` (188.19, 2.18); `3093@1717` (173.40, -0.57); `3095@1718` (174.59, -0.46); `3097@1719` (176.82, -0.09); `3099@1720` (176.12, -0.32); `3101@1721` (172.43, -0.69). Player (224.94, 0.98).
- `phase/done` at 266.70 s, 25/25 unreachable: `2251@1332` (169.21, -0.67); `2253@1333` (190.32, 0.60); `2255@1334` (192.45, -0.70); `2259@1336` (145.14, 1.76); `2557@1471` (146.16, 1.29); `2559@1472` (146.76, 0.95); `2561@1473` (145.50, -0.02); `2563@1474` (170.05, -0.63); `2565@1475` (184.47, 3.17); `2729@1549` (193.15, -0.75); `2897@1625` (191.41, 1.38); `2899@1626` (195.57, -2.39); `2901@1627` (196.18, -2.75); `2903@1628` (190.97, 0.41); `2905@1629` (191.01, -1.15); `3037@1689` (189.10, 2.36); `3039@1690` (188.86, 1.26); `3041@1691` (184.23, 2.53); `3043@1692` (185.98, 2.97); `3045@1693` (188.58, 1.89); `3093@1717` (173.85, -0.57); `3095@1718` (175.04, -0.43); `3097@1719` (177.25, 0.05); `3099@1720` (176.55, -0.20); `3101@1721` (172.88, -0.69). Player (224.97, 0.59).

## L4

Threat steps explicitly selected from the loaded mission definition:

- `hold` — Hold the plaza with the army (combat; L4-07).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/ride — ride: Ride into Fairhaven with the convoy | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| phase/convoy — controller: convoy | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/quartermaster — quartermaster: Report to the quartermaster | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| phase/plaza — controller: plaza | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | — | — | — | — |
| step/hold — hold: Hold the plaza with the army | L4-07 | 953.37 player + 0.00 group/min; 9.33 s | 199.21 player + 0.00 group/min; 16.90 s | 80/80 | 78/79 | (-22.85, 0.74) | — |
| phase/war — controller: war | — | 953.37 player + 0.00 group/min; 9.33 s | 199.21 player + 0.00 group/min; 16.90 s | 80/80 | 78/79 | (-22.85, 0.74) | — |
| step/hide — hide: Run to the cellar via Lakeshore, Metro Road and Harbor Street | — | 212.59 player + 0.00 group/min; 0.05 s | 58.15 player + 0.00 group/min; 1.00 s | 70/70 | 78/79 | (34.55, 44.90) | — |
| phase/collapse — controller: collapse | — | 212.59 player + 0.00 group/min; 0.05 s | 58.15 player + 0.00 group/min; 1.00 s | 70/70 | 78/79 | (34.55, 44.90) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| war-0@1969 | l4.wave | 32.82 | 215.68 | 24 | 24 | — | 9.33 | — |
| war-1@2629 | l4.wave | 43.82 | 204.68 | 36 | 36 | — | 14.45 | — |
| breach-west | L4 breach.openAt | 52.72 | 195.78 | — | 96 | — | 8.82 | — |
| war-2@3289 | l4.wave | 54.82 | 193.68 | 48 | 34 | — | 52.78 | — |
| war-3@3949 | l4.wave | 65.82 | 182.68 | 54 | 6 | — | 143.38 | — |
| war--1@4009 | l4.wave | 66.82 | 181.68 | 15 | 0 | — | — | — |
| war-4@4609 | l4.wave | 76.82 | 171.68 | 54 | 0 | — | — | — |
| war-5@5269 | l4.wave | 87.82 | 160.68 | 54 | 0 | — | — | — |
| war-6@5929 | l4.wave | 98.82 | 149.68 | 54 | 0 | — | — | — |
| war-7@6589 | l4.wave | 109.82 | 138.68 | 54 | 0 | — | — | — |
| war-8@7249 | l4.wave | 120.82 | 127.68 | 54 | 0 | — | — | — |
| war-9@7909 | l4.wave | 131.82 | 116.68 | 54 | 0 | — | — | — |
| breach-north | L4 breach.openAt | 138.08 | 110.42 | — | 27 | — | 14.03 | — |
| war-10@8569 | l4.wave | 142.82 | 105.68 | 54 | 0 | — | — | — |
| war-11@9229 | l4.wave | 153.82 | 94.68 | 54 | 0 | — | — | — |
| war-12@9889 | l4.wave | 164.82 | 83.68 | 54 | 0 | — | — | — |
| war-13@10549 | l4.wave | 175.82 | 72.68 | 54 | 0 | — | — | — |
| war-14@11209 | l4.wave | 186.82 | 61.68 | 54 | 0 | — | — | — |
| opening-alarm | L4 opening pending street cohorts | 32.82 | 215.68 | — | 0 | — | — | — |
| war-15@11869 | l4.wave | 197.82 | 50.68 | 54 | 0 | — | — | — |
| breach-south | L4 breach.openAt | 208.70 | 39.80 | — | 1 | — | 15.02 | WAVE_FEWER_THAN_THREE_COHORT_MEMBERS |
| war-16@12529 | l4.wave | 208.82 | 39.68 | 54 | 0 | — | — | — |
| war-17@13189 | l4.wave | 219.82 | 28.68 | 54 | 0 | — | — | — |
| collapse-0@13609 | l4.wave | 226.82 | 21.68 | 6 | 0 | — | — | — |
| collapse-1@14149 | l4.wave | 235.82 | 12.68 | 6 | 0 | — | — | — |
| collapse-2@14689 | l4.wave | 244.82 | 3.68 | 6 | 0 | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/hold`, `phase/war` at 208.82 s, 1/79 unreachable: `211@42` (-27.75, -12.23). Player (-11.00, 16.00).
- `step/hide`, `phase/collapse` at 298.82 s, 1/79 unreachable: `211@42` (-27.75, -12.23). Player (-77.65, -42.45).
- `step/bar` at 299.55 s, 79/79 unreachable: `211@42` (-27.75, -12.23); `215@46` (-71.07, 44.12); `217@48` (-67.38, 42.98); `274@103` (-31.91, -8.43); `311@138` (-69.65, 43.98); `314@141` (-66.32, 43.57); `374@197` (2.17, 25.57); `377@200` (-66.66, 44.16); `393@215` (-56.89, 48.35); `394@216` (-72.03, 42.80); `406@227` (7.76, 53.72); `411@232` (-66.95, 42.35); `414@235` (6.23, 51.41); `425@245` (-68.91, 42.80); `428@247` (-69.33, 43.36); `429@248` (-68.62, 43.41); `430@249` (-66.66, 42.97); `431@250` (-69.99, 44.66); `433@252` (-67.55, 44.01); `434@253` (-68.21, 42.79); `436@255` (-70.33, 44.03); `438@257` (-67.90, 43.42); `442@261` (-70.44, 42.83); `445@264` (-67.91, 44.60); `454@272` (4.42, -35.14); `455@273` (-68.27, 44.02); `458@276` (-65.90, 41.81); `461@279` (-71.45, 43.44); `465@282` (-12.66, 25.54); `466@283` (-69.31, 44.63); `471@288` (-8.80, 39.47); `472@289` (-67.02, 43.57); `475@292` (-71.14, 42.79); `487@302` (-68.63, 44.62); `489@304` (-70.05, 43.41); `490@305` (-19.70, -5.53); `493@308` (-70.75, 43.45); `497@311` (-1.33, 37.97); `499@313` (-69.73, 42.79); `505@319` (-19.47, -6.92); `511@325` (10.32, 2.95); `515@329` (-24.27, 24.43); `520@330` (-17.68, -6.34); `522@332` (-11.96, 19.31); `524@333` (-17.64, -7.26); `525@334` (-37.21, 6.13); `526@335` (-68.97, 44.02); `527@336` (-67.21, 44.60); `529@338` (-67.63, 42.32); `530@339` (-31.25, -8.19); `531@340` (-65.55, 42.44); `532@341` (-19.21, -2.92); `533@342` (-17.76, -5.42); `535@344` (-18.50, -5.94); `536@345` (-27.35, -2.65); `537@346` (-67.31, 41.72); `538@347` (-47.73, -23.09); `539@348` (-42.30, -21.04); `542@351` (-65.89, 43.03); `544@353` (-53.56, 40.97); `545@354` (-18.90, -7.64); `546@355` (-18.11, -3.12); `547@356` (-5.51, 30.66); `548@357` (-18.45, -6.84); `552@361` (10.11, 1.59); `553@362` (-65.16, 41.88); `554@363` (-26.91, -5.05); `579@365` (-66.61, 41.75); `580@366` (-66.25, 42.42); `581@367` (15.49, -23.88); `602@369` (-72.33, 43.58); `604@371` (-71.79, 44.28); `605@372` (-54.67, 40.15); `608@373` (40.88, 47.70); `610@375` (47.96, 34.64); `611@376` (48.58, -15.36); `612@377` (5.84, -37.59); `615@380` (5.38, 51.09); `617@382` (-81.02, -40.06). Player (75.30, -6.40).
- `phase/cellar`, `step/wait` at 306.72 s, 77/77 unreachable: `211@42` (-27.75, -12.23); `215@46` (-71.17, 44.08); `217@48` (-67.45, 43.00); `274@103` (-18.64, -6.12); `311@138` (-69.76, 44.01); `314@141` (-66.41, 43.67); `374@197` (2.17, 25.57); `377@200` (-66.73, 44.27); `393@215` (-54.96, 49.65); `394@216` (-72.09, 42.81); `406@227` (8.54, 50.43); `411@232` (-66.95, 42.40); `414@235` (7.83, 51.20); `425@245` (-69.06, 42.79); `428@247` (-69.43, 43.37); `429@248` (-68.72, 43.41); `430@249` (-66.70, 43.05); `431@250` (-70.12, 44.60); `433@252` (-67.68, 44.00); `434@253` (-68.36, 42.81); `436@255` (-70.49, 44.03); `438@257` (-68.02, 43.40); `442@261` (-70.52, 42.80); `445@264` (-68.00, 44.60); `454@272` (3.24, -35.25); `455@273` (-68.37, 44.01); `458@276` (-65.96, 41.91); `461@279` (-71.51, 43.46); `465@282` (-12.66, 25.54); `466@283` (-69.41, 44.62); `471@288` (-6.48, 40.71); `472@289` (-67.11, 43.61); `475@292` (-71.21, 42.82); `487@302` (-68.71, 44.60); `489@304` (-70.14, 43.42); `490@305` (-19.70, -5.52); `493@308` (-70.83, 43.42); `497@311` (-0.03, 37.97); `499@313` (-69.82, 42.80); `505@319` (-13.85, -9.21); `511@325` (10.45, 2.65); `515@329` (-26.81, 23.61); `520@330` (-17.71, -4.87); `522@332` (-12.85, 16.61); `524@333` (-18.18, -6.63); `525@334` (-37.21, 6.13); `526@335` (-69.06, 44.01); `527@336` (-67.30, 44.65); `529@338` (-67.63, 42.32); `530@339` (-18.75, -7.06); `531@340` (-65.53, 42.60); `532@341` (-21.78, -2.05); `533@342` (-19.55, -3.04); `535@344` (-17.85, -3.23); `537@346` (-67.31, 41.72); `538@347` (-29.03, -20.12); `539@348` (-25.72, -19.59); `541@350` (15.01, -21.19); `542@351` (-65.95, 43.16); `545@354` (-19.27, -6.56); `546@355` (-17.63, -5.79); `547@356` (-4.77, 28.83); `548@357` (-18.40, -5.48); `553@362` (-65.27, 41.97); `554@363` (-19.41, -7.40); `555@364` (-20.13, -3.72); `579@365` (-66.62, 41.78); `580@366` (-66.25, 42.54); `581@367` (16.13, -20.72); `602@369` (-72.41, 43.60); `604@371` (-71.95, 44.36); `608@373` (43.78, 48.83); `610@375` (48.65, 37.33); `611@376` (50.60, -15.51); `612@377` (16.64, -21.56); `614@379` (1.10, 52.44); `617@382` (-75.30, -44.69). Player (74.65, -2.13).
- `phase/done` at 307.72 s, 75/75 unreachable: `211@42` (-27.75, -12.23); `215@46` (-71.20, 44.05); `217@48` (-67.44, 43.00); `274@103` (-18.68, -6.16); `311@138` (-69.79, 43.99); `314@141` (-66.43, 43.68); `374@197` (2.17, 25.57); `377@200` (-66.80, 44.25); `393@215` (-55.44, 50.88); `394@216` (-72.10, 42.80); `406@227` (7.96, 48.34); `411@232` (-66.95, 42.40); `425@245` (-69.06, 42.79); `428@247` (-69.44, 43.37); `429@248` (-68.71, 43.38); `430@249` (-66.75, 43.06); `431@250` (-70.14, 44.61); `433@252` (-67.70, 44.02); `434@253` (-68.34, 42.80); `436@255` (-70.50, 44.03); `438@257` (-68.01, 43.40); `442@261` (-70.53, 42.79); `445@264` (-68.05, 44.61); `454@272` (3.24, -35.25); `455@273` (-68.40, 44.00); `458@276` (-65.93, 41.90); `461@279` (-71.52, 43.46); `465@282` (-12.66, 25.54); `466@283` (-69.44, 44.57); `471@288` (-6.48, 40.72); `472@289` (-67.14, 43.63); `475@292` (-71.22, 42.82); `487@302` (-68.74, 44.61); `489@304` (-70.16, 43.42); `490@305` (-19.70, -5.52); `493@308` (-70.84, 43.41); `497@311` (-0.06, 37.97); `499@313` (-69.84, 42.80); `505@319` (-13.85, -9.40); `511@325` (9.96, -0.29); `515@329` (-26.89, 23.43); `520@330` (-17.57, -3.95); `522@332` (-12.85, 16.70); `524@333` (-17.93, -6.20); `525@334` (-37.21, 6.13); `526@335` (-69.09, 43.96); `527@336` (-67.35, 44.65); `529@338` (-67.63, 42.32); `530@339` (-18.33, -6.78); `531@340` (-65.56, 42.58); `533@342` (-19.66, -3.09); `535@344` (-18.76, -2.88); `537@346` (-67.31, 41.72); `538@347` (-26.47, -19.72); `539@348` (-25.57, -19.57); `541@350` (17.06, -19.50); `542@351` (-65.98, 43.13); `545@354` (-19.03, -6.79); `546@355` (-17.73, -4.87); `547@356` (-5.12, 28.26); `548@357` (-18.41, -5.48); `553@362` (-65.22, 41.98); `554@363` (-19.68, -7.24); `555@364` (-20.13, -3.72); `579@365` (-66.61, 41.78); `580@366` (-66.28, 42.51); `581@367` (16.61, -20.65); `602@369` (-72.43, 43.60); `604@371` (-71.96, 44.36); `608@373` (43.78, 48.83); `610@375` (47.91, 36.23); `611@376` (51.05, -14.59); `612@377` (18.34, -20.19); `614@379` (1.10, 52.44); `617@382` (-74.63, -44.41). Player (74.65, -2.13).

## L5

Threat steps explicitly selected from the loaded mission definition:

- `look` — Look for anyone still alive (combat; L5-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/emerge — emerge: Unbar the cellar door | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/100 | 0/100 | (75.30, -5.39) | — |
| phase/cellar — controller: cellar | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/100 | 0/100 | (74.66, -1.77) | — |
| phase/emerged — controller: emerged | — | 30.00 player + 0.00 group/min; 6.23 s | 30.00 player + 0.00 group/min; 6.23 s | 100/100 | 100/100 | (-79.30, -44.28) | — |
| step/look — look: Look for anyone still alive | L5-05 | 673.08 player + 0.66 group/min; 0.05 s | 3.17 player + 0.00 group/min; 0.05 s | 99/99 | 39/39 | (37.75, -48.75) | — |
| phase/search — controller: search | — | 673.08 player + 0.66 group/min; 0.05 s | 3.17 player + 0.00 group/min; 0.05 s | 99/99 | 39/39 | (37.75, -48.75) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| None announced during native run | — | — | — | — | — | — | — | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/emerge` at 0.02 s, 100/100 unreachable: `84@3` (-20.00, -37.60); `86@4` (-17.50, -36.10); `88@5` (-22.00, 10.00); `90@1` (46.00, 36.00); `91@6` (22.00, -37.40); `93@7` (-26.00, 40.00); `95@8` (-23.50, 41.50); `97@2` (-40.00, -37.40); `98@9` (2.00, 43.60); `100@10` (14.00, -2.00); `102@11` (-12.00, 18.00); `104@12` (44.00, -36.40); `106@13` (46.50, -34.90); `108@14` (-6.00, -37.40); `110@15` (10.00, 13.00); `112@16` (-46.00, -37.50); `114@17` (36.00, -37.40); `116@18` (-12.00, 43.60); `118@19` (14.00, -24.00); `120@20` (-60.00, 43.00); `122@21` (-4.00, 28.00); `124@22` (-40.00, -20.00); `126@23` (-8.90, 2.60); `128@24` (0.10, 2.60); `130@25` (53.50, 41.30); `132@26` (62.50, 41.30); `134@27` (-29.00, -2.70); `136@28` (-25.87, -44.40); `138@29` (-49.50, 50.00); `140@30` (-40.50, 50.00); `142@31` (68.00, -37.40); `144@32` (48.00, -12.00); `146@33` (40.00, 43.60); `148@34` (4.00, -37.40); `150@35` (0.00, -12.00); `152@36` (-4.00, 14.00); `154@37` (-16.00, -12.00); `156@38` (-28.00, -37.40); `158@39` (-32.00, -12.00); `160@40` (-36.00, 14.00); `162@41` (-60.00, -37.40); `164@42` (-72.00, 43.60); `166@43` (64.00, 2.00); `168@44` (60.00, 28.00); `170@45` (48.00, 2.00); `172@46` (4.00, -24.00); `174@47` (-16.00, 2.00); `176@48` (-32.00, 2.00); `178@49` (-36.00, 28.00); `180@50` (56.00, -37.40); `182@51` (52.00, -12.00); `184@52` (48.00, 14.00); `186@53` (12.00, 43.60); `188@54` (8.00, -37.40); `190@55` (0.00, 14.00); `192@56` (-28.00, -12.00); `194@57` (-36.00, 43.60); `196@58` (-52.00, 43.60); `198@59` (-56.00, -37.40); `200@60` (-68.00, 43.60); `202@61` (64.00, 28.00); `204@62` (52.00, 2.00); `206@63` (48.00, 28.00); `208@64` (-16.00, 28.00); `210@65` (-28.00, 2.00); `212@66` (-32.00, 28.00); `214@67` (60.00, -37.40); `216@68` (52.00, 14.00); `218@69` (48.00, 43.60); `220@70` (32.00, 43.60); `222@71` (16.00, 43.60); `224@72` (12.00, -37.40); `226@73` (-8.00, -12.00); `228@74` (-24.00, -12.00); `230@75` (-40.00, -12.00); `232@76` (-48.00, 43.60); `234@77` (68.00, 28.00); `236@78` (56.00, 2.00); `238@79` (52.00, 28.00); `240@80` (-12.00, 28.00); `242@81` (-20.00, -24.00); `244@82` (-24.00, 2.00); `246@83` (-28.00, 28.00); `248@84` (68.00, 43.60); `250@85` (64.00, -37.40); `252@86` (36.00, 43.60); `254@87` (12.00, -12.00); `256@88` (-4.00, -12.00); `258@89` (-20.00, -12.00); `260@90` (-32.00, -37.40); `262@91` (-36.00, -12.00); `264@92` (-40.00, 14.00); `266@93` (-44.00, 43.60); `268@94` (-64.00, -37.40); `270@95` (-76.00, 43.60); `272@96` (60.00, 2.00); `274@97` (56.00, 28.00); `276@98` (48.00, -24.00); `278@99` (0.00, -24.00); `280@100` (-20.00, 2.00). Player (75.30, -5.39).
- `phase/cellar` at 1.00 s, 100/100 unreachable: `84@3` (-20.00, -37.60); `86@4` (-17.30, -36.15); `88@5` (-21.79, 9.95); `90@1` (46.00, 36.00); `91@6` (21.56, -37.50); `93@7` (-26.00, 40.00); `95@8` (-23.54, 41.62); `97@2` (-40.00, -37.40); `98@9` (2.30, 43.54); `100@10` (13.96, -1.67); `102@11` (-12.00, 18.02); `104@12` (44.18, -36.40); `106@13` (46.31, -35.00); `108@14` (-5.70, -37.42); `110@15` (10.01, 12.98); `112@16` (-45.87, -37.55); `114@17` (36.12, -37.62); `116@18` (-12.02, 43.63); `118@19` (13.92, -24.32); `120@20` (-59.98, 42.86); `122@21` (-4.05, 27.91); `124@22` (-39.89, -19.80); `126@23` (-8.69, 2.47); `128@24` (0.07, 2.56); `130@25` (53.78, 41.29); `132@26` (62.49, 41.32); `134@27` (-28.94, -2.77); `136@28` (-25.87, -44.40); `138@29` (-49.58, 49.96); `140@30` (-40.83, 49.94); `142@31` (68.43, -37.61); `144@32` (48.04, -11.61); `146@33` (40.02, 43.64); `148@34` (4.29, -37.38); `150@35` (-0.01, -12.00); `152@36` (-4.04, 13.99); `154@37` (-16.04, -11.90); `156@38` (-27.82, -37.50); `158@39` (-31.77, -11.82); `160@40` (-36.01, 13.99); `162@41` (-60.16, -37.49); `164@42` (-72.22, 43.71); `166@43` (64.00, 2.00); `168@44` (59.86, 28.08); `170@45` (47.99, 1.50); `172@46` (3.72, -23.88); `174@47` (-16.01, 1.98); `176@48` (-32.00, 2.00); `178@49` (-36.10, 27.98); `180@50` (56.12, -37.42); `182@51` (51.96, -11.92); `184@52` (48.01, 14.00); `186@53` (11.51, 43.65); `188@54` (8.17, -37.30); `190@55` (-0.00, 14.00); `192@56` (-27.99, -12.00); `194@57` (-36.01, 43.64); `196@58` (-52.03, 43.55); `198@59` (-55.97, -37.40); `200@60` (-67.90, 43.72); `202@61` (63.63, 28.21); `204@62` (52.00, 2.00); `206@63` (48.07, 28.41); `208@64` (-15.98, 27.98); `210@65` (-28.00, 1.97); `212@66` (-32.11, 27.82); `214@67` (59.95, -37.39); `216@68` (51.77, 14.24); `218@69` (48.03, 43.62); `220@70` (32.04, 44.10); `222@71` (15.82, 43.69); `224@72` (11.76, -37.58); `226@73` (-7.99, -11.98); `228@74` (-23.98, -11.89); `230@75` (-40.00, -12.00); `232@76` (-48.00, 43.60); `234@77` (68.00, 28.00); `236@78` (55.97, 1.98); `238@79` (51.99, 27.97); `240@80` (-11.90, 27.80); `242@81` (-20.00, -24.00); `244@82` (-23.91, 2.30); `246@83` (-28.35, 27.68); `248@84` (67.93, 43.62); `250@85` (63.88, -37.39); `252@86` (35.90, 43.65); `254@87` (11.93, -11.75); `256@88` (-4.06, -11.74); `258@89` (-20.34, -11.70); `260@90` (-31.88, -37.46); `262@91` (-36.15, -12.28); `264@92` (-39.99, 14.06); `266@93` (-44.36, 43.63); `268@94` (-64.00, -37.40); `270@95` (-76.14, 43.65); `272@96` (59.63, 1.80); `274@97` (55.69, 27.90); `276@98` (48.00, -23.97); `278@99` (-0.07, -23.96); `280@100` (-19.77, 2.27). Player (74.66, -1.77).
- `step/metro`, `phase/shelter` at 205.58 s, 22/22 unreachable: `88@5` (-19.35, 8.44); `90@1` (44.27, 32.43); `91@6` (18.12, -36.03); `97@2` (-41.33, -40.14); `98@9` (0.44, 50.16); `108@14` (-18.44, -37.10); `110@15` (14.48, 7.83); `118@19` (12.71, -28.91); `128@24` (-9.42, 5.86); `142@31` (74.21, -36.09); `148@34` (10.65, -39.08); `162@41` (-75.55, -40.68); `164@42` (-67.37, 45.84); `166@43` (47.70, -3.27); `172@46` (15.74, -25.51); `188@54` (13.40, -34.04); `224@72` (13.59, -29.20); `230@75` (-35.27, -12.57); `234@77` (65.27, 28.99); `248@84` (66.57, 51.66); `270@95` (-68.79, 52.44); `278@99` (-6.44, -14.67). Player (38.19, -50.04).
- `phase/done` at 206.58 s, 22/22 unreachable: `88@5` (-19.76, 7.48); `90@1` (44.27, 32.43); `91@6` (19.07, -37.04); `97@2` (-41.33, -40.14); `98@9` (0.63, 50.83); `108@14` (-18.43, -37.10); `110@15` (15.73, 7.74); `118@19` (13.11, -29.86); `128@24` (-10.02, 6.22); `142@31` (74.24, -36.08); `148@34` (11.93, -39.26); `162@41` (-74.74, -39.89); `164@42` (-66.22, 45.93); `166@43` (47.55, -2.22); `172@46` (16.00, -24.39); `188@54` (13.40, -34.04); `224@72` (13.97, -30.17); `230@75` (-35.26, -12.55); `234@77` (65.36, 28.94); `248@84` (65.74, 52.29); `270@95` (-70.05, 52.82); `278@99` (-7.38, -15.12). Player (38.19, -50.04).

## Every fail flag

- L4/wave/breach-south:WAVE_FEWER_THAN_THREE_COHORT_MEMBERS
- PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate

## Flag-to-criterion mapping

| Flag | Acceptance criterion |
|---|---|
| L4/wave/breach-south:WAVE_FEWER_THAN_THREE_COHORT_MEMBERS | L4-05, G-22 |
| PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate | see level-specific threat criterion |

Absolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.

## Defect triage provenance

Historical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.

Run `npm run qa:threat -- --maxWorkers=2` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat -- --maxWorkers=2`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.
