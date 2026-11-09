# R16 — natural L7 group movement

**Partial handoff within the two-hour timebox.** Natural movement is enabled and the mortal skilled route completes all six requested cases. The standard L7 audit improves from five G-13 flags to zero. **The strict no-new-flags condition across the supplemental high-tier pace votes remains unfinished. The complete goal is not claimed achieved.**

Selected game source: `5e475879`, restored unchanged as `fd46bbed`. Game source SHA-256: `4f235f57b95586004b0251cd7abeea3db37258a6459ad811d968b9abe974e0c6`. The source, tests and tools have an empty diff against `5e475879`; subsequent report commits do not change the game. [Verification and provenance](evidence/selected-verification.json).

## Changes retained

- Enable loose following slots, staggered starts and idle glances in L7. Initial arrival staging retains its authored clearance. Street sway is checked against navigation before use; corridor pairs have shared and small personal wander on their walked trail.
- Keep generic sway from displacing solved L7 detours or bus queue targets. R13's distinct queue rows and the dog's tracking response remain intact. No departure queue coordinates were changed.
- Continue logical floor support during stun. Alpha roar previously let the courier fall below Northgate's raised road, even on pinned main. Controls stay locked during stun, and unsupported bodies still fall.
- Make the completion bot dodge close attackers and Alpha telegraphs using ordinary connected movement and its original rocket/shotgun attacks. Reassess a dodge after 45 ticks. Rejoin physically clear forward route legs after a dodge.
- Compute the bot's wait allowance from occupied survivor rows, since casualties do not renumber slots. Include the two-abreast tail's ordinary tracking room. The mission's 18 m group check is unchanged.
- Reduce the moving corridor arrival deadband from 0.6 m to 0.1 m so followers keep supplying steering near a moving slot.

No health, ammunition, enemy populations, collision gates, qualification rules, acceptance thresholds or observation windows were weakened. No dependencies or protected reference/spec files changed.

## Native completion

These are ordinary mortal `runLevel('L7', 'complete', seed)` runs with the default observation window, unmodified presets and actual low/high populations. Every case also completed in the earlier stricter 240-second diagnostic, with an identical final native hash. Every living eligible survivor boarded; casualties remain explicit.

| Tier | Seed | Outcome | Seconds | Boarded / original 24 | Native hash | Wait upper bound |
| --- | ---: | --- | ---: | ---: | --- | ---: |
| low | 1 | complete | 126.18 | 21 | `23fdf66a` | 3.70% |
| low | 2 | complete | 111.67 | 21 | `c23178bd` | 1.47% |
| low | 3 | complete | 119.47 | 21 | `b27b0c52` | 1.90% |
| high | 1 | complete | 135.63 | 17 | `98c025ac` | 9.50% |
| high | 2 | complete | 127.48 | 16 | `a18f362c` | 8.61% |
| high | 3 | complete | 123.58 | 16 | `01a3affc` | 7.56% |

All six runs have **zero collision invariant failures and zero boarding assists/recoveries**. Full receipts and sampled traces are retained as `evidence/selected-{tier}-{seed}*.json.gz`.

Fresh pinned-main runs reproduce its archived **2/6 completions**, including all four courier deaths and exact native hashes. Main does not satisfy the brief's assumed six-completion baseline. [Baseline table and causes](investigation.md), `evidence/baseline-full-*.json.gz`.

## Follower constraint: what passes and what remains

The unchanged **standard focused L7 audit**, which uses low quality, reports zero skilled flags, zero passive flags, and zero skilled/passive aggregate pace flags. All three required low seeds complete and cover the required followers. The baseline's five G-13 identities are removed in this audit. Its only top-level flag is `PARTIAL_LEVEL_SELECTION`; exit 1 is expected for a focused diagnostic and is **not** a complete campaign-gate pass. [Full focused receipt](evidence/selected-focused-threat.json.gz).

The low native hashes match the official observer's hashes on seeds 1–3. The extra diagnostic instrumentation therefore preserves those native results. The observer SHA-256 remains `f6f19f3a30a061c07b0e90a71d614f36498a80c2bdf41074dd826884cc2d7165`.

