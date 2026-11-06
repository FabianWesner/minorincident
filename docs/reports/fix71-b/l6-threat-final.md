# Threat calibration

Runtime main: `ed487cc912550aede8413aaf578cfe08fb8e0d2d`; harness base: `be991818d6ae4cf5e31ce6c64780d62eb8a9da8a`. Runtime source matches main: **false**. Seed 1, skilled and passive native routes, **low** population set before mission preparation. Sequential simulation only; 7.54 seconds, budget 600 seconds. Result: **2 acceptance fail flags**.

[Raw baseline receipts](baseline.json).

## Measurement contract

Every active mission step is measured, including simultaneous objectives and instant completions; controller phases have separate rows. These overlapping views must not be summed. L1 combat starts in controller `spread`, after the instantaneous escape milestone. L2 ambush combat starts in controller `collapse`, after the doors open; the earlier door-forcing objective is retained without a combat tag. Duration is actual active fixed ticks (cinematics/results excluded). Spawn counts count successful spawns and civilian conversions, with a fresh generation for each reused pool record; “at start” is the first-tick living population. Observed/path/contact counts are unique generations seen during that phase. Contact means ever within 2.5 m of the moving player. Attacks and first-attack times count targeted attack telegraphs (including interrupted windups), physical civilian grabs and synchronous escort strikes. Support roars, screams and revives are excluded; resolved hits are never counted again. Player and following-party targets have separate counters.

Path queries use an independent copy of the native infected AI grid, with identical walls, mask, live blockers and radius rules; the Mega uses its native pursuit grid. Live resumable searches are never advanced by the audit. Queries run every two simulated seconds and on phase changes. All active living infected count in the denominator, including hidden/pending arrivals; pending admission is unreachable until admitted. Contact requires visible admission. A threat phase fails if >30% remain unreachable for >20 seconds across consecutive samples. Evidence records positions and the player position at that time. Later recovery does not erase a flag. The table also gives the last measured reachable/alive snapshot.

Followers include civilian survivor groups, allied followers, escorts and the companion (never the courier). Each follower’s median uses moving samples plus stationary samples while lagging behind a moving leader. The group min/median compare those individual medians. Leader walking/stationary time uses resolved position changes, never a stale requested velocity. Parked formation shuffling, incapacitated actors and cinematic locks do not count as walking. G-13 flags any follower below 0.95× the group median; the moving native route also measures all stationary courier ticks with any active follower >10 m away, including combat stands, as a conservative upper bound on the ≤10% waiting-share criterion. Raw per-follower values/sample counts are retained in JSON. A pace median needs ten walking samples (five seconds at 2 Hz); the named L5/L7/L8 followers must each have that coverage in the moving native route, so a stationary passive route cannot produce a false PASS. A dash means no walking sample, not zero speed.

Announced waves use native clocks/events and actual cohort ledgers. G-22 is measured by a cohort member making a real attack windup against the player within 20 s; the baseline 10 s proximity heuristic was removed. Only explicit threat announcements and first breach cohorts are gating; recurring reinforcement clocks without an acceptance threshold remain informational. Reachability is judged on the passive snapshot. The skilled route also gates zero windups in every inventoried combat phase, L2 bridge ≥2/min, L5 search ≥3/min, L10 hold ≥8/min and L6 mortal damage ≥30 HP. Passive caps are 70 s for L3, 250 s for L4, 110 s for L6, and 60 s of the L10 hold. A `tick-budget` passive outcome means the window cap ended the native route, not that the measured window is missing.

## Run coverage

| Level | Skilled outcome | Skilled sim s | Passive outcome / furthest step | Passive sim s | Phase rows | Announced waves | Wall seconds | Flags |
|---|---|---:|---:|---:|---:|---:|
| L6 | complete | 275.78 | tick-budget / retreat | 110.00 | 6 | 2 | 7.54 | 0 |

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
| L6-05 | 265.50 | — | ≥ 4/min | PASS |
| L6-05 reach | 100.00% | — | ≥ 95% | PASS |
| L6-06 | 100.00% | — | ≥ 95% | PASS |
| L7-05 | not measured | — | ≥ 6/min | NOT MEASURED |
| L8-06 | not measured | — | ≥ 4/min | NOT MEASURED |
| L10-11 | not measured | — | ≥ 8/min | NOT MEASURED |
| G-13 | none | —; wait upper bounds: — | every follower ≥ 95% of group median; ≥10 walking samples for each named follower; stationary >10m lag ≤10% of escort time | PASS |
| L3-02 cohorts | not measured | not measured | 15/30/50 actual members on low tier | NOT MEASURED |
| L3-02 stream | not measured | — | every cohort admitted within its ≤18 s stream | NOT MEASURED |
| L3-02 alarm frame | not measured | — | ≥25% of opening wave on screen within 2 s | NOT MEASURED |
| L3-03 first attack | not measured | — | ≤10 s | NOT MEASURED |
| L4-07 first attack | not measured | — | ≤10 s | NOT MEASURED |
| L3-06 squad counts/losses | — | not measured | 3–4 at fallback; ≤2 at army (seeds 1–3: ≥2 valid, ≥2 of them ≤2); every loss a bite/kill/separation | NOT MEASURED |
| L3-11 native competent rate | — | not measured | 3–25 player attacks/min | NOT MEASURED |
| L4-05 directions/groups | not measured | — | ≥3 edges ≥60° apart; groups ≤5 at each source | NOT MEASURED |
| L4-06 first breach | not measured | — | level clock 30–60 s; ≥60 alive at first breach | NOT MEASURED |
| L4-06 sustained horde | not measured | — | ≥40 living in authored plaza from alarm +45 s through line break | NOT MEASURED |
| L6-03/04 | Breach cohorts: see L6 wave table | — | breach 1 ≥6; breach 2 ≥10 | See wave flags |
| L8-04 | not measured | — | ≥3 outlets ≥20m apart, ≥6/3 each (high/low); no pop-in | FAIL |
| G-22 | See announced-wave table below | Informational | first attack ≤ 20 s; several reachable infected at start | See wave flags |
| L9-03 | Not measured by this harness | Not measured | ≥ 1 group/wanderer in camera frame per 60 s, each route | NOT TESTED (harness gap) |

