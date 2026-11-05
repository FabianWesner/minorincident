# sweep-c4 — L7–L10 acceptance

Timeboxed sweep; the full acceptance goal remains incomplete. Final current coverage is **18 PASS, 4 FAIL, 25 NOT CHECKED** across 47 rows. Eleven rows changed from non-PASS to PASS; existing L7-10 was independently refreshed. Three additional displayed historical failures have current status NOT CHECKED, not a fresh game failure. Base: `2cc5adb25`; game source SHA-256: `3e6e650651f853dcdd7960a9cc912de97f5c184153973c26983123cc64e3532d`. No game source, criteria, counts, timers, caps or performance budgets changed. No deployment or push.

## Results

| Row | Result | Current evidence and remaining work |
|---|---|---|
| L7-03 | PASS | Both-tier actual mouse/keyboard rocket fixtures: 25-tick cadence (2.4/s), overlapping flight, clicked ground, first body hit, direction-only 35 m fallback, 24/24 normal 60-HP kills and a clear 3 m centre. All 56 main captures and 30 supplementary captures were inspected. The courier, rocket, grid, blood and bodies remain readable; point-blank near-white pixel share peaks at 0.2812%. Six original and four boundary fault controls reject broken evidence. Current exact-criterion review and raw cleanup manifests are retained. |
| L8-06 | PASS | Fresh exact-criterion review binds all four current-source low/high complete/stationary receipts. Skilled windups 5.235/min low and 4.8/min high; passive first attacks 3.817 s both; bounded-path reachability 100% in all four. All 14 unchanged clauses pass and the historical failure is requalified. |
| L7-05 | FAIL retained | Current skilled player/group windups 0.8132/min low and 0/min high versus ≥6/min. Stationary first actual player windups 83.9667 s low and 22.6667 s high versus ≤10 s. The high skilled route has zero player/group windups. These source-bound acceptance failures remain despite the broader threat audit’s separate flag policy. |
| L10-03 | FAIL retained | High research-campus concurrent dog peak 5 versus allowed 2–4. Required simultaneous species/group clauses remain incomplete. No dog count or cap was reduced. |
| L9-02 | FAIL | Both-tier actual admitted group census: road/countryside groups have six members; shortcut groups 3 and 6 each contain nine (eight runners plus an Alpha), against eight total including the two Alphas. All other shortcut groups have eight. No population reduction was applied. Physical detour qualification remains separate. |
| L9-04 | FAIL | Matched normal physical WASD routes from healthy seed-1 starts: low safe 670 HP vs shortcut 890 (FAIL), high safe 940 vs shortcut 870 (PASS). Every actual contact/attack transaction charges 10. Native stopped-surround fixtures show 36-tick windups and 10 damage. Low safe drive included 43.4 s stopped and 163 reverse/recovery commands; causal driver-vs-game diagnosis remains open. All 24 route captures inspected. The prior native-only PASS was narrowed; it did not qualify the browser route clause. |
| L7-07 | PASS | Independent counter observer: 4,427 low / 4,395 high active corridor ticks, zero counter mismatches, zero moving markers, native controls identical. Both pooled physical routes completed without skips/errors. All humans died in guided segments; that limits these routes to counter/marker coverage. All 41 captures from three attempts were inspected and deleted. |
| L8-05 | PASS | Both tiers: 5 admitted Alphas, caps respected in both canonical policies, actual civilian/soldier/staff/animal hits or bites. Healthy existing animals retained IDs/species through 2.533–3.25 s conversions. Six broken-evidence controls rejected; original bytes restored. Isolated extra local threats and courier protection are explicit capability setup. |
| L8-07 | PASS | Both-tier 1.25 m radius clearance queries and slab negative controls, plus actual WASD visits through both exits of all five enclosures (46 goals/tier;4,041/4,068 commands). Fixed APC geometry retained. All 44 captures at both zooms inspected. Native-generated campaign had no surviving L7 humans: this qualifies passages, not escort success. |
| L7-10 | PASS refreshed | Both tiers: all 24 living IDs board, entries at least 15 ticks apart, ten infected remain alive elsewhere. Isolated offscreen stalled follower recovers after 1,200 ticks and enters 36 ticks later. Independent native controls; physical empty-roster runs do not supply this proof. |
| L9-05 | PASS | Actual healthy/zero-HP keyboard driving on both tiers. Separate uninterrupted speed cases measure 17.74463 vs 10.71099m/s (60.3619%) with >100 road samples each. Zero-HP cases cover 1,631/1,541 m. Rendered grey multi-billow smoke absent in healthy cases; close crops clip the trail. All 96 captures inspected. Paused visual cases excluded from speed qualification. Eight fault controls reject. |
| L9-07 | PASS | Same four physical drives: one actual impact each, wreck objective follows impact same tick, HUD follows. Ten fall samples/case retain hull and all four physics wheels; rendered side wheels stay attached through fall 0–9. Healthy-start means 1000 HP initially, 860/960 HP immediately before impact; no claim of 1000 HP at impact. Cinematic forces paired zooms identical. Eight fault controls reject. |
| L10-02 | PASS | Both tiers: native Mega introduction at 5,400 ticks / 90 s; 119 m away, body-clear 155 m away; roar/impact at 5,401. Canonical controls identical; six fault controls reject. |
| L10-05 | PASS | Eight actual WASD approach slices from exact naturally reached Resume states collect pistol/shotgun/MG/rocket without E or actor/objective writes. Same-tick 51/52 pickup checkpoints preserve new arsenal. No birth at pickup tick; rocket approaches admit one natural dog at tick 50, retained separately. Full native four-second inventory-only comparisons have zero births/identical censuses. All 16 frames inspected. |
| L10-06 | PASS | Four actual physical dog encounters, both tiers/both zooms, from natural Resume snapshots. All 49 captures/previews inspected: lean tan/cream infected quadruped distinct from orange corgi with green pack; high crowd partly overlaps but front/right dog remains identifiable. Native 1.1× speed, 10 HP at 1.08 m, 0.65 s windup, 2 s cooldown. |
| L10-09 | PASS | Actual WASD/E recording→canister→laboratory exit, both tiers/both zooms; all 14 captures inspected. Full subtitle meaning legible; white cylinder/teal bands/red cap visible on backpack. Racks unchanged; carried checkpoint persisted. Native four-cardinal 120-tick trajectories identical with/without only canister; independent mortal checkpoint restores item and racks. Six semantic fault controls reject and original bytes restore to PASS. |
| L7-08 | NOT CHECKED | Initial final-corridor cohorts: 62 low / 122 high; 25 / 26 actual rocket blasts; no living-human crossing through a prior blast footprint was observed. Physical gap and survivor-crossing proof remains. |
| L10-08 | NOT CHECKED | Actual production View gives road base 1.3, corridor/finale base 1.0 and combined maximum zoom ≤2.0 in all 12 tier/location/weapon samples. Suit-crowd readability and slam-ground-effect sequence still need physical captures/review. |

