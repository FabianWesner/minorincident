# S76 — L3/L4/L7 threat-audit flags

## Outcome

**Open.** The combined audit confirms L3 at zero flags, L4 at two, and L7 at two. Retained changes advance L3's second wave to +14 s, add one existing fast actor to L4's first west breach roster, and align L4's north approach mouths with its physical breach. L4's two population criteria and L7's two kiting criteria remain open. Zombie stats and audit rules are unchanged; L8 is untouched.

## Exact audit lines

Baseline was audited at `b06e3197391052367c9ade363608afd997ca1196` before edits:

```text
[qa:threat] L3: skilled complete, passive tick-budget, 1 passive flags (106.6s)
[qa:threat] L4: skilled complete, passive tick-budget, 4 passive flags (109.0s)
[qa:threat] L7: skilled complete, passive complete, 2 passive flags (129.3s)
```

After the retained combined changes, the exact requested command reported:

```text
[qa:threat] L3: skilled complete, passive tick-budget, 0 passive flags (83.6s)
[qa:threat] L4: skilled complete, passive tick-budget, 2 passive flags (83.2s)
[qa:threat] L7: skilled complete, passive complete, 2 passive flags (97.0s)
```

The command summary was `[qa:threat] 97.6s; 5 fail flags; test-results/qa-threat/README.md` (the total includes the partial-selection diagnostic). Before had 8 fail flags by the same count, including that diagnostic.

Remaining acceptance flags:

- L4: `criterion/L4-06 first breach:FAIL`, `criterion/L4-06 sustained horde:FAIL`
- L7: `KITING_BELOW_ATTACKS_PER_MINUTE_2:0.00`, `KITING_LANDED_HITS_BELOW_2:0.00`

## Level-design change

`LevelFourWar.emergePerimeterPressure` now uses one existing runner from the authored spearhead roster for the first arrival at the first west breach. The other two arrivals and subsequent breach cohorts retain their usual roster. This moved the west cohort's first attack inside the 20-second limit without increasing cohort size or heavy count. The L4 north/south alpha reorder trial was reverted: it still produced only two north breach members and reduced high-hold population peaks.

L4 high-hold evidence after the retained change: first breach at 50.08 seconds (17.27 seconds after turn start), 41 alive at breach, peak population 56 (47 in plaza), and plaza minimum 15 over 8,700 post-threshold samples versus the requirement of 60 alive at first breach and 40 in the plaza through line break. Skilled routes completed for L3, L4, and L7. The audit remains short of acceptance.

## Browser QA needed

No visual changes were made and no browser QA was run. Level composition/timing was evaluated by the headless threat audit; browser review remains needed before considering any future visual or encounter-placement changes final.

## Checks

The exact threat audit above completed. `npm run typecheck` and `npm run lint` passed. The initial remote attempt found no healthy runner. The unchanged retry passed on `46.225.66.90`: 27 test files passed, 106 tests passed and 1 skipped, with the required 150/150 inventory present; 208.7 s under the 240 s budget (exit 0).

## Rejected L7 rear-kerb trial

Moved two of the existing four close opening runners from x=273 to x=284, keeping z=9.5/20.5 and the roster/count fixed. Focused audit `--levels L7 --out test-results/qa-threat-L7-rear-kerb` completed in 53.0 s: skilled and passive routes completed, but passive flags rose from 2 to 11 (nine follower-pace flags), with zero kiting attacks/hits. The 20 s probe began at tick 75, recorded one player attack start, and had 431 frames without threats. This trial was reverted in full; rear pressure at the forming party is not an acceptable fix. The committed runtime remains the validated partial L4 change.

The subsequent one-sprinter composition trial replaced only the first close runner with the existing sprinter archetype, leaving placement/count fixed. Focused L7 audit completed in 21.6 s: skilled/passive completed and follower pace passed across seeds, but a follower-wait flag appeared and both kiting flags remained (zero attacks/hits, 517 frames without threats). Reverted in full. The kiting implementation holds rocket fire for 300 ticks (5 s), then allows one shot; the observed zero contact therefore cannot be attributed solely to continuous rocket fire.

## Rejected L4 high-tier alarm staging trial

