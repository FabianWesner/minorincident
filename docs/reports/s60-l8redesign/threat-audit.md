# Threat calibration

Runtime main: `91199b68a851a4e378ef9deae88d449c5f768e93`; harness base: `1ae1f4d795798a113bb6e3e83f4249d6033a2271`. Runtime source matches main: **false**. Seed 1 skilled routes are native completion runs, with a separate disposable kiting probe; L5/L7 follower pace additionally uses unchanged native seeds 2–3. Passive native routes are unchanged, **low** population set before mission preparation. During a marked combat phase (including L5’s opening street encounter and L10’s regional street fights before the cure), at the first nearby pressing horde of at least three infected, the kiting policy walks away, aims back and fires the selected weapon continuously for a 20-second encounter sample, then ends that disposable probe. The native completion receipt and state hash come from the uninterrupted skilled route. Kiting receipts retain attack starts and separately count landed infected attacks with positive damage while the courier physically moves after the final physics commit; missed and interrupted windups and courier shots cannot satisfy the hit floor. Set MI_THREAT_KITING_STYLE=circles for the constant circular movement policy; the default is retreat kiting. The floor is **2 landed hits/minute while moving**; rows distinguish short samples. At most 4 simulation workers across independent levels or extra follower seeds; 186.34 seconds, budget 600 seconds. Result: **2 acceptance fail flags**.

[Raw audit receipts](audit.json).

## Measurement contract

Every active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.

Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.

Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median (L5/L7: the same follower/phase must fail in at least two valid seeds out of seeds 1–3); the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.

Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. L10 includes the living hunters already within 30 m at console activation, alongside new assault admissions. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. Skilled completion is required for every level, alongside zero-windup checks in inventoried combat phases, L2 bridge ≥2/min, L5 search ≥3/min and L6 mortal damage ≥30 HP. L10’s ≥8/min floor applies to its stationary ground policy; the skilled route uses the protected mounted platform. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, 150 s for L8, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing. Redesigned route budgets are 600 s for L9 and 1,800 s for L10, including ordinary retries.

## Run coverage

| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |
|---|---|---:|---:|---:|---:|---:|
| L8 | complete | 411.25 | tick-budget / escape | 210.00 | 4 | 4 | 185.02 | 1 |

## Kiting policy by level

The circle policy runs clockwise around a fixed walkable centre, at full run speed, for the same 20-second window. Radius is 4 m, reduced to 3 or 2 m when needed for the floor plan. Direct movement input avoids inherited click-route smoothing; local steering avoids live bodies and keeps the courier on supported ground. The centre stays fixed. It requires physical movement for at least 95% of controllable ticks; successful enemy pins/staggers are reported separately. Only hits while physically moving count, and their rate still uses the entire encounter window.

