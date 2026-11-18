# S161 — L10 farm clear time and fairness

Native `SimWorld` event probes; no browser sampling. Each row in [`metrics.json`](./metrics.json) is one tier × policy × seed × encounter. The run cap is 900 s. Admission receipts include exact tick, position, `director.inPlayerView`, and distance to the courier. The file also retains release/clear ticks, same-tick attacker ID attribution, engagement, stuck candidates, and Alpha cue/hit windows. `skilled` uses the ordinary `LevelTenBot`; `walk` applies the walk input modifier. Clear time is from final release to the last permanent death or removal from play. Times below are rounded to whole seconds; — means it did not clear by the cap or was not released.

## HIGH

| Encounter | Skilled clear s1/s2/s3 | Walk clear s1/s2/s3 | Walk deaths s1/s2/s3 | Player damage skilled/walk | Never engaged skilled/walk | Unfair / stuck |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Corn horde | 115 / 94 / 93 | 245 / 208 / — | 0 / 0 / 0 | 60 / 200 | 5 / 0 | 0 / 0 |
| Farmhouse defence | 81 / 82 / 81 | 233 / — / — | 0 / 0 / 0 | 0 / 30 | 15 / 1 | 0 / 0 |
| Shed crossing | 97 / 96 / 110 | — / — / — | 0 / 9 / 13 | 150 / 2,547 | 1 / 5 | 0 / 0 |
| Depot Alpha | 80 / 79 / 115 | — / — / — | 3 / 0 / 0 | 205 / 331 | 3 / 0 | 0 / 0 |

## LOW

| Encounter | Skilled clear s1/s2/s3 | Walk clear s1/s2/s3 | Walk deaths s1/s2/s3 | Player damage skilled/walk | Never engaged skilled/walk | Unfair / stuck |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Corn horde | 69 / 69 / 69 | — / 97 / 97 | 1 / 0 / 0 | 0 / 175 | 2 / 0 | 0 / 0 |
| Farmhouse defence | 79 / 79 / 56 | — / 127 / 127 | 0 / 2 / 0 | 20 / 440 | 11 / 0 | 0 / 0 |
| Shed crossing | 71 / 70 / 70 | — / 158 / 108 | 0 / 0 / 0 | 90 / 90 | 0 / 0 | 0 / 0 |
| Depot Alpha | 103 / 79 / 80 | — / — / — | 0 / 2 / 3 | 0 / 458 | 8 / 2 | 0 / 0 |

## Verdicts

- Spawn fairness: **PASS** — zero members admitted inside the player's view or within 12 m in all 48 rows.
- Stuck members: **PASS** — no member met the >10 s stationary and unreachable criterion.
- Alpha warning: **PASS for observed attack events** — the one observed LOW walk depot pounce had a preceding telegraph 1.22 s earlier. It resolved for 0 damage; there was no damaging Alpha hit to assess.
- Skilled clear band, 20–120 s: **PASS** — all 24 encounter rows cleared in 56–115 s.
- Walk clear band, 20–120 s: **FAIL** — multiple groups exceeded 120 s or remained uncleared at 900 s.
- Walk deaths, at most 2 per encounter: **FAIL** — HIGH shed seeds 2–3 and depot seed 1 exceeded the limit; LOW depot seed 3 also exceeded it. Whole-level walk deaths: HIGH 10/16/20, LOW 23/7/7.

Design changes preserve authored member counts: farmhouse members stage on a wider field perimeter, the shed formation is compacted and moved later along the approach, and the HIGH depot station moves 30 m toward the service road. LOW depot retains the S153 offset. These improve LOW walk seed 3 shed clear to 108 s with no deaths, but walk depot and clear-time targets still fail. No infected stats, threat flags, total counts, or corpse persistence changed. S153 receipts remain untouched.

Checkpoint retries repeatedly release some groups: for example, HIGH walk seed 2 releases shed ten times and records nine shed-attributed deaths. LOW walk seed 1 releases farmhouse 23 times before the cap; later groups never release. A clear receipt applies to its final recorded release, while `livingAtEndIds` also includes members admitted on earlier attempts. Further staging work must address these retry loops and remeasure all policies and seeds.

## Validation

`npm run typecheck`, `npm run lint`, and `git diff --check` pass. The full remote `npm test` passed in 189.8 s (105 passed, 1 skipped; 150-case budget).

## Browser QA needed

Gameplay staging and positions changed. A headless visual review is needed to confirm the farmhouse/depot formations read clearly on approach and that the shifted shed crossing does not overlap neighboring industrial patrols.
