# r33-l9polish: L9 follow-ups from r32-l9fun

Lane r33-l9polish (claude-sonnet-5-5), 2026-11-11. Based on main c153a57f. Commits: a86c0545, 4083e041 and the final one (spacing 300, leaper gate, fixtures, README).
Captures (git-ignored, scratchpad): `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r33/` (`cap-low/`, `cap-high/` with sheets, `stall-run2/sheet.jpg`).

## 1. Road drive reaches the bay with armour

Cause per hit (`tools/qa/diag/l9damage.ts`): the stall thrower hit the stopped hull 4 of 4 (120), and the bus rammed the APC 11 times (440; the bus rides on the APC's rear after the restart, 40 each, cap 12). Infected stats are unchanged.

- Bus ram cap 12 -> 3 total (`busRamCap`, LevelNineDriving).
- A thrower aiming at a stopped hull now brackets it (`stoppedOffsetsM` in `l9SetPieceTuning.thrower`): two throws land beside the hull axis (hit, smashed), two land 6 m to the side of the lane. First attempt put the misses 7 m ahead/behind on the axis: an unsmashed barricade ahead wedged the APC after the restart (seed 2, stuck 45 s). Lateral misses fixed that. Stall thrower damage 120 -> 60.

Armour at the bay, skilled bot, low (before this lane -> now):

| run | before | now |
|---|---|---|
| road seed 1 / 2 / 3 | 0 / 0 / 30 (seed 1 = 0 per r32) | 300 / 240 / 280 |
| countryside | 140 (r32: 440) | 520 |
| road `--risky` | 0 | 0 |
| shortcut `--risky` | 0 | 0 |

The risky line still ends at the floor (tanker blast and rams at speed); it completes. Road seeds sit at 240-300, just under the 300-500 target; I did not cut the leaper or brute hits further (they are the authored fight).

## 2. Bridge-gate wall and bay start

- `l9Course.bridgeGate = { x: 472, halfZ: 34 }` (was 13): collider (`interactables.block`) and the striped render (19 stripes per parity) run to +-34 m. No layout change (no JSON diff needed: the wall is a sim blocker plus L9Props render, no procedural dressing touched).
- `l9Course.bay = { x0: 443, x1: 484, halfZ: 40 }`: the evacuation starts when the APC stops (speed < 1) anywhere in that box, as before inside the 11 m radius. Test case folded into the vehicles chain (`l9BayAndHatch`): wall halfZ >= 34, and an APC placed 30 m north of the lane in the bay starts the evacuation.
- Capture: `cap-low/bay-beyond-north-end-z1.png` and `cap-high/bay-beyond-north-end-z1.5.png`: the red/white wall ends at the north limit, the APC beside it, tree and bus beyond. Limits: a player can still drive around the wall at > 34 m (open map); the evacuation also starts there if the APC stops inside x 443-484, |z| <= 40.

## 3. Stale fixtures

`tests/fixtures/saves/qa/l9-before-rail-stall.json.gz` (196 KB) and `l9-at-bridge.json.br` (161 KB) re-packed with `tools/qa/make-checkpoint.ts --what qa --qa-parts l9` (new `--qa-parts` switch so L8/L10 are not re-run). Both were stale (rocket launcher in the loadout; verified gone). The bridge fixture now waits for 8 m of clear lane east of the APC (the bot parked beside the sandbags right after the bay and `l9CheckpointLanes` failed).

## 4. Hatch fairness

Boarders now climb aboard at most one per 300 ticks (5 s) while the APC is stalled (`vehicle.boardSpacing`/`nextBoardAt`, set by L9 from `l9SetPieceTuning.stall.boardSpacingTicks`; the leaper pounce obeys it too). No infected stat changed. Hatch probe (`tools/qa/diag/l9hatch.ts`, bot drives to the stall, then a passive courier sits at the open hatch, road seeds 1/2/3): dead 15 / 16 / 15 s after the first boarder grabs; before: 7.4 s (5 boarders by t = 10 s). With the bot's MG hatch fight the courier keeps 100 HP.

Real keys (`r28-vqa-fixture-play.ts` on the re-packed fixture, courier holding the shotgun, no boarder kills): first life 9 s from first damage to death (90 -> 0), retries ~6 s because a checkpoint retry replays a crowd already on the hull. The real-key driver does not shoot boarders well, so this is the worst case; the shots show the leaper on the hull, the bus rammed behind the APC and debris landing beside the lane (`stall-run2/sheet.jpg`).

## 5. Ramps and the see-through car

`L9Props` ramps are dressed per kind (colliders untouched, all boxes inside the plate/landing volume):
- overpass: slab with spalled dark edges, cracks and rebar at the lip, rubble under it, broken chunks on the landing block;
- embankment, creek bank, ditch: grass-topped earth bank with shoulders, stones and a dirt-lane strip; earth mound landing (ditch uses dry grass);
- wreck pile: patchwork of crushed car roofs (six paints, glass patches) over car-coloured slices, tyres at the sides, two layers of crushed bodies as the landing.

Wreck assets at the wreck-pile landing: all three now on the far (north) side (`veh.wreck` at (8.5, -6.4), (14.5, -6.2), (-9, -5.6) relative to the ramp). The see-through car was the one at (+11, +5.6), between the camera (south) and the APC.

Opened captures (night, ramps 5, WebGPU; `tools/qa/r33-l9-ramps.ts`, port 4923, one browser):
- low zoom 1.5 `overpass-air`: APC airborne over a dark broken slab, landing block with grey rubble pieces; reads as a collapsed slab, crack and rebar details are too small to see at this zoom.
- low `wreck-pile-air/landed`: car-roof patchwork ramp in brown/blue/green/yellow, landing of stacked bodies; reads as a pile of crushed cars. Roadside wrecks on the north side are solid.
- low/high `embankment`, `creek-bank`, `ditch`: green grass top on stepped earth shoulders with a dirt-lane strip; reads as an earth bank; in the dark the earth sides are almost black.
- high matches low (same shapes, slightly cleaner shadows). WebGL backend not captured here.

## Verify

- Driving proofs (low, seed 1): road 220.7 s, `--risky` 274.2 s, countryside 216.7 s, `--zero` 320.6 s: all completed, courier 100 HP, 0 collision failures, 0 admission violations.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: skilled complete, passive complete, 0 passive flags (the one fail flag is the L8-04 "not measured" row, because only L9 was selected).
- Tests (remote): vehicles, missions, save-progression, infected-ai, world-systems, render-contracts, vehicle-scenes passed; `npm run test:gate`: 27 files, 107 passed (run before the last two small edits; vehicles + missions rerun after: passed). typecheck and lint clean.

## Browser QA needed
- Zoom 1.5, low and high, WebGL2 and WebGPU: all five ramps at night (dressing readable, no z-fighting between plate and added boxes at the lip, APC wheels not sunk into the pile roofs).
- Bay: north and south ends of the wall; evacuation starting with the APC parked in the NE corner.
- Rail stall on a fresh save: boarder pacing and courier HP with MG.

## Open
- Road seeds land at 240-300 armour (target 300-500).
- Risky lines still end at the 0 floor.
- Retry life at the hatch dies in ~6 s without shooting.