The 50 m rocket ground-click sample is **not** a range failure: E29 §5.2 explicitly honors the clicked world point. An actual Space attack with no aim point independently measures the 35 m direction-only fallback. No game change was made based on the earlier mistaken interpretation.

## Evidence and commits

Row measurements and source-bound receipts are in the four `fix51-verify/L7.json` through `L10.json` files. New browser reviews and raw SHA-256 cleanup ledgers are in this report directory; all images stay in `test-results/`. No evidence image was added to Git. All 370 owned captures/previews were personally inspected; raw capture hashes and what was seen are retained in row reviews. Raw captures were deleted; contact sheets remain locally available. Focused Resume segments and courier protection are explicit in each proof; they do not establish a continuous unprotected physical campaign.

The measured L9 route producer is archived byte-for-byte as `L9-04-producer.mjs`; proofs bind its digest. The runnable producer later received an unused-argument lint fix. L9-05 visual/speed producers are also archived separately. Their auxiliary tap reused mutable drive objects and is excluded; actual keyboard command streams and measured trajectories are authoritative. The runnable producer now clones input frames. Captured evidence was never rebound to different producer bytes.

| Commit | Row / fix |
|---|---|
| `ffbf1b9` | fix(qa): skip unavailable archived L9 evidence |
| `f44814b` | qa(L8-06): requalify current combat measurements |
| `c6db5ee` | qa(L7-08): record current corridor census and missing crossing |
| `3b53243` | qa(L10-08): refresh production camera bounds |
| `911a0dd` | qa(L9-04): measure surround windups and contact damage |
| `30d8936` | qa(L9-02): record oversized shortcut cohorts at both tiers |
| `ab4aeeb` | qa(L7-03): qualify real-input rockets and direction-only range |
| `24e40d5` | qa(L9-04): record physical low-tier safe-route failure |
| `77cbbd9` | qa(L7-07): refresh counter census and record incomplete physical route |
| `366f273` | qa(L7-07): qualify fixed marker and counter with reviewed physical routes |
| `ddeaceb` | qa(L8-05): qualify actual bites same-ID turns and outbreak caps |
| `760be7c` | qa(L8-07): walk both enclosure exits at both qualities and review captures |
| `63d4a23` | qa(L7-10): qualify living boarding spacing and stall recovery |
| `d8d24fd` | qa(L10-02): qualify current Mega introduction cues distance and route |
| `7abb609` | qa(L9-05): qualify zero-HP physical driving smoke and speed |
| `847ca54` | qa(L9-07): qualify whole-body crash and wreck objective ordering |
| `9d6c6d5` | qa(L10-06): review living infected dog against corgi at both zooms and tiers |
| `23de2d3` | qa(L10-05): qualify physical checkpoint pickups and inventory spawn controls |
| `3f098be` | qa(L10-09): review physical cure recording backpack and retry controls |

