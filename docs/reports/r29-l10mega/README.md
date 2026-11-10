# r29-l10mega: the Mega never came to the console

Finding (r28-vqa, P2): after the 60 s console charge, "Kill the Mega Alpha" ran 7 minutes with no Mega on screen and no direction.

## Root cause
Not a nav or phase-gate problem. The `l10-dispersal-console` fixture (a live-save resume, `Mission.loadResume`) stored the Mega with
`combat.staggerUntil` = 52880, an absolute tick of the old clock. A resume restarts the clock at 0 and `Mission.restore` rebased
infected/vehicle/light timers but not `combat.staggerUntil` or status timers, so the Mega stayed stunned until tick 52880 (14 min
of game time). It stood 26 m away at `mode=detailed`, `stuck=0`, never moving, so it was never on screen. With `staggerUntil`
zeroed in the probe it reaches the courier in 2 s. The objective also had no pointer: the `mega` step has no authored waypoint, and
`markerAnchor` deliberately returned null for the legacy `cure-mega` marker.

## Fix
- `src/sim/missions/Mission.ts` `restore`: rebase `combat.staggerUntil` and status `expires`/`nextDot` by the checkpoint delta for
  all entities except the player (remaining time preserved, negative delta on a resume).
- `src/sim/ai/MegaPursuit.ts` `tick`: defensive clamp. A stagger remainder over 600 ticks (nothing authored exceeds 3 s) is a stale clock; keep 1 s.
- `src/sim/missions/markerAnchor.ts`: while the L10 `mega` step is active and the Mega is alive, the marker anchor is the live Mega
  position. Hud tracker distance, minimap pin, edge arrow (MissionUI) and the world ring follow it.
- `tools/qa/r29-l10mega-probe.ts` (native probe), `tests/helpers/l10MegaResume.ts` (called from the existing missions interaction test; the test budget of 150 forbids a new case).

## Numbers (native, `node --import tsx/esm tools/qa/r29-l10mega-probe.ts <seed> 100`, god courier walking to the console and holding E)
| | before | after |
|---|---|---|
| Mega within 15 m of the courier (from fixture load) | never (stunned, 26 m away for 240 s) | 2.1 s |
| Mega distance at charge complete (62.3 s) | 26 m | 4 m |
| Mega objective guide | none | live position (4.8, -25.6 vs console 4002,-27) |

Seeds 1, 2, 3 identical (deterministic fixture). Time from charge-complete to Mega within 15 m is 0 s: it arrives during the charge and fights at the complex.

## Browser (one headless Chrome, high / zoom 1 / WebGL2, port 4893, preview stopped afterwards)
- Run 1 (`run1`, god, follow marker, hold E): charge 60/60 at tick 3822, "Kill the Mega Alpha", the Mega is on screen from the start of the charge
  (`s003-t976.jpg`: huge Alpha behind the console), killed by tick ~5968, then "Release the cure". No page errors.
- Run 3 (`run3`, setup moves the Mega 85 m west when the step starts, to force the far case): tracker reads "Kill the Mega Alpha · 83 m" counting
  down to 42 m, the minimap shows the objective pin at its edge, and the edge arrow (orange, top left) points at it (`s021-t3929.jpg` at 72 m, `s022-t4115.jpg` at 42 m).
  Note: the edge arrow clamps to the top margin and sits over the portrait panel, as other objective arrows do (existing behaviour, not changed).
- Captures are in the lane scratchpad `r29-l10mega/` (not in git).

## Checks
- `npx tsc --noEmit`, eslint on touched files: clean.
- `npm run test:gate`: 27 files / 107 tests passed, test budget 150/150.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L10`: skilled complete, passive tick-budget, 0 passive flags (the one flag in the README is the unmeasured L8-04 row because only L10 was run; no L10 flag).
- missions.test.ts (with the new L10 resume check): pass.

## Browser QA needed
None open. Another resume with a Mega staggered at capture (fresh save at `cure-disperse-ready`) is the same code path.