Supplemental high-tier votes use the same unchanged sample qualification and three-seed evaluator. They retain the two known ID-71 slow flags and add **four flag identities**:

- `step/corridor:SLOW_FOLLOWER:74`
- `phase/encounters:SLOW_FOLLOWER:74`
- `step/departure:SLOW_FOLLOWER:63`
- `step/departure:SLOW_FOLLOWER:70`

These are an unfinished part of a strict both-tier interpretation of “no new follower flags.” They are not waived by the clean standard low-tier audit. [High votes and all raw phase medians](evidence/selected-high-pace.json.gz), [low votes](evidence/selected-low-pace.json.gz). Unqualified rows are retained and are not described as passing samples.

The high opening trace shows follower 74's slot target rotating off the road during courier dodges: at tick 90 its target is near `(276.26, 5.67)` while the courier is near `(270.31, 14.88)`. The tail steers beside a frontage, and in two seeds dies after supplying only nineteen walking samples. ID 70 also loses pace during the later corridor turns. [Opening target trace](evidence/tail-road-swing-before.json.gz).

Attempts to retain a street trail, change pair clearance, track moving-slot velocity, slow the approach, or taper the bot's wait band did not satisfy all six completions and the flag condition together. The street-trail trial removed high-tier aggregate pace flags but killed the high/3 courier and added low-tier departure flags. Those changes were discarded. [Trial receipts](evidence/trials-summary.json.gz).

## Checks and motion evidence

The final selected-source `npm run verify -- E29` passes typecheck, lint, and **106 tests with one existing platform skip / 27 files**. Vitest takes 132.83 seconds; its unchanged 240-second wrapper completes in 138.2 seconds. The collection budget remains 150/150 cases and 43/45 files. [Final gate receipt](evidence/selected-gate-checks.json.gz). Earlier source checks are labelled separately by revision.

Selected-source quiet boarding passes both tiers: L7 **24/24 in 8.18 s**, L8 **13/13 in 22.45 s**, no assists or recoveries, no collision invariant failures. Maximum visible step is 0.0886/0.0906 m for L7 and 0.1649 m for L8. These quiet fixtures are separate from the mortal six-route proof. [Boarding receipt](evidence/selected-boarding.json.gz).

Selected-source naturalness measurements are descriptive, with no invented pass threshold. Low/1's two-second lateral rail share changes **56.9% → 3.1%**, moving velocity-direction concentration **0.932 → 0.882**, and moving facing concentration **0.939 → 0.904**. NN spacing CV decreases **0.285 → 0.256**; not every spacing metric improves. The native start-spread measurement has no qualifying low-tier restart window. The unit case separately checks calm L7 start delay.

Selected high/1 completes with rail share 3.1% over 5,407 windows. Main's high/1 dies and supplies only thirteen rail windows, so its 0% rail value is not a useful full-route comparison. High standing/moving facing is more concentrated than main's shorter failing run; these results do not claim every motion metric improved. Raw baseline and selected metrics are retained in `evidence/r16-{baseline,selected}-L7-*.json.gz`.

Two full ten-level threat audits, on baseline and an intermediate lane source, exhausted the unchanged 600-second wall budget. Neither yielded a final aggregate result. There is no claim of a passing complete threat gate.

## Reproduce and continue

Run heavy commands on runners through `sh tools/remote/run.sh "$PWD" -- COMMAND`. Native diagnostics:

```sh
node --import tsx/esm tools/qa/r16-l7group-route.ts low reproduce
node --import tsx/esm tools/qa/r16-l7group-route.ts high reproduce
node --import tsx/esm tools/qa/threat-audit.ts --levels L7 --out test-results/r16-l7group-reproduce --maxWorkers 4
```

Repository validation is `npm run verify -- E29`, with `VITEST_MAX_WORKERS=2` on an isolated runner. The manifest-only runner snapshot needs a disposable Git commit before its Git-dependent tool tests; this does not commit to or push from the source worktree. All existing wall budgets and test limits remain unchanged.

The next task is to preserve the six-route result while keeping the opening tail on a body-clear road path and resolving the departure pace rows, then rerun both tiers and the unchanged audit. This requires further work beyond this handoff; the goal is not marked complete.

**Browser QA needed.** No browser, push or deployment was performed.
