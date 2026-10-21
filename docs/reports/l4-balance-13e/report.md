# Batch 13e L4 balance repair

Base: `40047a591` (`lane/merge-batch13e`). The scheduler-created worktree initially pointed at main `93e1fbea8`; it was clean and fast-forwarded to the requested base before any measurement or edit.

## Reproduction and cause

All simulations run remotely through `tools/remote/run.sh`, with at most four Vitest workers. The comparison uses the existing `loadL4` / `runL4` inputs, idle seed 2 (only the courier has the existing war fixture’s god mode) and complete seed 3 without cheats. NPC damage, bites, rescue windows and deaths remain real. Main is `93e1fbea8`; main plus survivors-ai is a temporary detached merge of `lane/survivors-ai`. The tent control applies only the reception tent’s existing -30.6 → -30.65 x move on that merge. Raw observations are in `evidence/`.

The tent-only control reproduces the merged idle trace exactly: main has 3 soldiers at fallback, main + survivors-ai has 6, and adding only the tent move produces 16, matching batch13e. This reproduces the idle regression without aggro-tune, isolating the tent/survivor-AI interaction. The first observed Alpha differences occur around turn +60–75 seconds; with the moved tent, the northwest line Alpha finishes its one slam and leaves its line job earlier, and the south nest Alpha dies while still waiting to enter.

The merged regression is an encounter-routing problem. Directed flank arrivals receive a position-only `rush` toward a soldier, then ordinary perception can switch them to nearby civilians. Armed self-defence preserves more defenders and interrupts the old bite snowball. The tent’s closed western passage changes the resulting traffic and fights. The late western armour Alpha has a long approach around the camp; it is still travelling at turn +165 seconds in the merged trace. Beat deadlines still fire, while the army can remain standing.

The short complete run is a separate route join: the armour checkpoint chooser can select the northern convoy gap. At fallback, joining the closest leg then selects Harbor Street, skipping the intended Lakeshore / Metro escape. The unchanged authored complete gate (seed 3) reproduces 250.05 seconds, so this is not limited to aggro-tune’s seed-1 diagnostic.

The finale has an arrival-routing failure at the cap. A group is marked assigned when an existing straggler receives a `rush`, even if camp gunfire immediately diverts it back. The five-second street trace shows, for example, groups authored at (50,-6), (38,-37.4), (-4,-37.4) and (-46,-37.4) still near the camp as the courier passes their streets. A 42 m staging horizon also gives a runner too little time to travel from the camp to the next block. Reserved fresh arrivals work better, but they cannot supply all of the intended encounters alone. The base low-tier run records action in only 5/8 fifteen-second buckets (6 required), despite an aggregate 11.07 engagements/minute. Base high tier on the final 13e tip is 9.33/minute; the earlier merge-stage 7.64/minute miss is recorded in the job request.

## Changes

- Flank pushes use the existing director `press` order to keep soldier focus through the crowd, retaining ordinary sight, damage and rescue rules.
- Armour has a dedicated south convoy rally checkpoint, leading into the existing escape street.
- The late western armour Alpha uses the existing northwest alley entry, reaching the broken north line before the armour deadline. Counts, HP and allied damage resistance are unchanged.
- Existing street stragglers begin their approach within a 72 m staging horizon. Their walk uses the existing director routing until the authored home or visible courier contact within 16 m; ordinary perception resumes there. The previous wander goal is cleared at assignment so local street wandering cannot resume an old camp destination. Identity, HP and cap slots are preserved, with no teleport or additional infected.
- The sole existing assertion change removes the L6 inferred waiting-survivor ceiling, as authorized. Actual evacuation ≤30%, zero courier attacks and `lost > 0` remain. The test comment links `docs/reports/survivors-ai/comparison-l6.md`.

## Focused experiments

The first candidate (soldier focus + south rally + allowing reserved-group straggler reuse) restored complete seed 3 to 309.42 s, zero deaths, and passed all six existing respawn tests. It did not meet the casualty gate (12 at fallback), and high-tier finale pressure was only 5.81/minute. Its low tier passed at 5.53/minute, 5/6 occupied buckets, zero deaths. Reserved-group reuse was reverted after the trace showed assigned groups still trapped by camp distractions.

Adding the northwest armour approach first produced 9 soldiers at turn +182 and +183 s, against the unchanged strict `< 10` gate. The final crowd-routing correction improves this to **8 at +183 s**. Casualties remain actual attacks/bites; the dedicated observer records mortality every second. Street routing is validated with the existing PO #17 gates below.

