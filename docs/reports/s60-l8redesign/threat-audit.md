# Threat calibration

Runtime main: `c5dd80ef38ee3668428e6e37c918debf03c77aa0`; harness base: `96594e0ec240c8c7397f8cfb0a18986a53d3ce10`. Runtime source matches main: **false**. Seed 1 skilled routes are native completion runs, with a separate disposable kiting probe; L5/L7 follower pace additionally uses unchanged native seeds 2–3. Passive native routes are unchanged, **low** population set before mission preparation. During a marked combat phase (including L5’s opening street encounter and L10’s regional street fights before the cure), at the first nearby pressing horde of at least three infected, the kiting policy walks away, aims back and fires the selected weapon continuously for a 20-second encounter sample, then ends that disposable probe. The native completion receipt and state hash come from the uninterrupted skilled route. Kiting receipts retain attack starts and separately count landed infected attacks with positive damage while the courier physically moves after the final physics commit; missed and interrupted windups and courier shots cannot satisfy the hit floor. Set MI_THREAT_KITING_STYLE=circles for the constant circular movement policy; the default is retreat kiting. The floor is **2 landed hits/minute while moving**; rows distinguish short samples. At most 4 simulation workers across independent levels or extra follower seeds; 86.73 seconds, budget 600 seconds. Result: **1 acceptance fail flags**.

[Raw audit receipts](audit.json).

## Measurement contract

Every active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.

Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.

Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median (L5/L7: the same follower/phase must fail in at least two valid seeds out of seeds 1–3); the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.

Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. L10 includes the living hunters already within 30 m at console activation, alongside new assault admissions. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. Skilled completion is required for every level, alongside zero-windup checks in inventoried combat phases, L2 bridge ≥2/min, L5 search ≥3/min and L6 mortal damage ≥30 HP. L10’s ≥8/min floor applies to its stationary ground policy; the skilled route uses the protected mounted platform. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, 150 s for L8, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing. Redesigned route budgets are 600 s for L9 and 1,800 s for L10, including ordinary retries.

## Run coverage

| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |
|---|---|---:|---:|---:|---:|---:|
| L8 | complete | 397.27 | tick-budget / escape | 150.00 | 4 | 1 | 86.39 | 0 |

## Kiting policy by level

The circle policy runs clockwise around a fixed walkable centre, at full run speed, for the same 20-second window. Radius is 4 m, reduced to 3 or 2 m when needed for the floor plan. Direct movement input avoids inherited click-route smoothing; local steering avoids live bodies and keeps the courier on supported ground. The centre stays fixed. It requires physical movement for at least 95% of controllable ticks; successful enemy pins/staggers are reported separately. Only hits while physically moving count, and their rate still uses the entire encounter window.

