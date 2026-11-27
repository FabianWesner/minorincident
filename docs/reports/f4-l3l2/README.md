# L3 / L2 acceptance repair

## Measurements

| Row | Tier | Before | After | Result |
|---|---|---|---|---|
| L3-11 competent attack rate (per min, seeds 1–3) | High | 56.7 / 44.2 / 87.4 | 35.48 / 14.20 / 79.15 | 2/3 in 3–40; pass |
| L3-11 competent attack rate (per min, seeds 1–3) | Low | 26.59 / 14.55 / 34.56 | 18.95 / 14.95 / 14.35 | 3/3 in 3–40; pass |
| L3-06 squad at army line (members, seeds 1–3) | High | 1 / 2 / 1 | 3 / 3 / 0 | 2/3 seeds have ≥2; pass |
| L3-06 squad at army line (members, seeds 1–3) | Low | Baseline army-line counts were not retained in the fresh baseline note; calm distance failed | 3 / 3 / 3 | 3/3 seeds have ≥2; pass |
| L3-06 calm squad distance | High | Not measured | Not measured | Open; no high calm-distance samples in the acceptance receipt |
| L3-06 calm squad distance | Low | Out-of-band samples | 103/108 samples in 3–6 m; max 6.51 m | Open; five samples exceed 6 m |
| L2-08 firefighter turns by +90 s | High | 0 | 2 (46 hits) | Pass; snowball census 60 at +60 s, 59 at +120 s |
| L2-08 firefighter turns by +90 s | Low | 0 | 2 (19 hits) | Pass; snowball census 29 at +60 s, 30 at +120 s |
| L2-12 competent bridge attack rate (per min) | High | 15.74 | 31.38 | Regression; exceeds 30/min ceiling |
| L2-12 competent bridge attack rate (per min) | Low | 10.38 | 13.68 | Pass |

L2 high/low fixtures also observed all six firefighters with zero protected ticks after doors opened. The L3 attack-rate and army-line clauses now meet their thresholds on both tiers. L3 low calm following distance remains slightly outside its 3–6 m band; L3 high calm following distance was not measured by the acceptance receipt.

## Cause and changes

L2 bites were denied turns when the director's reserved arrivals filled the live cap. The rescue wave had capacity reserved for future arrivals, while `InfectedSystem.endBite` checked that reservation before marking a bite as turning. The rescue now protects two conversion slots for its firefighters through +90 seconds and admits scheduled ambushers when capacity is available. The authored 24 infected and original 0.45-second arrival spacing remain unchanged.

L3 officers did not prioritize infected close to the courier strongly enough, so too many hits landed during the route. Officer target selection now weights nearby courier threats more heavily. Squad movement recovery gives a lagging L3 follower bounded catch-up speed, and its calm moving slot uses a smaller lead to keep the formation near the specified band. No infected counts, stats, acceptance thresholds, or evaluator logic changed.

Files changed: `src/sim/ai/InfectedSystem.ts`, `src/sim/missions/LevelTwoRescue.ts`, `src/sim/npc/Npcs.ts`, `src/sim/outbreak/Allies.ts`, and `src/sim/outbreak/Outbreak.ts`.

## Verification and open items

- Re-ran `npm run qa:accept -- --level L2 --skip-browser --tier high|low` and `npm run qa:accept -- --level L3 --skip-browser --tier high|low`; receipts are in `docs/reports/fix51-verify/`.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L2,L3`: zero L2/L3 criterion flags. The report includes only the expected `PARTIAL_LEVEL_SELECTION` diagnostic.
- `npm run typecheck`, `npm run lint`, and focused Vitest files `infected-ai`, `missions`, and `npcs`: pass (13 tests).
- Open: L3 low calm following distance has five samples above 6 m (maximum 6.51 m); high calm following distance remains unmeasured. L2-12 high changed from 15.74 to 31.38 attacks/min and now exceeds its 30/min ceiling. The cause of that regression has not been isolated; low changed from 10.38 to 13.68 and remains in range.