## Validation

- Final `npx tsc --noEmit && npm run lint && npm test`: **PASS**, 107 tests across 27 files; test command 34.4 s within 240 s budget. Targeted type/lint checks also passed during row development.
- Final `npm run qa:accept -- --level <L7|L8|L9|L10> --reuse --tier both --skip-browser`: each level exit 1 as expected for remaining FAIL/NOT CHECKED rows, with no producer errors. Both native policies/tiers reused exact matching current-source receipts; fixtures/checkpoint controls were re-evaluated. New source-bound pooled physical captures are consumed by row adapters; this command does not claim a new full browser playthrough.
- Final `npm run qa:threat`: **FAIL**, wrapper/batch time budget, exit 1 (child 124) after 601.3 s while entering L7; completed L1–L6 reported zero flags. The same underlying `node --import tsx/esm tools/qa/threat-audit.ts` then completed alone: **PASS**, exit 0, **0 fail flags**, all L1–L10, 943.0s. The initial full audit also had zero flags in 956.1 s. No budget or criterion was changed. Full final receipt is archived in `final-threat-audit.json.gz`; hashes and gate statuses are in `final-validation.json`.
- Shared `global.json`, automation README and `acceptance-status.md` were restored byte-for-byte to the base after final acceptance. Optional independently hashed row adapters can omit levels from partial shared indexes; the four level JSONs and this report carry lane results.
- All owned browser contexts and preview servers ended before the final threat audit. No game/specification/performance changes, no push/deploy. Raw captures deleted; no images added to Git.

The brief's `fix52-corpse` and `fix51-r9i` READMEs are absent in this pruned snapshot. Available specified reports were consulted. Worktree setup/slimming completed once initial workspace restrictions were removed.

## Still open

The timebox leaves 25 current NOT CHECKED rows and four fresh FAIL rows. The following work is still required. Full original NEXT text remains in each level JSON; no criterion was waived. Historical FAIL/current NOT CHECKED rows remain explicitly distinguished.

