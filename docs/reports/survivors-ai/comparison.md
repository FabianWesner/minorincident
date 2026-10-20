# L5 three-seed comparison

Untouched main `60c51a67a` versus the final AI source (required merges included). High tier, seeds 1/2/3, identical policies and budgets, no cheats. Values read **main → branch**. Deaths are courier deaths; rescued counts are living sheltered followers. Raw evidence: [main](compare-main.json), [branch](compare-branch.json). Both raw comparisons are from remote runners; the final branch sweep completed before its full test run.

| Profile / seed | Seconds | Courier deaths | Rescued | Branch armed followers / shots |
| --- | ---: | ---: | ---: | --- |
| complete / 1 | 164.22 → 158.50 | 0 → 0 | 5 → 4 | okafor / 5 |
| newbie / 1 | 243.05 → 257.53 | 0 → 0 | 5 → 3 | dale / 47 |
| evade-only / 1 | timeout 240.00 → timeout 240.00 | 6 → 3 | 0 → 0 | none / 0 |
| complete / 2 | 161.38 → 177.45 | 0 → 0 | 4 → 4 | okafor, mia / 51 |
| newbie / 2 | 243.93 → 240.03 | 0 → 0 | 5 → 5 | okafor, mia / 28 |
| evade-only / 2 | timeout 240.00 → timeout 240.00 | 4 → 6 | 0 → 0 | none / 0 |
| complete / 3 | 165.45 → 159.38 | 0 → 0 | 5 → 4 | okafor / 11 |
| newbie / 3 | 249.10 → 279.93 | 0 → 0 | 2 → 5 | okafor, mia / 91 |
| evade-only / 3 | timeout 240.00 → timeout 240.00 | 3 → 3 | 0 → 0 | none / 0 |

The prerequisite rings merge raises opening high-tier infected from 18 to 27. Every complete/newbie branch run finishes, with zero courier deaths and at least three rescued people. All six runs naturally arm followers. Complete runs rescue 12 people versus main’s 14; newbie runs rescue 13 versus main’s 12. Sam is still lost on the complete policy’s route. This supports retaining the imported density; this lane adds no enemies.

Evade-only times out on both heads for all three seeds. Courier deaths change 6/4/3 → 3/6/3; no one is evacuated. NPC mobility and firearms do not make every policy safer. No L5 time, death, rescue, damage, cap or difficulty threshold was re-pinned. The imported population/count/hash pins are enumerated in [the lane report](report.md#imported-balance-pins).
