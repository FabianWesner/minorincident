> Correction on resumed native inspection: the L4 courier has no civilian component. The earlier civilian-contact diagnosis and contact regression did not explain the shop scenario; that guard and regression have been removed. L4 remains unresolved pending an exact collision/attack trace. Earlier L4 claims below are superseded by this correction.

# s46-pockets — L4 shop hits and L8 zebra fence

## Findings and fixes

- **L4 cause:** the courier carries the civilian contact component in this scenario. `nativeCivilianContact` applied civilian grab/turn behavior to every eligible L4 civilian, including player id 1, intercepting the Brute/Riot hit. The player now bypasses that civilian-only path and takes the existing combat damage. No infected definitions or damage values changed.
- **L8 cause:** turned, dormant zebra arena actors orbited a shared center; while a tunnel carrier was turning the rest of the herd, each converted zebra chased a healthy herd mate. Engaged zebra staging could also remain aimed at the paddock fence after the courier left. Dormant zebras now walk to separated home points even while other herd members remain healthy. When an active zebra fight has no courier inside the authored enclosure zone, the staging lane and current move are cleared and the animals return to those points.

## Before and after

- Before, the supplied L4 screenshot showed the Brute telegraph among shop shelves and the courier still at 100 HP. The code path above explains why the contact was diverted into a grab instead of damage. The new native regression drives an L4 Brute against the courier with god mode off and asserts HP loss and no civilian grab. The standalone `tools/qa/r42/l4-pocket-probe.ts` is not valid evidence for the target spot as written: relocation to `(5.9,36.4)` returns false, and the probe turns god mode on.
- The L8 route regression turns a zebra while the courier is five metres outside the north gate, with the rest of the herd still healthy. It asserts the arena remains at phase 0, converted zebras settle away from both fences, and turned animals do not overlap. The route test then moves the courier inside and verifies the usual arena engagement and gate behavior.
- Threat audit: L4 **4** flags, L8 **0** flags, matching the supplied baseline. The L4 flags remain in the wider level threat criteria; this lane introduces no additional flag.

## Checks

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx vitest run tests/engine/l4-contact.test.ts tests/engine/missions.test.ts` — passed before the final L8 assertion was added; `npx vitest run tests/engine/missions.test.ts` — passed after it.
- `npm test` — passed, 107 tests in 27 files, within the 150-case budget.
- `npx vitest run --project nightly tests/qa/invariants/war-waves.test.ts` — passed, 2 tests.
- `node --import tsx tools/qa/threat-audit.ts --levels L4,L8` — L4 4 flags / L8 0 flags.
- The requested `sh tools/remote/run.sh "$PWD" -- npm test` could not dispatch: no healthy Hetzner runner was available and the wrapper does not admit `npm test` to its local fallback. The bounded local `npm test` command passed.

## Browser QA needed

The required headless real-input capture has not been run. `npm run build:qa` passed, but binding the preview server on port 4941 failed with `listen EPERM`; this sandbox cannot open the local listener. The required worktree slimming step also failed when Git attempted to write `.git/worktrees/s46-pockets/config.worktree` outside the writable worktree. No browser window was opened and no screenshot was added to the repository.

Open the cited S42 captures for reference:

- L4: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/s42-vqa/l4-pocket-threat/s006-t816-idle.jpg` — Brute telegraph inside the shop; courier HUD reads 100/100.
- L8: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/s42-vqa/l8-zebra-high-fight/s019-t6986.jpg` — zebra herd lined along the fence while the courier is outside the cluster.

## Delivery state

Committed as `bd2d8419` (`Fix L4 pocket hits and L8 zebra fence crowding`). No push, deploy, merge, main-branch edit, stat edit, or corpse removal was performed.

## Exact shop collision trace (resumed)

At `(5.9,36.4)`, native ground height is `0.3574`. The shop's compound collider includes a thin wall centered at `(4.975,36.78)` with half extents `(3.0775,0.0375)`, plus a counter at `(4.97,35.84255)` with half extents `(0.5,0.93755)` and nearby shelving at `(6.58725,33.88)` with half extents `(0.33775,2.125)`. The requested courier center is only 0.3425 m from the thin wall's near face, explaining why capsule admission rejects the exact point. This is direct geometry evidence; attack resolution and whether the reference capture used a forced placement remain to be traced.

The capture used `missionControls.teleport`, which samples the shop floor and permits a 1.5 m projection. Reproducing that API places the courier at `(5.89655,36.38879)`, y `1.0774`; the earlier probe incorrectly reused the start height. With the correct pose, checkpoint and normal pressure, the native 10 s reproduction stays at 100 HP. Brute repeatedly attacks from z approximately 34.0, while Riot stops at `(7.7754,36.3875)`. The supplied probe now uses the same checkpoint/teleport, disables god mode, presses both enemies and logs HP. The zero-damage defect is reproduced; no L4 gameplay fix is yet proven.
