# r37-nightly: three failing nightly tests on main d7796292

Branch `worktree-agent-ab3e31e768735bca4`. Both tests run in 5-90 s on the Mac (`npx vitest run --project nightly <file> -t "<name>"`), so everything below was bisected and verified locally; the remote runner confirmed the neighbouring suites.

## 1. placement vs solids (fixed)
- Offenders: `L8 D-ZOO` crowd-fence 1771/1799/1800 x hedge 1743/1744.
- Cause: r33-l8route (bce764f0) added hedge H9 (14,3 -> 14,12) and, in the same block, the fixed primate-yard fence along x=14 (z 8..32) plus the z=8 fence. The last two hedge pieces (z 7.5..12) sit inside the new fence line.
- First attempt (shortening H9, then dropping pieces 1743/1744) broke `tests/engine/missions.test.ts` "interactions" (L8 flamingo: a follower left outside when the entry gate shuts): the two hedge pieces are part of the plaza flank wall, and without them the corgi's route changed. Shortening also shifted every later placement id by 2.
- Final fix (`layouts/D-ZOO/layout.py`): pieces 1743/1744 are dropped by id (as the existing dressing removal does, so no other id moves) and two identical hedge pieces are appended 0.9 m east (x=14.9, same z and scale), clear of the fence panels. Rebuilt `D-ZOO.layout.json` / `D-ZOO.base.glb` with `tools/layouts/build.ts D-ZOO --force`. Diff against main: placements 1743/1744 removed, two hedge placements appended, 0 changed placements, colliders: those two swapped, roads and surfaces identical. Baseline file untouched.
- Result: test green.

## 2. war-waves L4 high/low (root cause fixed, 2 singletons left on high)
- Bisect (`git bisect run` on a one-wave copy of the test, 5 s per step): first bad commit 4e5dec94 "balance(l4): use catalog heavy roles for horde pressure" (brute, armored, butcher joined the L4 arrival roster). 400bea93 and earlier were green, war-0 reached 48/48.
- Cause: heavies are wider (butcher/brute radius .6, armored .5) than the 1 m alleys that the L4 admission walk grid (clearance .35, `InfectedSystem.excludeInfected`) still offers a normal body (.35). A* routes them through such an alley; the capsule stops at the first wall and stands there, `alerted` with a scripted goal, for the rest of the wave. Evidence: the unreached bodies at HEAD were almost all heavies, standing 14-20 m from the goal at the same wall coordinates every wave (e.g. 9.77,-2.58 east of the camp); the nav clear-map around them showed a 1 m alley clear at r .3 and blocked at r .6. Later heavy thinning (907a2274) reduced but did not remove it (45/48 instead of 42/48).
- Not a test-expectation problem: authored counts spawn and are admitted (48/48); the bodies cannot walk. HEAD here is batch 77, so the batch 78 live-cap change is not involved.
- Fix:
  - `src/sim/ai/InfectedSystem.ts`: in L4 a second walk grid baked for wide bodies (`wideNav`, clearance .7, same blockers and forwarding as the admission grid) is used by `seek` for bodies with radius > .4 outside any district grid. The A* budget for those routes is at least 12000 (the wide detour is longer); 60000 gave no further gain.
  - `src/data/l4.ts`: the `southeast-end` mouth moved from z 41.2 to 43. At 41.2 it sat in a 1 m slot between the street wall (z 40.6) and a post at (32.4,41.6), where a brute wedged and the group behind it (hazmat, riot, firefighter) queued.
- Result: L4 low green; L4 high went from 3-19 unreached per wave to war-8 107/108 and war-9 107/108.
- Superseded: (below was the state before the final round) those two were a brute (-14.24,-19.25) and an armored (-14.75,-22.75) standing at the north jersey barrier, 4-7 m from the nearest guard, 0.35 m outside the test's 1.5 m goal band. They are a pile-up of big bodies at the wall, not a blocked route. Tolerance not touched. Needs a decision (measure centre distance minus radius, or accept) from the orchestrator.

## Other failures seen, not from this lane
- `tests/qa/invariants/waves.test.ts` (nightly census): L7 groups and L8 tunnel breaches spawn 0, high and low.
- `tests/engine/missions.test.ts` "interactions": L8 flamingo, a follower is left outside when the entry gate shuts (batch 77 r36-l8gates area).

## Checks
tsc and eslint clean on the changed TS files; infected-ai, l4-contact, director-pressure, navigation green on the remote runner. No browser used. The /tmp bisect worktree was removed.

## Final round (orchestrator request)
- Merged main (9abd94f8) first.
- Goal band: `tests/qa/invariants/war-waves.test.ts` now measures reach edge-to-goal: band = 1.5 + max(0, radius - 0.35); unchanged for normal bodies.
- Two more wide-body route fixes in `InfectedSystem.seek` (needed even with the wider band; war-2 and war-8 bodies stood in open ground 4-7 m from the barrier with an empty path): the goal cell of a wide body beside the barrier strip falls back to `nearestCell` without radius; if that cell is walled off, route to the nearest wide-walkable cell the body can reach (flood); wide searches are not skipped when the shared per-tick budget is spent.
- Results: war-waves L4 high and low green; content-invariants placement green; `tests/engine/missions.test.ts` 6/6; `npm test` remote 27 files / 106 tests green. Smoke (`E2E_PORT=4981 SCENE_PORT=4982 npm run test:smoke`): the first run's `@smoke` Playwright part passed 6/6 (crowd GPU limits webgpu+webgl, L1 handover, pedestrians drawn webgl+webgpu, unflagged WebGPU) but the cold build pushed the run over the 240 s budget. Two reruns failed at "Fixture browser timeout of 60000ms during setup" (shared browser pool contended by other lanes, infrastructure). The `@public-smoke` test on the public build fails: `pageerror asset.placeholder npc.civilian-man-a: THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures` plus the menu heading not visible; this is a texture-loader error in the public build, not related to the layout/nav change (not investigated on main). Smoke is therefore NOT confirmed green.
