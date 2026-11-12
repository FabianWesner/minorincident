# S76 — L3/L4/L7 threat-audit flags

## Outcome

**Open.** The requested zero-flag goal is not met. The retained level-design change improves L4's first west breach approach while keeping the same three-arrival cohort and all existing archetype counts. The north cohort and both L4-06 population checks remain flagged; L3 and L7 kiting flags remain. No zombie stats or global audit rules were changed, and L8 was untouched.

## Exact audit lines

Baseline was audited at `b06e3197391052367c9ade363608afd997ca1196` before edits:

```text
[qa:threat] L3: skilled complete, passive tick-budget, 1 passive flags (106.6s)
[qa:threat] L4: skilled complete, passive tick-budget, 4 passive flags (109.0s)
[qa:threat] L7: skilled complete, passive complete, 2 passive flags (129.3s)
```

After the retained L4 change, the exact requested command reported:

```text
[qa:threat] L3: skilled complete, passive tick-budget, 1 passive flags (84.3s)
[qa:threat] L4: skilled complete, passive tick-budget, 3 passive flags (82.1s)
[qa:threat] L7: skilled complete, passive complete, 2 passive flags (95.3s)
```

The command summary was `[qa:threat] 96.7s; 7 fail flags; test-results/qa-threat/README.md` (the total includes the partial-selection diagnostic). Before had 8 fail flags by the same count, including that diagnostic.

Remaining acceptance flags:

- L3: `KITING_LANDED_HITS_BELOW_2:0.00`
- L4: `wave/breach-north:WAVE_FEWER_THAN_THREE_COHORT_MEMBERS`, `criterion/L4-06 first breach:FAIL`, `criterion/L4-06 sustained horde:FAIL`
- L7: `KITING_BELOW_ATTACKS_PER_MINUTE_2:0.00`, `KITING_LANDED_HITS_BELOW_2:0.00`

## Level-design change

`LevelFourWar.emergePerimeterPressure` now uses one existing runner from the authored spearhead roster for the first arrival at the first west breach. The other two arrivals and subsequent breach cohorts retain their usual roster. This moved the west cohort's first attack inside the 20-second limit without increasing cohort size or heavy count. The L4 north/south alpha reorder trial was reverted: it still produced only two north breach members and reduced high-hold population peaks.

L4 high-hold evidence after the retained change: first breach at 50.08 seconds (17.27 seconds after turn start), 41 alive at breach, peak population 56 (47 in plaza), and plaza minimum 15 over 8,700 post-threshold samples versus the requirement of 60 alive at first breach and 40 in the plaza through line break. Skilled routes completed for L3, L4, and L7. The audit remains short of acceptance.

## Browser QA needed

No visual changes were made and no browser QA was run. Level composition/timing was evaluated by the headless threat audit; browser review remains needed before considering any future visual or encounter-placement changes final.

## Checks

The exact threat audit above completed. `npm run typecheck` and `npm run lint` passed. The remote unit suite did not run: `tools/remote/run.sh` reported no healthy Hetzner runner and refused the Mac fallback for `npm test` (exit 69).