The broad run found one additional regression: the stationary-courier crowd-spread average was 2 quadrants (minimum 2.5). The snapshot identifies four regulars investigating army gunfire rather than chasing the courier, so they bypassed the existing chaser ring slots and crossed her position together immediately after the armour beat. L4 army-bound movement now takes a clear tangent outside the inner combat rings around a stopped courier during the war/collapse. It uses normal navigation and the existing ring point. Only through traffic with a destination outside the combat space is diverted, so nearby NPC targets stay directly reachable. Ordinary acquisition/attacks and other levels retain their existing code paths. Armour pressure retains its original start at +150 s; a four-second advance was evaluated and discarded. Final crowded samples occupy **4, 4 and 3 quadrants**, mean **3.67**; at most 7 infected are within 1.9 m, the escape gap clears 1 → 0 distant blockers within four seconds, and corpse losses remain zero.

## Validation

| Item | Requested base / reproduced baseline | Final focused result | Existing limit |
| --- | --- | --- | --- |
| 1. Soldier collapse, idle seed 2 | 17 at armour | 8 at +183 s | <10 of the initial 20 |
| 2. High finale, newbie seed 1 | Merge stage C: 7.64/min; final base: 9.33/min, 6/6 active buckets | 11.03/min, 5/6 active buckets, 0 deaths | ≥8/min, ≥70% buckets, ≤2 deaths |
| 2. Low finale, newbie seed 1 | 11.07/min, only 5/8 active buckets, 1 death | 15.34/min, 5/5 active buckets, 0 deaths | ≥5/min, ≥70% buckets, ≤2 deaths |
| 3. Complete seed 3 | 250.05 s, 0 deaths | 302.22 s, 0 deaths | 260–460 s, ≤2 deaths |
| 3. Complete seed 1 diagnostic | Aggro lane: 250.27 s; merge finding: 250.05 s | 302.50 s, 0 deaths | Same 260–460 s band |
| 4. L6 evade seed 1 | 15/29 potentially surviving exceeds the inferred 13/29 pin | 0/29 escaped, 14 lost, 0 courier attacks; 15 still potentially surviving | Actual evacuation ≤30%, lost >0; only authorized assertion correction |

Final focused gates: **8 passed** (all four collapse cases, both finale gates, the actual T-E22-02 assertion and the authored-gap fixture), with unrelated cases skipped by the name filter. The follow-up handoff cleanup clears the straggler’s stale wander goal; this final focused run reproduces the same timings and engagement values. The finale route measures 305 m / 152.5 s at walking speed on both tiers. Peak infected: 120 high, 60 low.

Typecheck and lint pass on the final crowd-routing source. Complete **seed 1 also finishes in 302.50 s with zero deaths**, repairing the earlier approximately 250 s diagnostic outlier without changing its inputs. The **final full remote suite passes: 410 test files passed, 3 skipped; 2,216 tests passed, 11 skipped; zero failures**. It completed in 2,295.44 seconds with exit 0. All three named timeout-prone cases passed in this run; no isolated retries were needed. Machine-readable results: [full-suite-final.json](evidence/full-suite-final.json).

The baseline and first-candidate broad runs were stopped after their focused failures and traces were recorded. A preliminary full run was superseded after 384 passing checks and no failures when code review identified the stale wander-goal handoff. None of these interrupted runs is counted as a completed suite. The final focused run and the final full suite use the exact source committed here.

### Final validation commands

```sh
npm run typecheck
npm run lint
MI_RUNNER_IP=2.31.10.108 sh tools/remote/run.sh "$PWD" --pull docs/reports/l4-balance-13e/evidence/full-suite-final.json --pull test-results/epics/E22 --pull test-results/finale-stretches --pull test-results/epics/E24/evade-protection-seed-1.json -- npx vitest run tests/unit tests/levels --maxWorkers=4 --reporter=verbose --reporter=json --outputFile=docs/reports/l4-balance-13e/evidence/full-suite-final.json
```

Both local static checks exit 0. The final suite includes the unit suite and all level simulations; no assertion, threshold, seed or bot changes were made beyond the single authorized L6 removal.

## Reproduction

The diagnostic harness is archived as `routing-trace.test.ts.txt` to avoid changing existing tests or adding diagnostic cases to the normal suite. Copy it temporarily to `tests/levels/l4-balance-diagnostic.test.ts`, then run:

```sh
sh tools/remote/run.sh "$PWD" --pull docs/reports/l4-balance-13e/evidence --env L4_BALANCE_TRACE=label -- npx vitest run tests/levels/l4-balance-diagnostic.test.ts --maxWorkers=2
```

Use `L4_BALANCE_SEED=1` for the extra complete control; idle remains seed 2. Remove the temporary test afterwards. No thresholds, seeds, bots, global aggro rule, survivor defence behavior or other levels’ infected populations were changed. The reception tent stays at its merged position, and corpses retain their existing persistent lifecycle. No browser capture, deployment, push or merge into main was performed. The one temporary baseline worktree was removed after its comparisons completed.