| Level | Style | Seconds | Moving seconds | Immobilized seconds | Attack starts | Hits landed while moving | Hits/min | Floor | Verdict |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| L8 | retreat | 20.00 | 20.00 | 0.00 | 7 | 4 | 12.00 | ≥2 landed/min when present | PASS |

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
| L6-05 | not measured | — | ≥ 4/min | NOT MEASURED |
| L6-05 reach | not measured | — | ≥ 95% | NOT MEASURED |
| L6-06 | not measured | — | ≥ 95% | NOT MEASURED |
| L7-05 | not measured | — | ≥ 6/min | NOT MEASURED |
| L8-06 | 162.62 + 5.81 group | — | ≥ 4/min | PASS |
| L10-11 | not measured | — | ≥ 8/min | NOT MEASURED |
| G-13 | none | L8/354: 99.2% (298 samples); L8/359: 100.2% (308 samples); L8/362: 99.4% (307 samples); L8/363: 101.2% (303 samples); L8/364: 99.4% (308 samples); L8/365: 100.2% (307 samples); L8/366: 102.0% (305 samples); wait upper bounds: L8: 3.22% | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | PASS |
| L3-02 cohorts | not measured | not measured | 15/25/35 actual members on low tier | NOT MEASURED |
| L3-02 stream | not measured | — | every cohort admitted within its ≤18 s stream | NOT MEASURED |
| L3-02 alarm frame | not measured | — | ≥25% of opening wave on screen within 2 s | NOT MEASURED |
| L3-03 first attack | not measured | — | ≤10 s | NOT MEASURED |
| L4-07 first attack | not measured | — | ≤10 s | NOT MEASURED |
| L3-06 squad counts/losses | — | not measured | 3–4 at fallback; ≥2 at army (PO 2026-11-07; seeds 1–3: ≥2 valid, ≥2 of them ≥2); every loss a bite/kill/separation | NOT MEASURED |
| L3-07 squad hits and player damage | — | 0/0 seeds pass () | officer hits>0; player damage<100HP; 2 of 3 valid seeds pass | NOT MEASURED |
| L3-08 segment density and concurrent cap | — | 0/0 seeds pass () | medianS1<S2<S3;max≤100 low; 2 of 3 valid seeds pass | NOT MEASURED |
| L3-11 native competent rate | — | not measured; 0/0 | 3–25 infected attacks against player/min; 2 of 3 valid seeds pass | NOT MEASURED |
| L4-05 directions/groups | not measured | — | ≥3 edges ≥60° apart; groups ≤5 at each source | NOT MEASURED |
| L4-06 first breach | not measured | — | level clock 30–60 s; ≥60 alive at first breach | NOT MEASURED |
| L4-06 sustained horde | not measured | — | ≥40 living in authored plaza from alarm +45 s through line break | NOT MEASURED |
| L6-03/04 | Breach cohorts: see L6 wave table | — | breach 1 ≥6; breach 2 ≥10 | See wave flags |
| L8-04 | 19/18 across 6 outlets [3, 3, 4, 3, 3, 3] | — | ≥3 outlets ≥20m apart, ≥6/3 each (high/low); no pop-in | LEDGER PASS; visual pending |
| G-22 | See announced-wave table below | Informational | first attack ≤ 20 s; several reachable infected at start | See wave flags |
| L9-03 | Not measured by this harness | Not measured | ≥ 1 group/wanderer in camera frame per 60 s, each route | NOT TESTED (harness gap) |

## L8

Threat steps explicitly selected from the loaded mission definition:

