# E19 — Milestone 1 fix round

The segment 1–3 slice now keeps the survivor on loaded ground, restores the incident checkpoint after death, and lets an unarmed player fight with fists and kick during the incident. Worktree `lane/m1-fix` started from main `6ca262b`; main was merged once (already up to date). No later level segments or additional features were implemented.

## Changes

L1 already preloaded D-RES, D-MAIN and D-SHOP before gameplay; the browser route now asserts their presence at spawn. The missing safeguards were ground-edge colliders and backdrop terrain. Exterior district slab edges now get invisible Rapier colliders, including the missing-district corner; shared seams remain open. Tier changes rebuild these colliders. Ground-click destinations clamp to the baked walkable nav grid. A grass plane beyond the camera's far range covers scenery outside the town.

Escape now creates a checkpoint after the diner encounter starts. Restoring it keeps breakfast completed, escape active, fists/kick equipped, and four live incident runners. Retaining a chosen hardware weapon applies only to the melee checkpoint after pickup, so fists cannot accidentally complete the pickup objective during restore.

Morning remains an empty loadout. At the incident, LEFT becomes fists and RIGHT kick, using the existing action definitions and hit/kill pipeline. Incident actors get a 0.2 damage multiplier (2 HP per accepted hit instead of 10); store enemies retain normal damage. The real browser idle test survived 66.18 seconds before a deliberate death and restored escape correctly. Fists kill a runner within 11 seconds using LMB/RMB; bat and kick hits are verified during store combat.

“Your House” uses a 1.5 m camera-facing floating label rather than the 4 m building banner.

## Validation

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test:unit` | 136 tests / 52 files PASS |
| Targeted slice + district simulation | 14 tests PASS |
| `E2E_PORT=3341 npm run verify -- E19` | 15 sim + 30 browser checks PASS |
| `E2E_PORT=3341 npm run test:smoke` | 3 sim + 22 browser checks PASS |

Simulation coverage includes 20/20 evade-only and 20/20 slice completion seeds, outer/missing-district edge movement before/after decay, off-ground/blocked click target clamping, unarmed kills, 25-second idle survival, and checkpoint restores for all three hardware weapons.

The production-build browser routes start through menus, walk by real ground clicks or touch stick gestures, select the bat through the UI, interact with F or ACTION, attack live infected with LMB/RMB or touch buttons, and reach the end screen with zero deaths. The test API only pauses/advances time, reads state, projects coordinates and prepares screenshots; it does not inject movement/combat or teleport along these routes. Sky-colour pixels in the lower half of the isometric viewport and survivor ground height are checked along each route. The separate idle/respawn test uses real clicks and normal AI damage.

All browser automation was headless, serialized through `tools/e2e-lock.sh`, capped at two workers, on port 3341 with Metal WebGL2 (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`). Touch is emulated, not physical-device evidence. Metrics are in `summary.json`, `*-perf.json`, `*-pixels.json`, `checks.json` and `vitest.json`. Screenshots were inspected and are deleted after the final checks at the user's request.

One initial portrait run reached the end but caught a transient `inf.flamingo.glb` 404. The file exists in production output; a standalone rerun and the complete final E19 verification were clean. An initial edge-test route hit a house; it was corrected to use the open west road.

## Scope / specification note

No specs were edited. The explicit owner request for incident fists/kick overrides E19-AC04's older no-hit-before-pickup behavior for this slice. The morning still starts empty; the new incident checkpoint supplements the originally specified checkpoints. Full L1 segments 4–6 and their bot balance, Patient Zero, twist, permanent unlock, and prop tutorial remain outside this fix round.
