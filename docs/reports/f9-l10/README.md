# f9-l10 implementation report

Status: **in progress**. Fresh high/low CPU acceptance, story, and checkpoint probes are complete; route time and visual review remain open.

## Findings and current measurements

| Row | Before | After (current evidence) | State |
|---|---|---|---|
| L10-07 / L10-11 | High Mega jump 372.9 m/tick; low 203.9 m/tick, caused by direct position assignment at the overpass beat. | Both tiers' story probes pass the overpass beat checks. Prior acceptance measured max Mega step 0.33 m/tick in both tiers; targeted native replay shows the real persistent Mega keeps moving while a separate actor performs the prop throw. | Teleport cause is fixed; full L10-11 QA review is not independently evaluated by CPU acceptance. |
| L10-15 | At cure-disperse-ready, boss restored dead at 0 HP after it was killed after checkpoint capture; expected live at 1116 HP low / 1072.8 HP high. | High and low acceptance checkpoint suites both pass cure-disperse-ready (18 clauses each). A targeted native checkpoint probe also restored a deliberately killed 3000-HP fixture to 3000 HP and coarse pursuit. | Boss checkpoint defect is fixed. Five unrelated checkpoint probes per tier still error on missing `id`. |
| L10-09 | 0 lab-container stacks, 1 tent, 1 generator and 1 emergency light in the original hangar inventory. | Layout now authors 3 container stacks, 3 quarantine tents, 3 generators and 4 emergency lights around the hangar perimeter, away from the center aisle/cast and without new collision boxes. | High and low captures now run through the browser pool; both side views show a tent and oversized container stacks, but entry view and cast remain unverified. |
| L10-03 | Prior complete-route evidence: 1349.4 s high / 1194.4 s low. | Fresh complete-route receipts: 1308.03 s high with 3 deaths / 1217.48 s low with 2 deaths. Story route probe: 1425 s high / 1244 s low (two deaths each). The hangar exchange totals 37 seconds, down from 56. | Still outside 600–1200 seconds by 108.03 s high / 17.48 s low. No fight was shortened. |

The pacing trace's longest stationary non-finale interval was the research-hangar conversation (about 50 seconds sampled stationary before the change). Other long stationary periods were a corridor combat interval and the authored cure charge / ending; those are not removed. The high pacing trace's largest observed encounter-beat gap was 38 s. The route audit also reports checkpoint gaps up to 900.9 m high / 715.9 m low, so route distance review remains necessary. The current story probe reports 86/92 checks; its remaining failures are indoor-cast presence, production resume restoration, and controlled fixtures (one of each per tier).

The final threat audit's sole fresh flag is `dispersal-assault:WAVE_NO_ATTACK_WITHIN_20_SECONDS`. A high-tier seed-1 native probe showed the courier is at y=0.71 at charge start, climbs to the mounted gun deck (y=3.78) within about four seconds, and leaves living assault members at ground level within 5–22 m. No infected attack event occurs in the first 20 seconds. The platform height and shield protect the courier while the mounted gun kills most of the first cohort; this needs a game-side approach that lets at least one authored attacker reach the stairs or courier.

## Cause found

- The overpass story controller repositioned the live persistent Mega directly beside the courier; the revised beat hands off only when that actor is both far away and offscreen.
- `MegaPursuit.restore()` retained a kill from the discarded timeline when restoring a checkpoint snapshot. L10 needs its saved boss alive/dead state to be authoritative.
- The hangar's layout hook only placed one tent, one generator and one light and no lab-container stacks.
- A 56-second sequential subtitle exchange made the courier wait inside the hangar.

## Files changed

- `src/sim/missions/LevelTenStory.ts` and `src/sim/ai/InfectedSystem.ts` — overpass grab waits until the live Mega reaches the courier, or hands off to a short-lived matching actor only when the real pursuer is far and offscreen; the real Mega remains on its route.
- `src/sim/missions/Mission.ts` — scripted boss dead-set entries are removed when the checkpoint snapshot contains a living actor.
- `src/sim/missions/l1Seams.ts` — L10 restores Mega pursuit state exactly from its checkpoint; other levels preserve their prior kill rule.
- `src/levels/L10/layout.ts` — hangar perimeter dressing using existing props.
- `src/data/l10Story.ts` — subtitle durations reduced to 37 seconds total while retaining all ten lines and their order.
- `tests/engine/missions.test.ts` — existing checkpoint test now distinguishes a kill before checkpoint from a kill after checkpoint.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused `tests/engine/missions.test.ts` — 5 passed.
- `npm run qa:accept -- --level L10 --skip-browser --tier high` — complete route 1308.03 s / 3 deaths; stationary and general fixtures completed; cure-disperse-ready checkpoint passes. Overall: 5 fresh failing rows, 10 incomplete, 5 checkpoint errors on missing `id`.
- `npm run qa:accept -- --level L10 --skip-browser --tier low` — complete route 1217.48 s / 2 deaths; stationary and general fixtures completed; cure-disperse-ready checkpoint passes. Overall: 5 fresh failing rows, 10 incomplete, 5 checkpoint errors on missing `id`.
- `L10_STORY_TIERS=high,low L10_STORY_SEED=0 node --import tsx/esm tools/qa/l10-story.ts` — 86/92; overpass checks pass, three unrelated failures per tier remain.
- Headless Scene Lab capture — blocked before browser launch because sandbox denies Vite's localhost listen with `EPERM` on ports 4342 and 3341.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L10` — passive audit has 0 flags; overall audit has one fresh `wave/dispersal-assault:WAVE_NO_ATTACK_WITHIN_20_SECONDS` flag (13 cohort members, no attack start in 20 seconds). The command's other flag is `PARTIAL_LEVEL_SELECTION`, which is the documented diagnostic-only selection notice.

