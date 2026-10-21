# Lane l6-weapons-flow (2026-10-21): L6 with the campaign weapons

QA findings #87, #87b and #88 (po-bugs-1019.md). Every run is real input through `tools/playtest`, on WebGL2 at low quality and zoom 1.5. Weapons runs resume a save seeded from the `L6-default` preset through the game's campaign API (`tools/playtest/l6-weapons.sh`, `tools/playtest/seed.ts`). The rack is fire axe and bat on the left; army MG (auto-selected), handgun and kick on the right.

## Why guns were deadlier: mostly the driver

- **Driver aim.** With guns the driver aimed with Space plus mouse hover. Space fires along the facing cone (±35° assist), and in the dark tunnel it missed most of the time (69 enemy-unhittable events in #87b).
  - The PO clicks an infected with LMB. That click locks the target, and the game aims straight at it and keeps firing while the button is held. The sim bots use the same lock (`attackTarget`).
  - The driver now does the same: LMB on the infected and hold. Unhittable events went 13 (baseline) → 0 in fix-female.
- **Gun noise.** The MG's 30 m `outbreak.distraction` affects only L4/L5 alphas and L1, so in L6 it does nothing. The 40 m `noise` alerts idle or wandering infected only. Neither is the cause.
- **Sim difficulty.** The tests/levels L6 sims, where the bot fights with the same rack, stay green and inside their bands. L6 was not made harder, and nothing outside L6 changed.

## Game problems fixed (src/sim/missions/LevelSixSubway.ts)

1. **#87 checkpoints.** New checkpoints `gate-90`, `gate-150` and `gate-210` are taken when the walking column's healthy tail is through the gate. The courier respawns at the gate's wait spot with the group as it was. `abandon` still covers the shelter → first-gate leg.
2. **#88 ring.** The retreat ring stays within aheadM of the group's real head, not the scripted leader. The gate wait ring shows only while the column is at the gate. One survivor left far behind no longer pulls the ring back to a gate the group passed long ago (playtest: ring at (92.4,17.3) while the courier was at x 149).
3. **#88 reason flicker.** The held-group reason (`waitFor`) now uses the same 2 s dwell as `strayed` (#84).
4. **Split group.** When the group is split, the "Stay with the group" ring sits on a survivor, not in the empty gap between the halves. Playtest: "Stuck 121 s on 'Stay with the group · 0 m'".
5. **Survivor stuck in the side rooms.** A survivor who fled into the side rooms beside the tunnel mouth (x 30–40, z 20–30) stayed there for good, because the route back exceeded the route budget. The exit then never counted everyone out (male weapons run, exit skipped). An off-track survivor whose route is refused now walks to the tunnel mouth first.
6. **Straggler rejoin.** A collected straggler rejoins once inside the column, and the bring ring leads to the tail. The fists run with 22 survivors was stuck 7 min on "Bring the injured survivor back to the group · 0 m", because the column centre was more than 5 m from its tail.

## Real-input runs (L6, low, z1.5)

| Run | Build | Result |
|---|---|---|
| base-female (weapons) | main 56d7e7d16 | finished, no skip, 4 deaths, 617 s (QA's two runs on the same build: 2 and 7 skips) |
| fix-female (weapons) | fixes 1–4 | finished, no skip, 0 deaths, 361 s, 0 unhittable |
| fix-male (weapons) | fixes 1–4 | exit skipped: the survivor stuck in the side rooms → fix 5 |
| fix2-male (weapons) | all fixes | **finished, no skip, 2 deaths, 459 s** |
| fix2-female (weapons) | all fixes | **finished, no skip, 11 deaths, 869 s** |
| fix2-male-fists (L5→L6) | all fixes | see lane report |

## Captures (looked at; tools/qa/l6-weapons-flow-capture.ts)

- `webgl2-{high,low}-held-*`: the group is held at the tunnel mouth, and the scripted leader is already at gate 90.
  - The text reads "Cover the retreat through the tunnel · 10 m". The ring is 10 m ahead with the whole group beside the courier, at high/z1 and low/z1.5.
  - It was 40 m ahead at the gate before.
- `webgl2-{high,low}-respawn-*`: the courier died behind the gate after the group passed it.
  - She respawned on the gate wait spot at (92.4,17.3), with the corgi beside her and the group just beyond the gate.
  - The text reads "29/29 through · E to close the gate", and the arrow points on to the next ring.
  - Before, she respawned at the shelter (3,0).
