# r29-l9pin: L9 APC pinned in a crowd after the L8 → L9 handover

Lane r29-l9pin (claude-opus-5-5), 2026-11-10, based on main 12d1d58c (PROD batch 63).

## Finding (r28-vqa, verbatim)

"L9: the APC is pinned again in a crowd after the real L8 → L9 handover. At (-265.7, -15.4), high / zoom 1 / WebGL2, ticks 6617–9956, it moved 0.3 m in 56 s with keys held, at 'barely functional', among about 50 infected (`l8-board-high-z1-gl/s059`, `s060`). My script steers straight at the pin and never reverses, so a human needs to drive this spot."

## What actually holds it

The QA log shows the APC at yaw 1.45 the whole time. On this level, the hull's forward direction is (cos yaw, −sin yaw), so it was facing −z (south). That points straight at a garden fence: `prop.privacy-fence:3658` and `prop.picket-fence:3659`. Both are static decay colliders, at z −18.4 to −19.1, x −268.5 to −261.6. The nose sits on the fence. At tick 7732 the nearest infected was 4.3 m from the hull centre and the APC still did not move.

The crowd is not what pins the APC. It is what stops the APC's own way out. Without infected, the same pose escapes: `VehicleBody` flags it as stuck after 180 ticks of throttle with less than 0.5 m of travel, and `Vehicles` then reverses it for 90 ticks at −0.8 throttle. That gave 106 m in 30 s (`l9apcpack.ts --pack 0 --boarders 0`). Inside the pack, three things defeat that recovery:

1. **Heavy stalls cancel the recovery reverse.** The heavy-stall override (`impactStallUntil`: throttle 0, brake on) ran after the recovery override in `prePhysics`. A brute or armored contact during the reverse, which is when the hull moves through the pack, stopped the hull and held the throttle at 0 for 60 ticks. The recovery window is only 90 ticks, so it was mostly used up. Trace: `stall:true, rec:true` on every recovery, 5 recoveries and 5 stalls in 30 s, 3.6 m in total.
2. **Heavy stalls at a standstill.** A heavy onset against a hull that is not moving still set a 60-tick throttle lock. That has no "momentum" to stop (E31-AC06). Its brake also cleared the 180-tick stuck history, which delayed the next recovery.
3. **The recovery steer was fixed at +0.6.** With right lock held, the reverse swung the nose back to where it started. Forward on right lock then put it into the fence again, in an endless loop. This happens even without infected: steer +1 gave 25.6 m, steer −1 gave 26.1 m, but the +1 run needed 4 recoveries instead of 1. In the pack it gave 2.3 m in 30 s.

The r27 heavy-stall grace (240 ticks) worked as intended. On the open road the same 50-infected pack never pinned the APC: 87 m in 30 s, both before and after this fix.

## Fix (`src/sim/vehicles/Vehicles.ts`, `src/data/vehicles.ts`)

- The stuck-recovery reverse now outranks a heavy stall. The L9 evacuation hold (`driving.holding`) still outranks both.
- A heavy onset stops the hull and locks the throttle only at ≥ `apcDurability.heavyStallMinSpeed` (1.5 m/s). It still bills its 40 (elephant 80) durability.
- The recovery reverse takes the lock opposite to the held steer, like a three-point turn. With no steer, left steer, or a driver who is already reversing, it uses +0.6 as before. With forward plus right steer held it uses −0.6.

**Bot fixes (`src/debug/bot/LevelNineBot.ts`).** The engine change moved the `--zero` road proof onto different lines. Those lines exposed two bugs in the L9 bot. The proof then failed in 600 s: first stuck at the closed gate (437.6, −2.9), and with only the steer fixed, crawling about 200 m backwards from the rail crossing.
- The bot reversed with a fixed +0.6 lock. That is the same three-point-turn mistake, and it looped against the gate side. It now reverses on the lock opposite to its last forward steer.
- The bot counted its own slow reverse (< 1 m/s) as a new block, so the 90-tick reverses chained forever. A slow reverse no longer re-arms the block timer.

A/B with original engine + fixed bot: also not completed in 600 s, stuck at (475, −144). The `--zero` run is chaotic, so any change to the drive shifts where it gets stuck. Only the full set completes it. At the rail-crossing stop, one of the failing runs also had the APC sandwiched between a picket fence (`prop.picket-fence:3374`, nose) and the parked school bus (tail contact). `tools/qa/diag/l9zerocontacts.ts` lists these contacts.

No infected stats were changed. Contact damage, hull attacks, boarders, the surround rule and the speed floor are unchanged.

## Before / after (native sim, `tools/qa/diag/l9apcpack.ts`, 30 s held input, floor APC at 0 HP)

The fixture is a ring pack of mixed infected around the hull: runner, dog, sprinter, screamer, zebra, brute, armored. Four to eight runner boarders are added on the flanks. "s1–s5" is the distance from the start after 1–5 s.

