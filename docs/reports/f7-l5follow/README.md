# f7-l5follow — L5 follower pace investigation

Status: **open**. The baseline remains in the worktree; no game change from the trials below was retained. The requested both-tier pass and zero-flag threat audit are not achieved.

## Measurements

| Row / tier | Main baseline → best investigated candidate | Result |
|---|---|---|
| G-13 / low | Baseline individual ratios not retained in this lane → personal-threat pace trial: seed 1 ratios 0.959 / 0.958 for Dale (look / metro), 0.977 / 0.988 for Sam | Candidate three-seed vote PASS |
| G-13 / high | Fresh baseline receipt: Dale 0.882 / 0.864 in look seeds 1 / 3; Sam 0.914 in metro seed 1 → same trial: Dale 0.871 in look seed 1; Sam 1.009 in metro seed 1 | Candidate FAIL; Dale still misses look pace and another follower misses the phase vote |
| L5-08 / low | Prior f3 baseline: follower 31 91.6% straight band → candidate: Dale 99.40%, Sam 99.90%, Rosa 98.90%, Mia 100%, Okafor 96.44%; all longest bad runs ≤ 41 ticks | Candidate PASS |
| L5-08 / high | Fresh main baseline: band passed → candidate: Dale 99.60%, Sam 93.46%, Rosa 100%, Mia 99.73%, Okafor 96.61% | Candidate FAIL; Sam has a 57-tick bad run |

The candidate changed calm-pace eligibility and the resolved-speed ceiling to use a follower's personal visible threat, while preserving shared-threat route cleanup. Fresh `qa:accept` ran both tiers, with checkpoints passing in both; the complete acceptance still reported two failing L5 rows. The high-tier pace and band failures above prevent adopting this change.

The candidate threat audit completed in 121.9 s with **two substantive flags** (`L5/KITING_LANDED_HITS_BELOW_2:0.00`, `L5/step/look:SKILLED_BELOW_ATTACKS_PER_MINUTE_3`) plus the expected partial-selection notice. It therefore violates the required zero-flag gate. I reverted the candidate and restored the generated shared `fix51-verify` files; no acceptance checker or threshold was changed. The baseline source remains unchanged.

## Cause from per-tick traces

Followers 28 and 32 are Dale and Sam. In the hash-identical high seed-1 trace, the slow samples do not share one cause:

- Calm, unthreatened slot corrections issue short movement commands when a follower is beside or close behind the courier. Dale at tick 7440 requests 0.32 m/s and resolves 0.20 m/s while the courier moves 4.5 m/s; Sam at tick 5220 requests 1.44 m/s and resolves 1.33 m/s. There is no combat state or body blocker in either sample.
- On the road transition at tick 8250, both request the 4.725 m/s cap but resolve at 1.91 m/s (Dale) and 2.47 m/s (Sam). The trace shows no body blocker. Static geometry, navigation steering and motion response remain possible causes; this sample alone cannot distinguish them.
- Combat samples use the authored 3.8 m/s pace. Courier-only threat also selects the shared combat state for calm rear followers, explaining some 3.8 m/s samples when the group is moving faster. Filtering that trigger alone did not fix high and caused the high band/attack audit regressions above.

Selected per-tick evidence is in [trace-summary.json](trace-summary.json). The complete compressed diagnostic traces used during analysis were temporary files and are not part of the report.

## Files and checks

- Retained game files: none.
- Report files: this README and [trace-summary.json](trace-summary.json).
- Fresh high and low `qa:accept` were run on the candidate. Neither tier met all required rows.
- Threat audit on the candidate was not clean; after recording it, I reverted the candidate and validated the restored main source below.
- On the restored main source, `npm run lint` and `npm run test:unit -- tests/engine/npcs.test.ts` pass (3/3 focused tests). `npm run typecheck` fails at the unrelated existing `tools/qa/diag/l4-pocket.ts:20` error (`Appearance.model` does not exist).
- On the restored main source, `node --import tsx/esm tools/qa/threat-audit.ts --levels L5` completed in 120.0 s with no L5 flags; its only flag is the expected `PARTIAL_LEVEL_SELECTION` notice.

## Open

Keep the 1.05× cap, combat 3.8 m/s behavior, infected stats, targets and evaluator unchanged. The next correction needs to retain calm pace through stop/turn slot corrections and improve frontage movement without shifting the band failure to another follower or lowering L5 threat pressure. Re-run both acceptance tiers and the standalone L5 threat audit on any new candidate.
