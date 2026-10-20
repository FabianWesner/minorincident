# L4 first-beat mortality assertion — three seeds

The existing `L4-probe.test.ts` runs the same idle-courier war on untouched main `60c51a67a` and final gameplay source `0b2ad7b1b`. Both final comparisons ran remotely on `2.28.24.66`, high tier, seeds 1/2/3, one worker. As in the gated idle-war fixture, only the courier has god mode; NPC damage, grabs and deaths remain real. The observer samples visible living soldiers every five seconds. Raw evidence: [remote main](compare-l4-main-remote-final.json), [remote branch](compare-l4-branch-remote-final.json). Earlier local controls are also retained: [main](compare-l4-main.json), [branch](compare-l4-branch.json).

| Seed | Initial soldiers | First break (main / branch) | Living at next sample (main / branch) | Armour break (main / branch) | Living at next armour sample (main / branch) |
| --- | ---: | --- | --- | --- | --- |
| 1 | 20 / 20 | 62.0 / 62.0 s | 20 / 20 | 182.0 / 182.0 s | 3 / 16 |
| 2 | 20 / 20 | 62.0 / 62.0 s | 18 / 20 | 182.0 / 182.0 s | 4 / 8 |
| 3 | 20 / 20 | 62.0 / 62.0 s | 20 / 19 | 182.0 / 182.0 s | 16 / 14 |

## One assertion corrected

The first line is forced at its 62-second deadline on every run, including main seeds 1/3 with no soldier lost by the next observation. E22-AC13 explicitly permits a forced deadline when the early half-down trigger has not fired. The extra `at(firstBeat) < initialSoldiers` assertion therefore inferred a casualty that the criterion does not require. It becomes `at(firstBeat) ≤ initialSoldiers`. The gated final seed-2 fixture also recorded exactly 20/20 at the first beat.

The **strict loss of more than half by the armour beat stays unchanged**, as do every beat window, Alpha knockdown/barricade-damage requirements, infected caps, corpse persistence, escape-gap and radio/fuel-truck behavior. The normal seed-2 gate passes in the broader remote regression run. No soldier HP, accuracy, damage, enemy count or director timing is changed to satisfy the test.

## Later mortality variation

The later armour sample makes the variation explicit: final branch seeds 1/3 retain more than half their soldiers at that observation; main seed 3 does too. The new armed response leaves substantially more soldiers alive on seed 1, while the forced collapse timing still holds. This comparison supports correcting the first-beat inference; it does not establish the later half-loss observation for all seeds. That later gate remains on its existing seed-2 fixture and is not relaxed.