| case | before: 30 s / s1–s5 | after: 30 s / s1–s5 |
|---|---|---|
| fence spot, forward, 50 + 4 boarders | 3.6 m / 0.04 0.04 0.04 0.04 0.18 | 115.8 m / 0.04 0.04 0.04 **2.06 4.67** |
| fence spot, forward, 55 + 8 boarders | 3.3 m / … 1.51 0.96 | 7.0 m / … 1.91 **3.71** |
| fence spot yaw 1.6, forward, 30 + 6 | 1.7 m / … 0.24 0.30 | 7.0 m / … 1.71 **4.22** |
| fence spot, forward + full right lock | 2.3 m / … 0.02 0.15 | 21.9 m / … 1.87 **4.38** |
| fence spot, forward + full left lock | 5.5 m / … 0.42 0.57 | 14.2 m / … 2.05 **4.63** |
| fence spot, **reverse**, 50 + 4 | 98.0 m / 2.29 2.59 7.17 | 98.0 m (unchanged) |
| fence spot, reverse, 55 + 8 | 98.2 m / 0.58 2.39 7.85 | 98.7 m (unchanged) |
| open road (−267, −2, yaw 4.59), forward, 50 + 4 | 87.7 m / 0.27 2.78 9.2 | 87.8 m (unchanged) |
| open road, forward, 55 + 8 | 87.7 m | 87.8 m (unchanged) |
| r27 pile spot (−300, −330, yaw 0), forward, 50 + 4 | 250.9 m, 10.7 m/s | 250.9 m (unchanged) |
| r27 pile spot, forward, 55 + 8 | 257.0 m | 257.0 m (unchanged) |

Some "after" totals stay small (7 m) because the fixture holds forward with no steering, so the APC drives back into the same fence after each recovery. What matters is that it now breaks clear at 4–6 m/s within 4–5 s, every time. Reverse always worked: a player who reverses gets out in about 2 s, before and after the fix. Before the fix, holding forward never got out, because every auto-recovery was cancelled.

The game stays threatening. In the same runs the swarm keeps billing durability on every contact onset (the test asserts more than 10 hits in 6 s). Boarders still climb on: 4–8 attached in every run, and the "shake off" objective is unchanged. Heavies still stop a moving hull once per 4 s window: 1–3 `heavyStalls` per run after the fix.

## Test

`tests/engine/vehicles.test.ts` → `l9FloorApcPackAtFence`, folded into the existing "enter, drive and exit" case, so the case count is unchanged. It covers the QA pose, 50 mixed infected and 4 boarders, holding forward with steer 0 and with steer +1, for 6 s. It asserts:
- the APC gets ≥ 3 m from the start;
- it reaches ≥ 2 m/s;
- at least 4 boarders attach;
- more than 10 durability hits are billed.

On the old code it fails at 0.50 m.

## Checks (final code)

| check | result |
|---|---|
| `npm run typecheck`, `npm run lint` | pass |
| `npx vitest run tests/engine/vehicles.test.ts` | 2/2 pass. The new fence check fails on main at 0.50 m. |
| `npm run test:gate` | 27 files / 107 tests pass; budget 150/150 cases, 43 s |
| `l9-driving-proof --route road --tier low` | completed, 199.95 s (main 199.95 s) |
| `l9-driving-proof … --zero` | completed, **325.8 s** (main 439.5 s), 0 collision failures |
| `l9-driving-proof … --risky` | completed, 191.3 s |
| `l9-driving-proof --route countryside` | completed, 209.3 s |
| `threat-audit.ts --levels L9` | L9 skilled complete, 199.95 s; passive complete; 0 L9 flags. The baseline at 17:06 on main also had 0. The only flag is `PARTIAL_LEVEL_SELECTION`, which every single-level run raises (exit 1). |

## Not changed / follow-ups

- **Garden fences are solid to the APC.** `prop.privacy-fence` and `prop.picket-fence` are static decay colliders. The APC only smashes `walls` destructibles (fence, cone, barricade, …) at ≥ 5 m/s. A 6 t APC that stops dead at a garden fence reads oddly. Letting it plough through decay fences, as r27 already suggested for hedges, is a level and render change. It is out of scope here.
- The auto-recovery still needs the full 3 s (180 ticks) of no progress before it reverses. A human who reverses is out in about 2 s.

## Browser QA needed

- **L9, (−265.7, −15.4), nose south against the garden fence**, after the real L8 → L9 handover (r28-vqa `l8-board-high-z1-gl` route, tick around 6600–6800):
  - Settings: high, zoom 1, WebGL2.
  - Hold W (and separately W+D) with the swarm around the APC: within about 5 s it should reverse off the fence on its own and pull away.
  - Hold S: it should back out within about 2 s.
  - The swarm should still chip durability, and boarders should still climb on and need shaking off.
