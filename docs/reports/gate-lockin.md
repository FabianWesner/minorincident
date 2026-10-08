# Yard gate lock-in fix

## Cause and change

`Interactables.update` marked a door/gate cycle completed and only rearmed it after the
courier left the interaction radius. A small enclosure could prevent that exit; another
E or middle-click press did nothing. The presentation also hid completed gates' prompts.

Instant doors, gates and car doors now rearm on a fresh explicit press, even while the
courier remains within reach. Holding input and standing still after completion do not
repeat the toggle. Prompts remain visible and say whether the next press opens or closes.
The existing centered radius already covers both faces; collision, navigation, key/item
requirements, barricades and infected sight blocking retain their existing rules.

## Audit (main ce617101)

| Level | Gate | World X/Z | Location | Player toggle |
| --- | --- | --- | --- | --- |
| L1, L2 | gate-1 | -20 / 13.5 | r1c2n rear yard / alley | Yes, `prop.yard-gate` |
| L1, L2 | gate-2 | -10 / -17 | r0c2n rear yard / alley | Yes, `prop.yard-gate` |
| L1, L2 | gate-3 | 41 / 13.5 | r1c3n rear yard / east alley | Yes, `prop.yard-gate` |
| L1 | fire-shutter | fire-bay-door anchor | Final fire station containment beat | Mission controlled |
| L2 | l2-door-front, l2-door-loading | Market anchors | Rescue supermarket openings | Mission controlled |
| L2 | l2-gate-main, l2-gate-north, l2-gate-south | Checkpoint anchors | Police bridge checkpoint | Mission controlled |
| L3 | perimeter | camp-entry anchor | Civic camp escort ending | Mission controlled |

No player-toggleable gates exist in L3. The mission-controlled openings are distinct
from player interactables and preserve their story behavior. Building kit doors open
by actor proximity rather than player close/open interaction.

The brief names `src/levels/continuity.ts` and `src/sim/progression/carryover.ts`; neither
exists on this main revision. Tests exercise the equivalent restored state: closed,
completed gate components, with collision/nav rebuilt, reopened from either face.

## Regression coverage

- Per gate/door/car-door type: close on one face, spawn on the other, reopen, walk through;
  repeat in reverse. Assert held input never repeats and collider/nav unblock immediately.
- Sweep all six L1/L2 gate instances with closed blockers. Find a walkable interaction cell
  on both faces, flood from the adjacent approach, and exercise close/reopen from both sides.
  Closed gates still block infected sight; open gates clear it.
- Real keyboard and middle-click browser checks verify repeated toggles on both faces and
  the visible open/close prompt.
- Scene Lab: `docs/scenes/gate-lockin.json` copies the shipped gate anchor, closes/reopens
  on each face and walks through twice. The small Scene Lab additions copy selected anchors
  with crop recentering and send a one-tick courier interact press.

## Validation

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `E2E_PORT=3359 sh tools/e2e-lock.sh npx playwright test tests/e2e/interact.spec.ts --project=chromium --workers=2` | PASS: 4 tests |
| `npm run scene -- docs/scenes/gate-lockin.json` | PASS: 250 frames; screenshots reviewed |
| `SIM_WAIT=60 sh tools/sim-lock.sh npx vitest run tests/sim/interact/gate-lockin.test.ts tests/sim/interact/devices.test.ts tests/sim/l1-toys.test.ts --maxWorkers=2` | PASS: 30 tests |
| `sh tools/sim-lock.sh npx vitest run tests/unit --maxWorkers=2` | PASS: 354 tests in 100 files |
| Level/infected selection below | PASS: 5 tests; 32 unrelated tests skipped |
| `E2E_PORT=3359 SIM_WAIT=60 npm run test:smoke` | PASS: 6 sim tests, 25 browser tests |

Level/infected selection:

```sh
SIM_WAIT=60 sh tools/sim-lock.sh npx vitest run tests/levels/L1.test.ts tests/levels/L2.test.ts tests/sim/interact/infected-integration.test.ts --maxWorkers=2 -t 'T-E19-01 |T-E20-01 |T-E20-12b |@E11'
```

Logs: `test-results/gate-lockin/logs/`.

Scene Lab: zero console errors, zero clipping pairs/hits, zero undrawn courier frames;
15 maximum draw calls (limit 30). Five 1280×720 screenshots show the gate closed/open
on both faces and the courier returning through the aperture. Evidence:
`test-results/scenes/gate-lockin/shot-{0025,0060,0150,0185,0250}.png` and `metrics.json`.

Worker limit is 2, following the crash recovery instruction (stricter than the brief's
unit limit of 3). All requested checks passed. The level selection covers L1/L2 mission
graph completion, the L2 two-route layout, dynamic infected navigation blockers and the
real infected alarm response; broad 20-seed batteries were excluded to keep this bug lane lean.

No known outstanding issues in this fix. The unavailable carryover implementation cannot
be integration-tested on this main revision; restored closed gate state is covered directly.

## Scope and recovery

No specification edits, dependencies, push, deploy or merge into main.
Scene JSON lives under `docs/scenes` to respect the restriction on editing `specs`.
The crash had removed the checkout registration and all source/test/tool files. The lane
branch had no previous implementation commit. The checkout was restored, then fast-forwarded
to main. The only surviving tracked difference was a police sedan model; it is preserved
outside this checkout in `../gate-lockin-crash-backup/public/assets/models/veh.police-sedan.glb`
and excluded from this fix.
