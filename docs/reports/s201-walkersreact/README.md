# s201 — scripted walkers react to the courier

## Result

Non-strict scripted infected routes now hand over to the courier within 9 m or when hurt. The courier takes priority over nearby party members, preventing a released L8 walker from redirecting its first contact to a follower. An authored route is only interrupted by proximity when the courier is alive and visible; this avoids targeting her through cover or while she is hidden inside the L9 APC.

`HouseEmergence` applies the notice radius to every non-strict route. Generic AI scripted walks use the same 9 m radius and now honor hits for every infected archetype, not only Alphas. L10 no longer needs a one-off `reactsToCourier` flag.

## L8 follower wait

The follower wait was caused by the cleared-arena exit gate closing after the courier crossed, while living followers were still in the stage zone or at the exit. The gate now stays open until the followers clear that area. The elephant encounter also held the party at the distant arena entry, leaving followers far behind during its charge; its hold point now uses a clear flank beside the courier. Zoo carriers keep their animal interception target until the courier is within 9 m or the carrier is hurt, then prioritize the courier.

## Authored route exceptions

- **L4 breach approaches (`wire`, `vault`, `outside`, `inside`)** stay scripted while the infected is traversing wall and rail geometry. They hand off on visible close contact; generic proximity through cover does not cancel the leg and strand the actor. This is the geometry-owned route exception.
- **L9 vehicle approaches while the courier is hidden in the APC** continue to target the moving vehicle because the hidden courier cannot be perceived or attacked. `pursueCrossingVehicle` switches the infected to the courier when she exits. This also prevents a false proximity handoff through the vehicle during evacuation.
- No house emergence route currently sets the `strictRoute` option; all such routes use the new proximity and damage handoff.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused tests — passed: L1 house route and L8 tunnel route hand off within 9 m; AI scripted hit/proximity behavior; L4 geometry/contact contracts; L8 follower gate behavior.
- `npm test` — passed, 27 files / 106 tests.
- `npm run qa:threat` — passed, all skilled routes complete and **0 fail flags** (279.0 s; L8 skilled complete).
- `sh tools/remote/run.sh "$PWD" -- npm test` — runner timed out at 240 s without a reported test failure. The required fallback passed: full local `npm test` (106 tests), and `tests/engine/l4-contact.test.ts` passed on the remote runner during that run (159.4 s).

## Files changed

`src/sim/outbreak/HouseEmergence.ts`, `src/sim/ai/InfectedSystem.ts`, `src/sim/missions/LevelTenEncounters.ts`, `src/data/l8Bosses.ts`, `src/sim/missions/L8BossArenas.ts`, `src/sim/missions/LevelEightZoo.ts`, `tests/helpers/l8Route.ts`, `tests/nightly/mission-interactions.test.ts`, `tests/engine/infected-ai.test.ts`, and `tests/engine/l4-contact.test.ts`.
