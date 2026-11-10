# r28-l7l10: L7 boarding HUD, L10 respawn hitch, L9 roadside hedge

Lane r28-l7l10 (claude-sonnet-5-5), 2026-11-10, based on main 3ef8a77b. Raw probe output and the CPU profile are in the scratchpad `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r28-l7l10/` (`before/`, `after/`), not in git.

## 1. L7 boarding stall ("Waiting for Marcus · 3 m")

**Root cause.** Not a deadlock. `LevelSevenDeparture` stays in phase `waiting` until the courier is inside `boardRadius` (6 m) of the bus ring. In that phase `claims()` returns false, so the followers keep following the courier and nobody boards. But `boardingStatus()` had no phase check: it printed `Aboard 0/13 · Waiting for Marcus · 3 m` (the nearest un-boarded survivor, 3 m from the courier) and the HUD pin pointed at Marcus. A player was told to wait for someone who stood next to them, and was never told to walk to the bus. Once the phase is `boarding`, a straggler is already covered: `recover()` after `stallTicks` (20 s) makes it re-path, then step through, so a single straggler cannot hold the queue forever. Nothing to change there.

**Fix.** In phase `waiting` (with living followers) `boardingStatus()` now returns `Go to the bus to start boarding · N m` (N = metres to the edge of the ring) and a HUD target on the bus ring (`name: 'the bus'`, aria label "Find the bus"). From `boarding` on, the old "Waiting for <name> · N m" text is unchanged.

**Test.** `checkLowBoardingCorner` in `tests/helpers/l7Uat.ts` (runs inside the existing L7 navigation test, no new case): in `waiting` the status is the "Go to the bus" text with the bus as target; flipping to `boarding` gives "Waiting for …" again.

## 2. L10 respawn hitch (267-383 ms on every respawn)

**Probe.** `tools/perf/r28-respawn.ts` (one headless browser through `tools/e2e-lock.sh`, port 4883, no native-timing mode). It loads a level from the debug menu, kills the courier through `Player.damage`, and records every rAF delta plus sim/update/render ms around `player.respawned`. Usage: `R28_LEVEL=L10 R28_TIER=low R28_BACKEND=webgl2 R28_DEATHS=3 R28_PROFILE=1`.

**Root cause (sim, not render).** Before: low/WebGL2, 3 respawns: one frame of exactly 350 ms each (and 367 ms / 450 ms in the profiled run), 5 ticks after `player.respawned`. The per-frame sim/update/render counters stayed at 1-5 ms and node builds did not change, so it was not a render rebuild. A CDP CPU profile of that window: 333 of 390 ms in `NavGrid.intersects` under `setBlocker` ← `world.blocker.changed` listeners (`InfectedSystem`, `MegaPursuit`) ← `Destruction.reconcile` ← `Destruction.rebuild` ← `Mission.restore`. A checkpoint restore calls `Destruction.rebuild()`, which resets every destruction blocker to inactive and then lets `reconcile()` re-activate it. Each re-activation emitted `world.blocker.changed`, and the two AI nav grids (which never saw the unblock) re-baked the cells around every intact wall. L10 has hundreds of them: about 160 ms per grid.

**Fix.** `Destruction.rebuild(worldReset=false)` remembers each blocker's state before the reset, and `reconcile()` emits `world.blocker.changed` only when the state really changed since then. It also now announces `blocked: false` for a blocker that was active before the restore and is destroyed in the restored state (the old code left that wall blocked in the AI grids). A world reset (`rebuild(true)`) still announces everything, because the grids are rebuilt there.

| run | before | after |
|---|---|---|
| L10 low, WebGL2, 3 respawns | 350, 350, 350 ms | 33, 33, 33 ms |
| L10 high, WebGPU, 2 respawns | not measured before | 33, 33 ms (p95 16.7, max 33) |
| L9 low, WebGL2, 2 respawns | not measured before | 50, 33 ms (max 50) |
| L8 | not measured | not measured: see below |

The 233 ms max in the L10 low run is the first frame after load, not a respawn. L8: the harness page was gone after the load (`window.__SCENE__` undefined 4 s after resume), so no L8 respawn was measured. The restore path is the same shared one, but L8 is unverified.

## 3. L9 roadside hedge at (-325, -338)

**Cause.** The road turns at (-350, -330). `layouts/D-CROSSING/dress.py` `edge_framing` puts a hedge row at `hw + 1.9` from the lane centre (z = -337.9, 1.5 m beyond the lane edge), 2.3 m long with 3 m gaps: `prop.hedge:134-138`, x -337..-313. An APC that cuts or overshoots the corner meets that row with its nose.

**Fix.** `put()` in `dress.py` refuses the low verge walls (hedge, garden bush, small bush, picket and privacy fence) that lie within 5 m of the lane edge and within 44 m of the corner. Trees and everything farther out are untouched. No lane geometry or route moved, so there is no new shortcut. The RNG draws are unchanged (the guard comes after the yaw draw). Placement ids after the corner shift down by a few (the hedges are gone), and `D-CROSSING` was rebuilt with `npx tsx tools/layouts/build.ts D-CROSSING` (base, chunks, horizon, layout.json).

**Check.** `tools/qa/diag/l9solidsnear.ts -325 -338 14` lists only trees and one small bush behind (z <= -341); the hedges are gone. `tools/qa/diag/l9apcpile.ts --pile 0` (the fixture that drove into the verge at yaw 0.45 and stopped at the hedge): the APC now passes the old stop (-328, -335) at 7 m/s and stops 14 m further on at a tree at (-316, -341), because the fixture steers into the field and never follows the road.

## Checks run

- `tsc --noEmit`, eslint on the changed files: clean.
- Focused: `tests/engine/vehicles.test.ts`, `navigation.test.ts`, `missions.test.ts`, `world-systems.test.ts` on the remote runner (result in the lane report), then `npm run test:gate`.

## Browser QA needed

- L9, low and high, zoom 1 and 1.5: the road corner at (-350, -330) to (-310, -330), south verge. The verge should read as open grass with trees and bushes farther out, not as a bare strip or a gap that looks like a bug. Drive the APC (healthy and floor state) through the corner: it must not be caught. Check the horizon/chunk seam at x -340..-300.
- L7, high: walk away from the bus with survivors following; the HUD must read "Go to the bus to start boarding · N m" with the pin on the bus, and switch to "Waiting for <name>" only once the courier is in the ring. Check the pin does not overlap the objective line.
- L10 and L8, low and high: die 3 times at different points and confirm there is no visible hitch; checkpoint-restored destructible walls (fences, houses broken before the death) must still block or open the infected as before.
- Not captured: this lane took no screenshots (HUD text and a verge change only); the L9 verge needs a look by the QA lane.
