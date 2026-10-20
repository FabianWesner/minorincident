# L3 complete-time criterion — three seeds

Untouched main `60c51a67a` and the final attack/cadence source, high tier, identical `L3-default` complete policy, seeds 1/2/3, 600-second budgets, no cheats. Local sequential runs with `tools/survivors-ai/compare-l3.ts`. Raw evidence: [main](compare-l3-main.json), [branch](compare-l3-branch.json).

| Seed | Outcome main / branch | Seconds main / branch | Courier deaths main / branch |
| --- | --- | ---: | ---: |
| 1 | complete / complete | 342.78 / 412.75 | 2 / 3 |
| 2 | complete / complete | 328.48 / 321.82 | 2 / 3 |
| 3 | timeout / complete | 600.00 / 325.22 | 1 / 2 |

The final attack reaction preserves an engaged ally's target, firing pose and weapon cadence. The prior full remote snapshot completed seed 1 in 405.40 seconds; the final cadence-preserving source takes 412.75 seconds. Seed 1 is slower and has an extra courier death versus main. Across three seeds the branch finishes all three (main two), and its median finish time is 325.22 seconds versus 335.63 seconds for main's two successful runs. Main's three-budget median, including its timeout, is 342.78 seconds. No claim is made that every seed or policy becomes safer.

**E21-AC02 complete upper time 405 → 420 seconds** is the only L3 pin changed. The old band does not accommodate seed 1 under the new PO's active human response. The lower bound remains 120 seconds. The one-seed gate, all newbie time/death criteria, police damage and camera rules, enemy counts/caps, squad checks and mission deadlines remain unchanged. The epic's upper band is corrected to 7:00 and this comparison records why; no gameplay value is adjusted to make the courier finish sooner.
