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
- On the road transition at tick 8250, both request the 4.725 m/s cap but resolve at 1.91 m/s (Dale) and 2.47 m/s (Sam). A follow-up trace wrapped `Npcs.moveStep` and recorded its input and output: Dale's routed intent points backward at (-4.24, -2.09) m/s, although his requested goal is ahead at (18.41, 33.98); his pre-step position is (18.41, 30.57). Sam's routed intent points toward his goal at (-0.52, 4.70) m/s, and the navigation step moves him 0.078 m (about 4.68 m/s). His published displacement is reduced later in the tick to 2.47 m/s. Neither sample reports an actor blocker. Dale needs a route/waypoint investigation; Sam needs the later separation and speed-limit stages traced. These observations do not establish that a static wall caused either slowdown.
- A subsequent read-only trace of the same seed and tick recorded `nav.steer` and phase positions. Dale has no direct visibility to his moving goal; navigation selects waypoint (17.75, 30.25), behind his position, as the first leg of its route. Sam advances from (18.2386, 29.8794) to (18.2301, 29.9570) in `moveStep`, then three `cleanup.separation` writes move him back to (18.2196, 29.9159). Dale is simultaneously pushed forward by separation. Thus this sample combines an obstructed route and crowd spacing; it does not by itself prove which geometry blocked direct visibility or identify every contact partner.
- A further phase snapshot places Sam at (18.2301, 29.9570), Dale at (18.3591, 30.5513), and Mia (31) at (17.6976, 30.6910), before the separation pass. All three occupy a small area; the snapshot alone does not identify the exact pair responsible for each correction. Nearby navigation geometry includes a small wall centered at (18.65, 31.10), half extents (0.1364, 0.14005), a larger wall centered at (23.5048, 25.9), and a dynamic blocker centered at (15.8, 30). The exact direct-visibility veto was not isolated. This strengthens the case for tracing formation convergence and routing together, while preserving physical collision.
- A read-only wrapper around navigation's separation moves identifies the contact pair at tick 8250: Sam's first correction is (-0.00647, -0.02581) m, directly away from Dale at (18.3911, 30.5989), 0.6618 m away; Mia is 0.9121 m away. The next two Sam corrections are also directed away from Dale. Dale in turn is first pushed away from Mia and then forward away from Sam. This establishes that the rear follower's progress is lost to the follower directly ahead at this sample. Correcting their convergent route/slot choices is the remaining design problem; the sample does not establish the cause of every slow tick.
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
