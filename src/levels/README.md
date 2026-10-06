# Level 1 v2: Special Delivery

`resolveCampaignMission('L1', world.districts)` (`missions.ts`, L1 case) builds the L1 v2 graph on the D-GROVE anchors:
`pickup` (depot counter, 1.0 s) → `deliver` (Medical Annex door) → *4 to 6 s calm and the accident, no objective* →
`escape` (get 30 m from the facility) → `weapon` (bat in the Henderson garage) → `firestation` (bay trigger; the
shutter gate closes, caption "Delivery complete. Outbreak: not contained.", result). `compositions.L1` is D-GROVE alone;
the retired M1 map (diner, hardware store) stays reachable as `compositions['L1-M1']` for its geometry regression suites.

`src/sim/missions/LevelOneOutbreak.ts` is the story controller (`def.l1`), scripted only up to the infected exit:

- the lab technician is a civilian-component entity driven by the script: he walks out, takes the box, walks back in
  (`delivered`, toast "Delivered ✓"); the calm length (4 to 6 s) and the exit delay (8 to 10 s) come from the seeded `l1-story` stream;
- accident events `l1.flicker`, `l1.blast`, `l1.ringing`, `l1.smoke`, `l1.screams`, `l1.infectedExit` are emitted at the
  `l1v2.accident.eventAtS` offsets (lane H renders and voices them); `mission.signal l1.corgi-warn` precedes the flicker;
- at the exit five infected leave through the front door (the technician turned in place by `outbreak.turnNow`, same id and look), the side door and the window on headings 125/55/350/180/235 degrees, sent out with `ai.rush`; the `accident` checkpoint is captured at that moment, `bat` at the pickup;
- from there the outbreak is systemic (lanes C and D); the controller only counts pedestrians turned and escaped for the result.

Checkpoints snapshot `state.l1`, all entities, the outbreak layer (`snapshot()`/`load()`) and optional duck-typed seams (`l1Seams.ts`); `ensureHorde` runs at the bat pickup; the bicycle is never moved by scripts.

Tests: `tests/levels/L1.test.ts` (graph, bots `complete`/`newbie`/`idle`/`evade-only` and the duel harness from
`tools/sim-runner/l1Bots.ts`, accident order, checkpoints), `tests/e2e/levels/L1.spec.ts` (real-input playthrough, photo spots),
`tests/perf/l1-transitions.spec.ts` (frame budget at each transition). Run a bot: `npm run sim -- --scenario l1-complete --seed 3`.
