# r43-l9loop: L9 bay evacuation fails forward (2026-11-11, Sonnet)

Branch `lane/r43-l9loop` (from main 9f51dd60).

## Finding (r42-l9pin, verbatim)
"In the W-only seed 1 run, the passive courier at the open hatch dies about every 23 s. Each death reloads the evacuation checkpoint and restarts the 30 s hold, so the run never finishes (12 deaths in 480 s)."

## Cause
`Mission.restore('evac-point')` puts the L9 driving state back to the checkpoint snapshot, where `evacuationAt` is the moment the APC stopped. The reload rebases it to "now", so the hold (`defendTicks` 30 s) and the survivor wait (45 s / cap 90 s) start over, and the survivors who had already reached the trucks are seated in the APC again. A courier who dies every ~23 s never gets the hold to 30 s.

## Change (`src/sim/missions/LevelNineDriving.ts`)
- New transient fields (not in the snapshot, so a reload does not rewind them): `evacDeaths`, `evacProgress`, `evacSaved`.
- `evacuate()` tracks the furthest hold progress and the survivors that reached the trucks.
- `restore()`: a reload while the evacuation is open counts as a death.
  - 1st death: progress is dropped (the hold starts over, as before).
  - From the 2nd death on: `evacuationAt` is moved back by the progress, so hold timer and wait carry over. The survivors who were already at the trucks are put back there (out of the APC, hidden in the truck, counted in `evacuated`) by `keepSaved()` on the next tick.
- Survivors still waiting are released on schedule because the wait is measured from the carried `evacuationAt` (door clear, 45 s with <= 2 infected within 8 m, 90 s cap, courier at or below half health: all unchanged).
- Counters reset when the evacuation is done or a reload happens with no open evacuation.
- No infected stat changed, nothing removed, corpses untouched.

## Verification
Probe `tools/qa/r42/l9-bay-probe.ts --seed 1 --mode w --switch-x -1000 --max 480` (W-only marker driver, passive courier at the hatch, APC stops at 457.3,-1.7):

| | courier deaths | result |
|---|---|---|
| before (main) | 12 | `end: timeout` at 480 s, level not finished |
| after | 5 | phase `approach` (level finished), doneTick 19804, 0/4 saved (fail-forward) |

5-seed matrix (`tools/qa/r42/l9-bay-matrix.sh`, saved/4 per seed), against the final row of `docs/reports/r42-l9pin/README.md`:

| Driver | r42 final | now |
|---|---|---|
| intended | 4 1 4 3 4 | 4 1 4 3 4 |
| marker-hud | 0 1 1 1 4 | 0 1 1 1 4 |
| marker-w | x 2 0 0 0 | 0 2 0 0 0 (seed 1 now finishes) |
| west-edge | 4 4 4 4 4 | 4 4 4 4 4 |
| pile50 | 4 3 0 1 4 | 4 3 0 1 4 |

Not worse anywhere; all 25 runs end in `approach` (finished). Courier deaths over all 25 runs: 7 (5 in marker-w seed 1).

Test (budget unchanged, folded into `tests/engine/missions.test.ts`): `checkL9EvacFailForward` in `tests/helpers/r39Markers.ts` reopens the evacuation on the `l9-at-bridge` fixture and reloads `evac-point` three times after 12 s runs: the 1st reload restarts the hold (< 5 ticks), the 2nd keeps >= 12 s, the 3rd >= 24 s.

Checks:
- `npx tsc --noEmit`, eslint on the two files: clean.
- `tests/engine/missions.test.ts`: 6/6.
- `npm test` remote: see the last section.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: L9 skilled and passive complete. **2 L9 flags, `STUCK_CHASER_OVER_30_SECONDS`** (passive route, step/approach and phase/driving; five infected, ids 919 925 934 920 922, within 6 m of the passive courier standing still 30 s). The same 2 flags appear with the unchanged main file, so they come from the new r42-arenas STUCK_CHASER check, not from this lane (a passive courier at the bay with chasers standing at the hull). Not fixed here (scope).

## Browser QA needed
- L9, passive courier at the open hatch (do not shoot, W only), low and high, zoom 1.5: after the 2nd death at the bay the "Cover the survivors" counter keeps its x/y at the trucks and the HUD hold finishes; survivors already at the trucks do not reappear in the APC.
- Check that the respawn after the 2nd death does not show survivors popping from the APC to the truck (they are placed hidden in the truck).