| Level | Style | Seconds | Moving seconds | Immobilized seconds | Attack starts | Hits landed while moving | Hits/min | Floor | Verdict |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| L8 | retreat | 20.00 | 20.00 | 0.00 | 2 | 1 | 3.00 | ≥2 landed/min when present | PASS |

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
| L8-06 | 30.68 + 20.45 group | — | ≥ 4/min | PASS |
| L10-11 | not measured | — | ≥ 8/min | NOT MEASURED |
| G-13 | none | L8/354: 98.0% (278 samples); L8/359: 99.3% (290 samples); L8/362: 99.7% (292 samples); L8/363: 100.2% (289 samples); L8/364: 100.1% (293 samples); L8/365: 100.5% (291 samples); L8/366: 100.9% (291 samples); wait upper bounds: L8: 3.10% | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | PASS |
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
| step/sanctuary — sanctuary: Follow Nadia to the central plaza | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.67, -1.11) | — |
| phase/sanctuary — controller: sanctuary | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.67, -1.11) | — |
| step/escape — escape: Lead the group to the armored vehicle | L8-06 | 30.68 player + 20.45 group/min; 4.58 s | 8.81 player + 0.49 group/min; 31.35 s | 17/17 | 24/44 | (0.67, -1.11) | — |
| phase/breached — controller: breached | — | 30.68 player + 20.45 group/min; 4.58 s | 8.81 player + 0.49 group/min; 31.35 s | 17/17 | 24/44 | (0.67, -1.11) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| tunnel-breach | L8 breachedAt/story.say | 144.13 | 5.87 | 18 | 19 | 3, 3, 4, 3, 3, 3 | 4.58 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- `step/escape`, `phase/breached` at 388.13 s, 20/44 unreachable: `438@11` (-6.87, -30.95); `440@1` (7.13, -15.09); `443@13` (5.93, -33.31); `448@14` (2.52, -15.52); `450@15` (0.44, -28.31); `452@16` (0.25, -23.29); `454@17` (-1.32, -43.10); `456@18` (-1.42, -36.85); `458@19` (-5.58, -38.22); `463@20` (3.87, 0.34); `465@21` (5.01, -33.22); `467@22` (7.32, -34.97); `469@23` (0.85, -9.67); `473@25` (-4.59, -27.77); `477@27` (-3.49, -14.97); `479@28` (8.40, 1.96); `483@30` (1.69, -36.25); `421@32` (7.72, -40.27); `531@58` (0.47, -31.56); `533@59` (4.56, -39.88). Player (91.97, 72.32).
- `step/depart` at 395.27 s, 44/44 unreachable: `426@5` (-99.08, 15.17); `428@6` (-110.89, 41.77); `430@7` (-111.96, 27.86); `432@8` (96.44, -21.96); `436@10` (89.77, 16.04); `438@11` (-7.22, -36.08); `440@1` (4.76, -12.63); `441@12` (-25.57, -20.89); `443@13` (8.44, -39.17); `445@2` (13.51, 36.13); `446@3` (-8.13, 9.21); `447@4` (82.05, 69.49); `448@14` (-0.28, -23.70); `450@15` (4.13, -36.43); `452@16` (-4.27, -25.24); `454@17` (3.75, -40.17); `456@18` (-2.95, -39.11); `458@19` (-9.69, -35.34); `463@20` (4.63, 1.57); `465@21` (7.43, -37.37); `467@22` (6.99, -40.20); `469@23` (-0.61, -14.53); `471@24` (-14.32, -56.56); `473@25` (-1.91, -33.79); `477@27` (2.14, -14.23); `479@28` (6.01, 1.03); `481@29` (-21.48, -20.57); `483@30` (3.48, -43.67); `421@32` (6.08, -40.29); `529@57` (-61.05, -2.17); `531@58` (-6.36, -31.11); `533@59` (11.10, -35.34); `537@62` (-100.35, -3.58); `539@65` (-95.85, 20.69); `541@66` (-103.39, 24.56); `543@63` (25.16, 26.45); `544@64` (-24.26, 48.27); `413@71` (4.08, 12.33); `416@73` (3.94, 11.74); `381@75` (-86.77, 81.10); `559@80` (78.19, -43.89); `382@81` (-37.95, -7.13); `394@86` (-10.31, -60.88); `384@87` (-13.34, -58.36). Player (138.00, 74.00).
- `phase/boarding` at 397.27 s, 45/45 unreachable: `426@5` (-100.44, 14.75); `428@6` (-110.56, 42.61); `430@7` (-111.96, 27.86); `432@8` (94.79, -22.83); `436@10` (88.39, 17.69); `438@11` (-8.02, -38.35); `440@1` (8.71, -12.63); `441@12` (-25.27, -18.89); `443@13` (9.42, -39.60); `445@2` (12.38, 36.88); `446@3` (-8.16, 9.87); `447@4` (83.40, 72.90); `448@14` (-1.06, -25.99); `450@15` (4.59, -37.45); `452@16` (-6.97, -25.22); `454@17` (5.27, -39.30); `456@18` (-1.64, -41.30); `458@19` (-7.93, -35.01); `463@20` (4.61, 1.58); `465@21` (5.89, -37.65); `467@22` (4.70, -41.70); `469@23` (-0.59, -16.55); `471@24` (-12.36, -57.10); `473@25` (-3.64, -34.61); `477@27` (0.46, -16.22); `479@28` (3.68, -0.31); `481@29` (-21.28, -18.07); `483@30` (3.47, -43.48); `421@32` (5.31, -38.38); `529@57` (-59.81, 0.10); `531@58` (-8.45, -30.95); `533@59` (12.01, -34.46); `537@62` (-101.21, -1.92); `539@65` (-96.43, 21.05); `541@66` (-102.15, 22.88); `543@63` (25.67, 27.22); `544@64` (-24.72, 50.37); `413@71` (4.08, 12.33); `416@73` (3.94, 11.74); `381@75` (-86.76, 81.22); `559@80` (77.50, -44.70); `382@81` (-36.50, -9.44); `563@83` (92.96, 67.33); `394@86` (-10.52, -63.08); `384@87` (-13.20, -60.77). Player (138.00, 74.00).

## Every fail flag

- PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate

## Flag-to-criterion mapping

| Flag | Acceptance criterion |
|---|---|
| PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate | see level-specific threat criterion |

Absolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.

## Defect triage provenance

Historical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.

Run `npm run qa:threat` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.
