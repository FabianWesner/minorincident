# r37-nightly: three failing nightly tests on main d7796292

Branch `worktree-agent-ab3e31e768735bca4`. Both tests run in 5-90 s on the Mac (`npx vitest run --project nightly <file> -t "<name>"`), so everything below was bisected and verified locally; the remote runner confirmed the neighbouring suites.

## 1. placement vs solids (fixed)
- Offenders: `L8 D-ZOO` crowd-fence 1771/1799/1800 x hedge 1743/1744.
- Cause: r33-l8route (bce764f0) added hedge H9 (14,3 -> 14,12) and, in the same block, the fixed primate-yard fence along x=14 (z 8..32) plus the z=8 fence. The last two hedge pieces (z 7.5..12) sit inside the new fence line.
- Fix (`layouts/D-ZOO/layout.py`): H9 now ends at z=7.5 (the fence replaces the old z 8..12 stretch). `D-ZOO.layout.json` and `D-ZOO.base.glb` rebuilt with `tools/layouts/build.ts D-ZOO --force`. No code references placement ids (checked); the baseline file is untouched.
- Result: test green.

## 2. war-waves L4 high/low (root cause fixed, 2 singletons left on high)
- Bisect (`git bisect run` on a one-wave copy of the test, 5 s per step): first bad commit 4e5dec94 "balance(l4): use catalog heavy roles for horde pressure" (brute, armored, butcher joined the L4 arrival roster). 400bea93 and earlier were green, war-0 reached 48/48.
- Cause: heavies are wider (butcher/brute radius .6, armored .5) than the 1 m alleys that the L4 admission walk grid (clearance .35, `InfectedSystem.excludeInfected`) still offers a normal body (.35). A* routes them through such an alley; the capsule stops at the first wall and stands there, `alerted` with a scripted goal, for the rest of the wave. Evidence: the unreached bodies at HEAD were almost all heavies, standing 14-20 m from the goal at the same wall coordinates every wave (e.g. 9.77,-2.58 east of the camp); the nav clear-map around them showed a 1 m alley clear at r .3 and blocked at r .6. Later heavy thinning (907a2274) reduced but did not remove it (45/48 instead of 42/48).
- Not a test-expectation problem: authored counts spawn and are admitted (48/48); the bodies cannot walk. HEAD here is batch 77, so the batch 78 live-cap change is not involved.
- Fix:
  - `src/sim/ai/InfectedSystem.ts`: in L4 a second walk grid baked for wide bodies (`wideNav`, clearance .7, same blockers and forwarding as the admission grid) is used by `seek` for bodies with radius > .4 outside any district grid. The A* budget for those routes is at least 12000 (the wide detour is longer); 60000 gave no further gain.
  - `src/data/l4.ts`: the `southeast-end` mouth moved from z 41.2 to 43. At 41.2 it sat in a 1 m slot between the street wall (z 40.6) and a post at (32.4,41.6), where a brute wedged and the group behind it (hazmat, riot, firefighter) queued.
- Result: L4 low green; L4 high went from 3-19 unreached per wave to war-8 107/108 and war-9 107/108.
- Open: those two are a brute (-14.24,-19.25) and an armored (-14.75,-22.75) standing at the north jersey barrier, 4-7 m from the nearest guard, 0.35 m outside the test's 1.5 m goal band. They are a pile-up of big bodies at the wall, not a blocked route. Tolerance not touched. Needs a decision (measure centre distance minus radius, or accept) from the orchestrator.

## Other failures seen, not from this lane
- `tests/qa/invariants/waves.test.ts` (nightly census): L7 groups and L8 tunnel breaches spawn 0, high and low.
- `tests/engine/missions.test.ts` "interactions": L8 flamingo, a follower is left outside when the entry gate shuts (batch 77 r36-l8gates area).

## Checks
tsc and eslint clean on the changed TS files; infected-ai, l4-contact, director-pressure, navigation green on the remote runner. No browser used. The /tmp bisect worktree was removed.
