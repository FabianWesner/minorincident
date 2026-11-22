# s230 — fixed objective rings

Objective destinations now stay anchored while the player moves. Route steering and gate prompts remain independent from the world ring. L8 was excluded from this lane.

## Native skilled trace

The trace is sampled after every native simulation tick during the `complete` bot run (seed 1). `movingTicks` counts coordinate changes greater than 5 cm while the same objective and destination are active.

| Level | Objective / destination trace | Before | After | Bot run |
| --- | --- | --- | --- | --- |
| L1 | pickup, deliver, escape, weapon, firestation | Fixed | Fixed | Complete |
| L2 | board, ride, bridge | Fixed | Fixed | Complete |
| L3 | armory, checkpoint | Fixed | Fixed | Complete |
| L4 | hide → cellar door | Moving along cellar route | Fixed at cellar door | Complete |
| L5 | emerge, each found-survivor destination, metro | Fixed per destination; changes when a survivor is found | Fixed per destination | Complete |
| L6 | retreat platform, exit stair, night exit | Moving between gate wait spots / recalculated stair side | Fixed at platform; stair target latched when the exit objective starts | Complete |
| L7 | rocket, corridor, bus boarding | Fixed | Fixed | Complete |
| L9 | evacuation bay → bridge deck | Followed gate/car position | Fixed per driving stage; changes when evacuation completes | Complete |
| L10 | route checkpoints, pickups, console | Live Mega pursuit moved the marker; pickup targets advanced when collected | Fixed at each destination; target changes on collection/objective transition | Complete |

All recorded destination rows in [native-trace.json](native-trace.json) have `movingTicks: 0`; all nine skilled runs completed. L4's trace uses the same low-quality campaign preset as the skilled QA runner so the long collapse escape is observed to completion.

## Changes

- L4's cellar guidance ring remains at the real cellar door; the existing route and navigation logic remain available to the bot.
- L6's retreat ring stays at the exit platform. The current closeable service gate is tracked separately for interaction prompts. The escalator destination is selected once and held for the objective.
- L9 uses the evacuation bay until survivors board, then the bridge deck. Neither target follows the hull or the side-fence recovery point.
- L10's Mega objective points to the dispersal console. The live Mega no longer rewrites the authored anchor. A legacy `cure-mega` marker also resolves to the console.

## Verification

- `npm run typecheck` — pass.
- `npm run lint` — pass.
- `npm test` — pass, 27 files / 106 tests (143.4 s).
- `npm run qa:threat` — pass, 0 fail flags; skilled bot completes L1–L7, L9 and L10.
- Focused tests: `tests/engine/l4-contact.test.ts` and `tests/nightly/mission-interactions.test.ts` passed; the L6 gate regression test passed after prompt separation.
- `sh tools/remote/run.sh "$PWD" -- npm test` — pass: 27 files, 105 passed, 1 skipped, 208.8 s.

## Visual review

[HIGH, zoom 1 sheet](rings-high-z1.png): L4 cellar door (left) and L10 dispersal console (right). The yellow rings and objective text identify the fixed destinations. Both rings extend beyond the bottom edge at this close zoom; their visible arcs and arrows remain legible. Captures use the L4 line-break checkpoint and a staged L10 Mega objective.