Reversing the high-tier alarm's eligible street-mouth order (farther mouths first; unchanged count, roster, caps and low-tier behavior) worsened census results: first breach moved from 50.08 s to 87.33 s, alive at breach fell from 41 to 34, peak plaza population fell from 47 to 40, and first attack moved from 9.83 s to 25.70 s. Plaza minimum remained 15. Focused audit completed in 47.6 s with the same three passive flags and skilled completion. Reverted: the distant approach delays both breach and pressure and does not preserve enough living population.

## Retained north breach alignment

Aligned the three existing north approach mouths at x=-22/-18.6/-15 (unchanged z, counts and roster) with the authored breach. Focused audit:

```text
[qa:threat] L4: skilled complete, passive tick-budget, 2 passive flags (49.8s)
```

North now admits three and attacks after 8.13 s; west admits 22 and attacks after 5.50 s; south admits four and attacks after 8.57 s. Only the two L4-06 flags remain. High hold: 44 alive at first breach (50.08 s), peak alive 59, peak plaza 56, minimum plaza 17. Typecheck and lint passed for this change. Remote suite must be repeated for the final combined implementation; the prior passing receipt predates this alignment. A rejected wider north offset also admitted three but produced no attack within 20 s, so it was reverted before this aligned trial.

## Rejected high-tier fast alarm expansion

Trialed 24 additional high-tier alarm runners/sprinters (42 versus 18 total, keeping low tier fixed and using the existing fast roster for the added portion). Focused audit completed in 47.8 s: skilled complete, two passive flags remained. High hold reached peak alive 75, but first-breach alive was only 47 at 50.08 s, peak plaza 51, and minimum plaza still 17. Reverted: this adds opening pressure without meeting either census requirement. Counts remain unchanged in the retained runtime.

## L3 second-wave timing evidence

Advancing only the second station wave, keeping its 25 members and all sources fixed, can clear the kiting-hit flag but regresses other criteria. At +10 s (instead of +20), the probe landed four moving hits (12/min) and made 15 attack starts; squad-loss verdict failed with army counts 0/3/0 across seeds. At +15 s it landed two moving hits and army counts passed (4/2/0), but native competent attack rate failed (31.51/21.50/43.31 per minute). At +12 s the army counts failed (1/2/0), although two seeds' competent rates passed (47.48/9.96/22.86). All three focused audits completed skilled routes. Reverted all timing trials: the retained L3 schedule is unchanged. This establishes a pacing mechanism for contact, but a timing-only second-wave adjustment has not met the no-regression requirement.

## Retained L3 second-wave pacing

Advancing the second wave to +14 s (from +20 s), with the same 25 members, sources and all other wave times, passed the focused audit:

```text
[qa:threat] L3: skilled complete, passive tick-budget, 0 passive flags (33.3s)
```

The moving probe recorded four attack starts and one landed hit in 20 seconds (3 hits/min). Skilled flags were also empty. Army counts across seeds were 4/3/0 (two pass); competent rates were 21.53/10.88/34.31 attacks/min (two pass). Typecheck and lint passed. The intermediate +16 s trial failed squad counts and retained a second flag, and was replaced by +14 s. The final combined three-level audit and remote suite remain due for the combined runtime.

## Further rejected L7 close-pack placements

Moving the four close runners' lateral kerb offset from 5.5 m to 3.5 m retained zero kiting attacks/hits and introduced two departure follower flags (four passive flags total; passive tick-budget). Keeping the original lateral offset while moving only the first pair to x=280 retained zero attacks/hits and introduced stuck-chaser and follower flags (12 passive flags total; passive tick-budget). Both focused audits completed skilled routes. Both changes were reverted; they crowd the formation without supplying moving contact. The retained L7 implementation remains unchanged.

## Rejected west Alpha timing extremes

The first ordinary wave already begins at alarm +0 s. Trialed moving the existing west Alpha from +6 s to +14 s: breach at 58.08 s, only 24 alive; plaza minimum 20; three passive flags. Moving it to +0 s instead produced breach at 44.35 s with 55 alive, plaza minimum 13 and three passive flags. Both skilled routes completed. Reverted both: later opening loses population before entry, earlier opening comes closer to 60 alive but worsens sustained plaza pressure and adds a passive flag. Retained +6 s remains at two flags with the aligned north approaches.