## L6

Threat steps explicitly selected from the loaded mission definition:

- `stop` — Stop the infected (combat; L6-05).

| Step / controller phase | Criterion | Passive attacks/min; first s | Skilled attacks/min; first s | Passive reachable | Skilled reachable | Passive player x/z | Passive flags |
|---|---|---:|---:|---:|---:|---|---|
| step/shelter — shelter: Look around the shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| phase/shelter — controller: shelter | — | 0.00 player + 0.00 group/min; — s | 0.00 player + 0.00 group/min; — s | 0/0 | 0/0 | (0.33, 3.56) | — |
| step/stop — stop: Stop the infected | L6-05 | 265.50 player + 88.50 group/min; 5.77 s | 0.00 player + 28.07 group/min; — s | 20/20 | 8/8 | (0.33, 3.56) | — |
| phase/first — controller: first | — | 265.50 player + 88.50 group/min; 5.77 s | 0.00 player + 11.42 group/min; — s | 20/20 | 4/4 | (0.33, 3.56) | — |
| step/retreat — retreat: Cover the retreat through the tunnel | — | 848.64 player + 168.87 group/min; 0.05 s | 23.10 player + 61.10 group/min; 24.33 s | 30/30 | 23/23 | (0.33, 3.56) | — |
| phase/retreat — controller: retreat | — | 848.64 player + 168.87 group/min; 0.05 s | 23.10 player + 61.10 group/min; 24.33 s | 30/30 | 23/23 | (0.33, 3.56) | — |

| Announced wave | Native start source | Start s | Observed s | Expected | Spawned cohort | Per-outlet cohort | First attack s | Flags |
|---|---|---:|---:|---:|---:|---|---:|---|
| l6.breach1 | l6.breach1 | 33.20 | 76.80 | 8 | 8 | — | 5.77 | — |
| l6.breach2 | l6.breach2 | 54.22 | 55.78 | 10 | 10 | — | 9.73 | — |

Unreachable infected (sustained-threshold evidence when present, otherwise the last sample; coordinates in metres):

- No unreachable identities in the recorded phase snapshots.

## Every fail flag

- PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate
- BASELINE_MAIN_SOURCE_NOT_VERIFIED

## Flag-to-criterion mapping

| Flag | Acceptance criterion |
|---|---|
| PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate | see level-specific threat criterion |
| BASELINE_MAIN_SOURCE_NOT_VERIFIED | see level-specific threat criterion |

Absolute targets come from `docs/qa/level-acceptance.md`. L4 high-tier census supplements the low-tier passive contact/reachability run; its plaza uses the authored `l4.map.plaza` bounds. Both level and alarm clocks are reported; first breach must occur at level time 30–60 s with ≥60 alive. L3’s scheduled 18 s streams retain unspawned entries under the strict live cap (E21 §5.6); actual admissions within 18 s are shown separately, and the complete native route must produce every authored member. Armory visibility, actual squad attrition, competent damage and mortal input completion require the playtest report.

## Defect triage provenance

Historical failures and the original handoff are in `docs/reports/threat-calibrate/README.md`. They are baseline evidence, not current-run findings. Current failures are listed above with criterion mappings.

Run `npm run qa:threat -- --maxWorkers=2` for current JSON/Markdown receipts in `test-results/qa-threat/`. To refresh this baseline deliberately, add `--report docs/reports/threat-audit/README.md`. Remote: `sh tools/remote/run.sh "$PWD" --pull test-results/qa-threat -- npm run qa:threat -- --maxWorkers=2`. `npm run qa:threat -- --proof` proves the fail thresholds using deliberately broken fixtures without adding registered unit cases. `npm run qa:threat -- --passive-from test-results/qa-threat/audit.json` repeats the same policies without instrumentation and checks complete state hashes; add the same `--report` option to save proof with the baseline.
