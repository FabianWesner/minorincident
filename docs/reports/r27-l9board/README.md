# r27-l9board: companions at the L9 APC door, countryside bus rams

Finding (from r26-l9bus): "`--risky` and countryside stall ... The corgi stops 3-4 m from the APC's passenger door, so the corgi and Sam never get seated and the evacuation never completes. In the countryside run the APC also arrives with durability 0 after about 25 bus rams."

## Root causes

1. Boarding radius vs nav margin (potential P1, fixed). With the APC parked at yaw about -0.85 at (447.7, 3.1), the passenger door point (445.5, 0.6) lies inside the hull's nav margin (`nav.clear(door) = false`). `npcs.move(corgi, door, 2.5, ..., .15)` therefore halts on the nearest clear cell, 1.29 m from the door (probe: `tools/qa/r27-l9board-probe.ts`, corgi frozen at 444.25, 0.76 for 55 s), while `boardPassenger` needs a companion within 1.2 m (civilians 0.7 m). Short by 9 cm, forever. Sam (0.7 m) is affected the same way. The earlier "3-4 m" was the corgi still walking in; the real stall is the last 9 cm.
2. Bus ram spam (countryside). The ram has only a 2 s cooldown and needs `max(bus, APC speed) > 2`. A bus glued to the crawling or rail-stalled APC rammed 19 times in a row every 120 ticks (30 in total, 40 durability each) and drove the APC to 0 before the evacuation; the road route has about 4.

## Fix

- `Vehicles.boardPassenger(carId, actorId, reach?)`: optional door radius (defaults unchanged for L5/L8/L9 crash).
- `LevelNineDriving.doorReach`: during the evacuation, a companion or Sam standing on the outer side of the door (not farther from the hull centre than the door) within 2 m may board. Across the hull it cannot.
- `busRamCap = 12`: the bus damages the APC at most 12 times per level (480 of 1000); it still drives and pushes. Infected stats untouched; deterministic (counter in the mission state).
- Tried and dropped: a 90-tick back-off after each ram. It changed the bot trajectories enough that road, `--zero`, `--risky` and countryside all failed; the cap alone leaves road, risky and countryside intact.

## Sim test

`tests/engine/vehicles.test.ts`, `l9CompanionsBoardDiagonalApc` (folded into the existing "enter, drive and exit" test, test budget): APC at yaw -0.85 and +0.85 at the evac point, corgi and Sam released outside 6 to 7 m away; both must be passengers within 20 s of the hold. Verified red without the fix (Sam never boards), green with it.

## l9-driving-proof (low tier, seed 1, remote runner)

| variant | r26 main | after |
|---|---|---|
| road (skilled) | 200 s, 0 collision failures | 200 s, 0 failures (2 rams) |
| road `--risky` | no finish in 600 s | 191 s, 0 failures (4 rams) |
| countryside | no finish in 600 s | 252 s, 0 failures (12 rams, was 30; durability still 0 at the rail) |
| road `--zero` | **no finish in 600 s on pristine main today** (r26 README's 439 s was an intermediate version) | still no finish, unchanged cause |

### `--zero` (not fixed, pre-existing)
Verified on unmodified main and with every variant of my change: the APC starts at durability 0, so the speed cap is the floor (60%, 7.1 m/s). It idles about 8000 ticks near (-62, -291) (ramp/tanker area, speed 0 to 2.5), later sits at (378, -208) with 8 boarders on the hull at 0.3 to 0.6 m/s for the rest of the 600 s and never reaches the evacuation point. This is the boarder and ramp-speed behaviour at the speed floor, not companions or the bus. Suggested follow-up lane: boarders at the speed floor (shake rules, `boarderLimit`) and the `speed < 7` ramp check against the 7.1 m/s cap.

Countryside still arrives at durability 0: the remaining damage is infected `attack` hits (112 in the run), not the bus. Whether that is fair is a design question (no infected stat change allowed here); the level finishes at 0.

## Checks
tsc, eslint, `vehicles.test.ts` (both tests) and the proofs above on the runner. `npm run test:gate`: green (27 files, 106 tests, 175 s).

## Browser QA needed
- L9 evacuation, APC parked diagonally (try yaw about -0.85 and +0.85 at x 447 to 452), quality low and high, zoom 1 and 1.5: corgi and Sam walk to the door and board without a visible hop or slide through the hull; no clipping into the hull when boarding from up to 2 m.
- L9 countryside: bus rams per run and the APC durability bar (should not drop to 0 from the bus alone).