- `escape` — Lead the group to the armored vehicle (breach combat; L8-06).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/sanctuary — sanctuary: Follow Nadia to the central plaza | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-0.11, -0.38) | — |
| phase/sanctuary — controller: sanctuary | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (-0.11, -0.38) | — |
| step/escape — escape: Lead the group to the armored vehicle | L8-06 | 162.62 player + 5.81 group/min; 3.42 s | 8.46 player + 0.71 group/min; 30.02 s | worst 17/25; last 17/25 | 14/44 | (-0.11, -0.38) | UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS |
| phase/breached — controller: breached | — | 162.62 player + 5.81 group/min; 3.42 s | 8.46 player + 0.71 group/min; 30.02 s | worst 17/25; last 17/25 | 14/44 | (-0.11, -0.38) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| tunnel-breach | L8 breachedAt/story.say | 148.02 | 61.98 | 18 | 19 | 3, 3, 4, 3, 3, 3 | 3.42 | — |
| tunnel-reinforcement@9481 | L8 nextWave clock | 158.02 | 51.98 | 24 | 2 | — | 23.57 | — |
| tunnel-reinforcement@9601 | L8 reinforcement clock | 160.02 | 49.98 | 24 | 4 | — | 3.33 | — |
| tunnel-reinforcement@10321 | L8 reinforcement clock | 172.02 | 37.98 | 24 | 4 | — | 3.30 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/escape`, `phase/breached` at 402.02 s, 30/44 unreachable: `438@11` (0.09, -37.63); `440@1` (7.35, -22.59); `441@12` (-4.28, -34.85); `443@13` (-2.49, -13.57); `445@2` (12.23, -12.83); `446@3` (-1.03, 13.96); `448@14` (-0.31, -1.44); `450@15` (-6.91, -3.62); `452@16` (0.17, -22.21); `454@17` (4.21, -34.34); `458@19` (-3.34, -37.95); `463@20` (-2.15, -4.36); `465@21` (1.36, -19.96); `467@22` (-4.09, -3.66); `469@23` (-5.16, 2.67); `471@24` (-1.53, -19.04); `473@25` (-10.33, -39.13); `479@29` (-5.49, 0.77); `481@30` (3.51, -2.31); `483@31` (-10.25, -43.55); `528@56` (-65.17, -34.61); `530@57` (-51.73, -39.17); `532@58` (-50.07, -63.76); `394@66` (0.43, -49.21); `413@73` (3.90, 12.03); `384@76` (-66.09, -31.96); `379@77` (-60.55, -49.65); `369@78` (-56.90, -27.07); `420@85` (1.66, -2.46); `374@89` (-60.25, -36.26). Player (91.97, 72.33).
- `step/depart` at 409.25 s, 47/47 unreachable: `426@5` (-104.61, 16.05); `428@6` (-95.88, 58.63); `430@7` (-92.42, 72.47); `432@8` (94.68, -16.81); `434@9` (96.34, 28.16); `436@10` (97.72, 23.51); `438@11` (0.09, -41.55); `440@1` (9.26, -24.83); `441@12` (-0.22, -39.90); `443@13` (-2.31, -19.44); `445@2` (12.23, -12.83); `446@3` (1.00, 17.46); `447@4` (23.08, 21.04); `448@14` (0.92, -8.10); `450@15` (-9.24, 1.24); `452@16` (-2.58, -27.64); `454@17` (9.43, -37.90); `456@18` (-30.62, -40.37); `458@19` (-4.31, -40.69); `463@20` (0.56, -9.43); `465@21` (1.34, -24.96); `467@22` (-4.33, 0.41); `469@23` (-9.95, 1.82); `471@24` (-6.45, -22.57); `473@25` (-3.97, -35.34); `479@29` (-5.89, -0.60); `481@30` (6.62, 3.30); `483@31` (-2.71, -41.56); `485@32` (-30.97, -32.80); `528@56` (-69.74, -28.73); `530@57` (-49.96, -38.56); `532@58` (-55.01, -64.88); `536@61` (-12.30, 59.01); `538@64` (-110.84, 36.22); `540@65` (-100.84, 21.40); `542@62` (24.19, 48.88); `543@63` (26.13, 40.24); `394@66` (1.17, -49.50); `413@73` (3.90, 12.03); `376@74` (-15.58, 79.29); `553@75` (68.88, 83.09); `384@76` (-58.01, -33.30); `379@77` (-60.48, -56.40); `369@78` (-53.06, -23.09); `563@83` (88.02, -9.32); `420@85` (-0.97, -3.15); `374@89` (-64.24, -36.22). Player (138.00, 74.00).
- `phase/boarding` at 411.25 s, 48/48 unreachable: `426@5` (-104.46, 16.11); `428@6` (-96.04, 56.20); `430@7` (-92.32, 73.16); `432@8` (94.68, -16.88); `434@9` (95.98, 28.25); `436@10` (97.51, 21.09); `438@11` (0.65, -40.92); `440@1` (10.03, -24.15); `441@12` (0.42, -40.03); `443@13` (-2.23, -22.18); `445@2` (12.23, -12.83); `446@3` (2.31, 19.70); `447@4` (24.47, 22.70); `448@14` (1.39, -10.32); `450@15` (-8.27, -0.58); `452@16` (-3.81, -30.05); `454@17` (9.37, -37.88); `456@18` (-30.54, -38.18); `458@19` (-3.30, -42.58); `463@20` (1.61, -11.52); `465@21` (-0.58, -26.77); `467@22` (-2.12, -0.39); `469@23` (-8.32, 1.22); `471@24` (-6.02, -23.08); `473@25` (-1.99, -34.16); `479@29` (-4.59, -2.33); `481@30` (5.65, 3.12); `483@31` (-0.27, -40.90); `485@32` (-28.70, -31.60); `528@56` (-71.04, -27.05); `530@57` (-50.16, -39.34); `532@58` (-57.47, -65.47); `536@61` (-10.96, 56.90); `538@64` (-109.95, 38.81); `540@65` (-100.09, 19.32); `542@62` (22.62, 48.47); `543@63` (25.82, 39.09); `394@66` (0.77, -51.61); `413@73` (3.90, 12.03); `376@74` (-18.22, 79.96); `553@75` (69.74, 81.14); `384@76` (-56.81, -33.50); `379@77` (-60.46, -58.53); `369@78` (-50.62, -22.34); `563@83` (87.97, -8.22); `420@85` (1.48, -3.30); `374@89` (-66.62, -35.94); `396@90` (69.64, 84.70). Player (138.00, 74.00).

## Every fail flag

- L8/step/escape:UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS
- PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate

## Flag-to-criterion mapping

| Flag | Acceptance criterion |
|---|---|
| L8/step/escape:UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS | L8-06 |
| PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate | see level-specific threat criterion |

Absolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.

## Defect triage provenance

Historical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.

Run `npm run qa:threat` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.
