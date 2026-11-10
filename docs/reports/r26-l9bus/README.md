# r26-l9bus: pursuing bus vs the braked APC during the L9 evacuation hold

Finding: "[P3] L9: pursuing bus shoves the parked braked APC ~10 m during evac hold; l9-driving-proof --risky/--zero/countryside variants incomplete."

## Root cause

`LevelNineDriving.busIntent` drove the infected school bus with `throttle = 1` for the whole level, also while the APC sits parked with the brake on during the evacuation hold. The bus (7000 kg, 13 000 engine force) hit the APC (6000 kg, braked) with a 2.4 m first shove and then kept pushing at full throttle, creeping the APC about 0.22 m/s for as long as the hold lasts (about 10 m over the hold). Braked wheels only resist along the wheel axis, and nothing ever told the bus to stop pushing.

## Fix (src/sim/missions/LevelNineDriving.ts, `busIntent`)

Only while the evacuation hold is active (`evacuationAt !== null && !evacuationDone`):
- the bus slows on approach (allowed speed 2.5 m/s plus 0.6 per metre beyond a 4.5 m gap) and halts 3.5 to 4.5 m short of the APC hull;
- a bus that is already alongside when the hold starts (countryside route) reverses off the APC until the gap is 3.5 m, so it does not wall in the passenger door.
Its passengers still spill and attack as before. Deterministic: only the autopilot intent changed, no timers or randomness. Zombie/infected stats untouched. The earlier rail-stall "hold" is intentionally not affected (a first version keyed on `holding()` broke the road run: APC wrecked at the gate).

## Sim test

`tests/engine/vehicles.test.ts`, `l9BusVsParkedApc` (folded into the existing "enter, drive and exit" test because the test budget is 150 cases). APC at the evac point, bus released 60 m behind at its normal autopilot, 30 s hold: APC displacement must be at most 1.5 m, and the bus must really close in. Measured with the same scenario before the fix: first shove 2.4 m, 4.62 m after 15 s and still creeping (about 10 m over the full hold); after the fix: 0.00 m.

## l9-driving-proof (tools/qa/l9-driving-proof.ts, low tier, seed 1), remote runner

| variant | before (HEAD) | after |
|---|---|---|
| road (skilled bot) | completed, 222.5 s, 0 collision failures | completed, 200.0 s, 0 collision failures |
| road `--zero` | not run before | completed, 438.9 s, 0 collision failures |
| road `--risky` | did not complete in 600 s: 4/4 survivors evacuated, evacuation never completes | still not complete in 600 s, same stall (see below) |
| countryside | did not complete in 600 s: evacuation started, 0 survivors evacuated | still not complete in 600 s, but 4/4 survivors now evacuate (tick 11614 to 13751) |

(The `--zero` first run happened with an intermediate version of the fix; `--risky` once completed in 330 s with that version, 6 infected-vs-infected overlaps of 0.02 to 0.04 m late at tick 18 586, then the final version stalls like the baseline.)

Remaining blocker in `--risky` and countryside is not the bus: the evacuation completes only when the corgi and Sam are seated, and the corgi stops 3 to 4 m from the APC passenger door (APC parked at yaw about -0.85 at 447.7, 3.1; corgi at 444.2, 0.8; the bus is far away or stopped). `boardPassenger` needs the corgi within 1.2 m of `passengerDoor`; `npcs.move` never gets it there. In the countryside run the APC also arrives with durability 0 (about 25 bus rams of 40 on the way). Suggested follow-up lane: companion door approach when the APC parks diagonally (corgi path to `passengerDoor`).

## Checks

typecheck and lint clean; focused vehicles test and `npm run test:gate` on the runner (see report); skilled bot unchanged (completes, 0 collision failures).

## Browser QA needed

- L9, evacuation hold at the evac point (x about 457), quality low and high, zoom 1 and 1.5: the bus approaches, slows and stops 4 m short of the APC, no APC shove; infected spill from the bus and attack. Check the bus does not look frozen or stuck in a weird pose (it brakes from about 12 m/s).
- Countryside route: bus alongside at hold start reverses away from the passenger door; no visible clipping into the APC or fence.
- Boarding of the corgi and Sam at the end of the hold (still failing in the risky/countryside bot runs, see above).
