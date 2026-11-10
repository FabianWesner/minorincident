# r30-l9bridge: L9 bridge checkpoint restart (r28-vqa P2)

Finding (r28-vqa, P2): "L9 bridge checkpoint start: the APC starts nose-to-tail behind the school bus inside a horde, and the objective points through the bus (high / zoom 1.5 / WebGL2, t67)."

## Cause
1. **The `bridge` snapshot is wherever the player parked.** `LevelNineDriving.evacuate()` sets the checkpoint the moment the evacuation completes. The APC is parked in the bay (fixture: 447.3, 0.6, yaw -0.93, 50 degrees off the bridge axis) with the chasing school bus 10 m away, 9+ infected within 40 m, and nothing authored about the restart. A retry restored that exact picture; with the bus autopilot still hunting the APC it kept shoving it (APC drifted 0.6 to 2.3 m in 5 s without input).
2. **Resume (Continue) froze the APC.** `LevelNineCrash.prepare()` restored the persisted `l9Crash` entities into a world at tick 0 without rebasing their absolute ticks. The APC's `impactStallUntil` was 8890 vs tick 0, so after Continue the APC could not drive for ~148 s (probe: throttle 1, speed 0.00 for 1800 ticks, even with the bus gone). Same family as the r29-l10mega lesson (absolute ticks on restore). `Mission.restore` already rebased; the L9 resume path did not (vehicle contacts/boarders/passengers, explodeAt, recoveringUntil, light start, infected until/cooldown/recoverAt/deadAt).

## Fix
- `src/data/l9.ts`: `l9Course.bridgeStart` = authored pose (452, 0, yaw 0 = east, clear lane to the deck) and the bus set-back candidates (60/50/42 m behind, z +12/0/-12).
- `LevelNineDriving.safeBridgeStart(always)`: once the evacuation is done and the APC is before the bridge, a **retry** (`always`) or a **resume whose lane is blocked / bus within 18 m** puts the APC on the authored pose (zero velocity, courier still the driver), sets the bus back 42-60 m on a clear, resident spot, and runs the usual respawn `clearThreat` (infected within 9 m pushed out, pursuers lose her 4 s, 2 s grace). No infected stat or count changed. `laneClear(metres, yaw, bodies)` is the shared "nothing solid ahead" probe (nav + solids from just past the nose).
- Hooks: `Respawn.respawnAtCheckpoint` (L9 driving branch, retry) and `LevelNineCrash.prepare` (resume). `clearThreat` is now exported.
- `LevelNineCrash.prepare`: rebases the saved absolute ticks by `world.tick - saved.tick` before `vehicles.rebuild(false, delta)`.
- Fixture `l9-at-bridge.json.br` is unchanged (still old pose; the fix happens at load, which is exactly what a real old save does).

## Per-checkpoint check (native, skilled road bot, `tools/qa/r30-l9bridge-checkpoints.ts`; the bot is killed once at each new checkpoint)
| Checkpoint | Restart pose | Lane 8 m ahead | Bus | Verdict |
|---|---|---|---|---|
| `crossing-start` | level start (fresh), authored | clear | none yet | fine |
| `mid-crossing` (rail stall, 377, -212) | where the driver stalled, same as live | clear to the east; bot heading is skewed 70 degrees (its steering), blocked on that heading (rails), east clear | 66 m behind, arrives during the 30 s stall (design, ram cap 12) | fine, no change |
| `evac-point` (bay, 447.7, 2.6) | where the driver parked, same as live | clear | 13 m, held short by the evacuation hold (design) | fine, no change |
| `bridge` | **before: 447.6, 2.6, yaw -0.88, bus 11 m, lane blocked. After: 452, 0, yaw 0, bus 60 m, lane clear** | clear | 60 m behind, 16 m after 5 s idle (it chases; player has 5 s to drive) | fixed |
| `outskirts-approach` | scripted crash (courier has no control), APC on the deck | clear | 65 m | fine |

## Tests and proofs
- `tests/engine/vehicles.test.ts` (existing L9 aggregate test, no new test case): `l9CheckpointLanes` restores `l9-at-bridge` and `l9-before-rail-stall`: 8 m of clear route ahead (bridge: bodies included; rail: static only), no impact stall left after Continue, bus >= 30 m behind at the bridge resume and after a death + respawn, lane clear and courier still driving after the retry. Pass.
- `tools/qa/check-fixtures.ts`: 7/7 ok. `tools/qa/r30-l9bridge-probe.ts --drive`: from the l9-at-bridge fixture the courier now reaches `outskirts-approach` in 190 ticks (before: speed 0.00 for 1800 ticks).
- `l9-driving-proof` (seed 1, low): road completed 200.1 s, risky completed 191.8 s, countryside completed 209.3 s, all 0 collision failures. `--zero` completed (412 s) with 5 collision-failure offenders (infected vs infected `cleanup.separation` / `infected.update`, depth 0.02-0.16 m, tick 17000+ in the bay). Nothing in these full runs executes the new code (no death, no resume), so they are baseline behaviour; r29-l9pin recorded 0 failures at 325.8 s on its base, so the `--zero` overlap is chaotic drift from base changes since, not from this lane (not re-measured on the old base).
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: skilled complete 200.05 s, passive complete, 0 L9 flags. (The tool prints "1 fail flags": that is the unmeasured L8-04 row because only L9 was selected.)
- tsc and eslint clean. `npm run test:gate`: see final report.

## Capture (opened)
One headless browser (port 4895, WebGL2, high, zoom 1.5, `r28-vqa-fixture-play.ts l9-at-bridge --follow-marker --god --no-kite`). `s000-t69`: APC on the road facing the bridge arrow, "Drive onto the bridge 18 m", flanking barriers, no school bus, no wall in front. `s002-t318`: APC rolling east, "Drive onto the bridge 3 m", wrecks only at the verge. (Captures stay in the lane scratchpad, not in git.)

## Browser QA needed (one QA lane)
- L9 bridge retry and Continue at high and low, zoom 1.5 and 1: APC pose on the road, bus appears from the west within about 5 s, horde spills but does not stand on the APC.
- Mid-game Continue on L9 at evac-point and mid-crossing: the APC must drive immediately (rebase fix).
