# L4 first-beat mortality assertion — three seeds

The existing `L4-probe.test.ts` runs the same idle-courier war on main `60c51a67a` and the final lane. `L4_PROBE=1`, `L4_SEED=1/2/3`, high tier, one worker. As in the gated idle-war fixture, only the courier has god mode; NPC damage, grabs and deaths remain real. The observer samples visible living soldiers every five seconds. Raw evidence: [main](compare-l4-main.json), [branch](compare-l4-branch.json).

| Seed | Initial soldiers | First line break (main / branch) | Living at first sample after break (main / branch) | Armour break (main / branch) |
| --- | ---: | --- | --- | --- |
| 1 | 20 / 20 | 62.0 / 62.0 s | 20 / 20 | 182.0 / 182.0 s |
| 2 | 20 / 20 | 62.0 / 62.0 s | 18 / 20 | 176.8 / 182.0 s |
| 3 | 20 / 20 | 62.0 / 62.0 s | 20 / 19 | 182.0 / 182.0 s |

## One assertion corrected

The first line is forced at its 62-second deadline on every run, including main seeds 1/3 with no soldier lost by the next observation. E22-AC13 explicitly permits a forced deadline when the early half-down trigger has not fired. The extra `at(firstBeat) < initialSoldiers` assertion therefore inferred a casualty that the criterion does not require. It becomes `at(firstBeat) ≤ initialSoldiers`. The gated final seed-2 fixture also recorded exactly 20/20 at the first beat.

The **strict loss of more than half by the armour beat stays unchanged**, as do every beat window, Alpha knockdown/barricade-damage requirements, infected caps, corpse persistence, escape-gap and radio/fuel-truck behavior. No soldier HP, accuracy, damage, enemy count or director timing is changed to satisfy the test.

The final gameplay source was also replayed remotely on all three seeds: [raw repeat](compare-l4-branch-remote-final.json). First-beat counts remain 20/20/19 at the next sample and all first breaks remain at 62 seconds. At the next sample after armour, 16/8/14 soldiers remain; only the normal seed-2 fixture satisfies the later half-loss check across these three probes. Main’s earlier local probe likewise misses that later half-loss observation on seed 3 (16 remain). The existing later gate stays on seed 2 and passes in the broader regression run; no later casualty threshold is relaxed. A matching remote main repeat is being retained before finalizing this table.
