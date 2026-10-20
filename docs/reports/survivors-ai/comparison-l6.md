# L6 criterion review — three seeds

Main `60c51a67a` and final AI source, `L6-default`, high tier, identical 600-second budgets, no cheats. Values read **main → branch**. Raw evidence: [main](compare-l6-main.json), [branch](compare-l6-branch.json). Both raw comparisons are from remote runners. Local repeats agreed on complete timings within one tick; evade-only casualty counts varied and the remote values below are retained.

| Profile / seed | Seconds | Courier deaths | Actually out / 29 | Lost | Waiting alive |
| --- | ---: | ---: | ---: | ---: | ---: |
| complete / 1 | 269.95 → 276.93 | 0 → 0 | 24 → 27 | 5 → 2 | 0 → 0 |
| evade-only / 1 | 600.00 → 600.00 | 14 → 15 | 0 → 0 | 24 → 5 | 5 → 24 |
| complete / 2 | 282.62 → 287.68 | 0 → 0 | 27 → 23 | 2 → 6 | 0 → 0 |
| evade-only / 2 | 600.00 → 600.00 | 11 → 24 | 0 → 0 | 22 → 23 | 7 → 6 |
| complete / 3 | 275.12 → 275.70 | 0 → 0 | 26 → 27 | 3 → 2 | 0 → 0 |
| evade-only / 3 | 600.00 → 600.00 | 20 → 21 | 0 → 0 | 20 → 24 | 9 → 5 |

## Corrected assertions

- **E24-AC02:** complete upper time 270 → 300 seconds, in the level test and epic criterion. The lower bound 180 seconds, zero-cheat policy, rescue floor 60%, infected cap and straggler rejoin floor stay unchanged. Main already exceeds 270 on seeds 2/3; its median is 275.12 s versus the lane’s 276.93 s. Both heads rescue 77 people across the three complete runs, with zero courier deaths. The five-minute ceiling also matches the existing epic’s 4:30–5:00 exit stage. The previous criterion is too narrow for the required active escape/fight behavior; no movement speed or difficulty data is changed to meet it.

- **E24-AC09:** retain the actual evacuation ceiling **≤30%**. Both heads evacuate **0/29** on every evade seed. Remove the extra inference that every waiting person counts as already rescued and must also fit a 30% ceiling. The corrected test still requires zero courier attacks and real NPC casualties, so an untouched group timing out cannot pass. Active people can escape an attacker and remain waiting for a courier who repeatedly dies; that is neither evacuation nor immunity. The report keeps their count visible.

The old extra inferred ceiling was `potentiallyRescued / total ≤ .3`; its replacement is `lost > 0`, alongside the unchanged `escaped / total ≤ .3`. This is reported explicitly rather than silently weakening a difficulty pin.
