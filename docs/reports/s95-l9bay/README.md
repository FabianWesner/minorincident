# S95 L9 final bay — survivor boarding recovery

## Finding

S94 recorded a HIGH z1 run stuck at `Defense complete · 3/4 at the trucks` for 139.13 s. The native L9 evacuation loop marked a survivor as entering the truck and stopped issuing movement while the 45-tick sit-down animation played. If combat or a body push moved that survivor at least 1.2 m from the truck before the animation finished, the distance check could no longer complete, while the stale `truckEntering` timestamp kept movement disabled. That left the living survivor permanently outside the truck and held the objective at 3/4. The regression identifies **Mia**, the fourth non-Sam evacuee in the default roster, as the survivor in this failure setup.

## Fix

When an evacuee with an active boarding timestamp is no longer within 1.2 m of the selected truck spot, L9 clears the timestamp and the sit-down story clip. Normal native navigation resumes, and the survivor can approach and board again. The objective count, zombie stats, and corpse lifetime are unchanged; no teleport or removal is used.

## Native regression

`tests/engine/vehicles.test.ts` extends the existing vehicle test with a deterministic final-bay regression for seed 1 / LOW and seed 42 / HIGH. It stages three survivors already at the trucks and the fourth survivor displaced 1.5 m during the boarding dwell, after defense completion. The HIGH run also kills the courier at the evacuation checkpoint and verifies the checkpoint restore before staging the displaced evacuee. Both runs require the fourth survivor to board within 1,200 simulation ticks (20 seconds).

Focused command:

```sh
npx vitest run tests/engine/vehicles.test.ts --maxWorkers=1 --configLoader runner -t 'enter, drive and exit'
```

Result: **passed** (2 seed/tier cases; one includes a player death and evacuation checkpoint restore). The regression was also checked against the old behavior: removing the stale-timestamp reset fails at seed 1 / LOW with the survivor still at 3/4 after 1,200 ticks.

## Required checks

- Focused regression: **PASS**, 2 seed/tier cases. The seed 42 / HIGH case includes a player death and evacuation checkpoint restore.
- `npm run typecheck`: **PASS**.
- `npm run lint`: **PASS**.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: both L9 skilled and passive routes completed with zero passive flags. The command exits 1 for `PARTIAL_LEVEL_SELECTION` because this is the requested L9-only diagnostic, so it is not a clean global gate.
- `sh tools/remote/run.sh "$PWD" -- npm test`: **PASS** on unchanged retry, runner `46.225.66.90`: 27 files, 106 passed, one existing skip, 150/150 inventory cases, 226.3 s / 240 s. The preceding run on `94.130.181.173` timed out at 245.1 s; no tests were trimmed. The regression is folded into the existing vehicle case to preserve the inventory limit.

## Browser QA needed

No browser was used for this fix. Headless browser QA should confirm the final-bay HUD advances from 3/4 to 4/4 after a survivor is knocked or pushed away during the sit-down animation, and that the driver can still use the documented L9 controls while the survivor retries. The native regression establishes the simulation rule; it does not verify rendered HUD timing or presentation.