| Row | Displayed / current | Remaining work and reason |
|---|---|---|
| L7-01 | NOT CHECKED / NOT CHECKED | Approach collection and pickup/first-shot frame gate in an orchestrator quiet window. |
| L7-02 | NOT CHECKED / NOT CHECKED | Six-weapon selection plus real L6 roster ID/HP/formation handover. |
| L7-05 | FAIL / FAIL | Current skilled windups 0.8132/min low, 0 high versus ≥6/min; stationary first player windup 83.9667/22.6667 s versus ≤10 s. Both-policy/tier qualification remains. |
| L7-06 | NOT CHECKED / NOT CHECKED | Both routes and wrong-way edges via real input, route-only visual clarity and bounds sweep. P: judge pharmacy pocket and connected-route clarity. |
| L7-08 | NOT CHECKED / NOT CHECKED | Census measured 62/122 and 25/26 blasts, but no living human crossed a prior blast footprint. Need actual gap/crossing. |
| L7-09 | NOT CHECKED / NOT CHECKED | All health bars, pressing-crowd body orientation and individual human pace. |
| L7-11 | NOT CHECKED / NOT CHECKED | Uninterrupted bus end cinematic: timed displacement, skyline, lit truck/gore and no map edge. |
| L7-12 | NOT CHECKED / NOT CHECKED | Both-tier/zoom destruction/Alpha/contrast frames and ≥3:1 contrast. P: worst destruction versus earlier levels and human Alpha silhouette. |
| L8-01 | NOT CHECKED / NOT CHECKED | Actual L7→L8 carried campaign: roster IDs/HP, racks/selection, pickup census. |
| L8-02 | NOT CHECKED / NOT CHECKED | 60 active seconds: no objective/tracker/world/HUD/minimap marker or scripted attack. |
| L8-03 | NOT CHECKED / NOT CHECKED | Both-tier/zoom healthy species census, all five species, wall exclusion and ≤3 s idle ledger. |
| L8-04 | NOT CHECKED / NOT CHECKED | Current-source entrance frame strips and spacing/opening/visibility timestamps. |
| L8-08 | NOT CHECKED / NOT CHECKED | Infected lion wounds/snarl, zebra legs and courier night readability at both PO zooms. |
| L8-09 | NOT CHECKED / NOT CHECKED | Every living follower boards; late/missing-member guidance and departure inventory. |
| L8-10 | NOT CHECKED / NOT CHECKED | Saved APC L8→L9 identity/durability and actual ≤6 s handover timing. |
| L8-11 | NOT CHECKED / NOT CHECKED | Sanctuary then mixed battle frames. P: judge the transition’s impact; obtain the requested visual review. |
| L9-01 | NOT CHECKED / NOT CHECKED | Load-to-driving≤0.5 s, carried roster/durability, corgi outside hull and rider legs inside cab. |
| L9-02 | FAIL / FAIL | Nine-member shortcut groups violate eight total. Physical ≥20m detours still unqualified. |
| L9-03 | FAIL / NOT CHECKED | Historical FAIL/current NOT CHECKED: road presence and all three prescribed routes at both tiers. |
| L9-04 | FAIL / FAIL | Fresh low safe-route failure 670 vs 890 HP; high 940 vs 870 passes. Diagnose stopped/recovery-heavy low route; no causal claim yet. |
| L9-06 | NOT CHECKED / NOT CHECKED | Off-road anti-wedge route, absence of giant flat arrow and matching durability HUD. |
| L9-09 | NOT CHECKED / NOT CHECKED | All driving routes: terrain seams, detailed-chunk counts and uninterrupted input across streaming. |
| L10-03 | FAIL / FAIL | High research-campus dog peak 5 versus 2–4; species/group-size qualification remains. No population cap reduction. |
| L10-04 | FAIL / NOT CHECKED | Historical FAIL/current NOT CHECKED: every region reachable≥90%, required actual attack rates and no zero-attack crossing. |
| L10-07 | NOT CHECKED / NOT CHECKED | Continuous Mega speed/path/no-LOS/no-teleport/audio ledger and minimap review. |
| L10-08 | NOT CHECKED / NOT CHECKED | Camera bases 1.3/1.0 and combined≤2 measured; suit-crowd and ground-effect slam frames remain. |
| L10-11 | FAIL / NOT CHECKED | Historical FAIL/current NOT CHECKED: full assault peak/reach/attack census and actual walking arena arrival 120–160 s. |
| L10-12 | NOT CHECKED / NOT CHECKED | Mega rocket/conventional thresholds, range/motion/death and frame gate within/outside 12 m. |
| L10-14 | NOT CHECKED / NOT CHECKED | Full epilogue mist/species kill/immunity/control/pullback/title/credits ledger. P: judge mist, pullout and title/credits tone. |

P marks the exact PO taste decision. Quantitative and missing physical evidence alongside those items remains engineering work. No open visual/mechanical clause is waived as taste.