## Open

1. Continue reducing both complete-route durations to 600–1200 seconds through game-side removal of idle/padding; current high/low receipts are 1308.03 / 1217.48 seconds.
2. Render high first, then low hangar entry and both-side captures through an available browser-pool route; open and describe the captures and verify the safe aisle and cast remain clear.
3. Resolve the six unrelated current story failures and five missing-ID checkpoint fixture errors without changing evaluator code; current story probe is 86/92.
4. Fix the dispersal assault's missing first attack without changing the audit, then confirm the final threat audit has zero L10 flags.

## Visual capture follow-up

Headless pooled L10 checkpoint captures were rendered high first, then low, from the entrance and both sides under `test-results/f9-l10/hangar-{high,low}/`. I opened all six. Both side views show the cure terminal, a white quarantine tent, and large red/teal container stacks; the west view is dark and partly obscured by stacks. The entry view looks toward the quarantine wall and does not establish aisle clearance or cast presence. The checkpoint placed the player at the start until teleported to the hangar, and no cast appeared in these captures. These are therefore not sufficient visual acceptance: reposition and scale the props as needed, capture the live story cast, and inspect the entry and both sides again.

## Hangar placement revision

The first dressing placed full-sized container stacks and tents across cast positions. Their static shapes blocked the nav-clear check, leaving the six-person cast absent. The stacks now use 0.45 horizontal scale and the tents 0.5 horizontal scale, moved to perimeter positions. High then low pooled captures at `test-results/f9-l10/hangar-{high,low}/` were opened: side views show guards, a researcher, smaller red/teal stacks, white tents, generators and the cure pedestal with open central floor. The entrance view faces the opposite wall, so doorway clearance still needs an appropriate capture. No infected are visible in these images; they do not prove the full safety requirement.

The high/low story probe after this change ran at full CPU for five minutes without reaching its first tier result and was interrupted; its earlier 86/92 result is stale. Typecheck passed. Full acceptance, threat audit and story checks must be repeated on the revised source.

## Story fixture diagnosis

An instrumented copy of the unmodified story probe confirmed that on the revised layout the high-tier checks for six living cast members, entrance-to-handoff navigation, ten weapons and production resume all pass. The title-within-65-seconds check also passes. The previous apparent hang occurs later while simulating the 94-second credits interval in the full world; the diagnostic run was interrupted after these results, so it is not a complete story gate. Low-tier and route checks still require a complete run.

## Depot checkpoint experiment

A recovery point after the full depot cohort was tried and removed: on seed 1 it did not fire until x=1800 (401.9 s high / 304.0 s low), after the high industrial death at x=1648 and immediately before the regional military checkpoint. It therefore did not remove the observed retry. Native pacing completed at gameplay end 1417.43 s high / 1077.45 s low, with 4 / 3 deaths. The fresh high acceptance run before the experiment reported 1482.45 s with four deaths, and its checkpoint suite passed 21 clauses with four missing-ID errors; the hangar change fixed one previously failing checkpoint. Route time, the assault threat flag and complete acceptance remain open.

## Industrial crossing recovery

A standard medkit was placed at [1559, -21], on the measured field crossing after the depot. In the previous seed-1 trace the high courier died at x=1648 after passing x=1559 at 27 HP; with the cache both tiers reached the military region alive. The first placement at [1600, -20] missed the courier by about 6 m and was moved. The high/low native pacing runs still took 1281.0 / 1275.38 s to cure release (3 / 2 deaths); low repeated the field-hospital fight twice. Complete acceptance and threat audit have not been rerun after this placement. Further work must reduce corridor/finale retries without removing encounters and verify the 600–1200 s acceptance measure.

## Roadblock recovery change

The roadblock gate previously required permanent death of every admitted cohort member. Recoverable knockdowns could revive repeatedly while the courier waited. The gate now opens when all admitted members are down; their bodies and recovery timers remain. Seed-1 native pacing improved from 1281.0 / 1275.38 s to cure release to 1228.0 / 1242.0 s high / low; high / low deaths were 2 / 1. Low still had a 127.18 s gap during a hospital retry, and both tiers remain outside the acceptance band. The current-source threat audit has zero L10 flags (only `PARTIAL_LEVEL_SELECTION`), including no assault-wave flag. The existing roadblock and boss restore tests were updated to check recoverable bodies and checkpoint HP; all seven tests in `tests/engine/save-progression.test.ts` pass. Lint passes. Full high/low acceptance and story checks remain required.
