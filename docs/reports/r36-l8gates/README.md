# r36-l8gates: L8 gate escape, gate panels over the courier, breach containment, objective flicker, stuck callout (Opus)

Base: main 93016109. Findings from docs/reports/r35-vqa/README.md (L8 sections), quoted there.

## P1: "the courier ends up outside the closed exit gate while the gorilla is still alive"

**Root cause (proven).** A closed L8 gate is a sim barrier only (`SolidRegistry.setBarrier`): it is not a Rapier collider and
not combat cover. `SimWorld.knockback` moved the courier with `combat.query.clearDistance` (combat cover) plus the Rapier
character controller, so neither saw the gate, and `SolidRegistry.commit` validated only the end pose. Any one-tick shove
longer than ~1.25 m (barrier 0.54 m + 2 x 0.35 m capsule) lands her clear on the far side and is accepted. One-tick player
shoves in the game: infected charge 3.2 m (`InfectedSystem` special `charge`), zebra kick / elephant swipe / Alpha
shield-bash 3 m, Alpha grab-throw 6 m, blasts 0.8-1.8 m. A second path: when her pose is not clear and the previous pose is
not clear either (a solid landing on her), the commit falls back to `find()`, whose nearest-free-spot ring search has no
path check when the anchor is inside a solid, so it can pick the far side of the gate.

Repro (native, l8-before-gorilla, courier pressed against the gorilla exit at (81.38, z)): `tools/qa/r36/gate-squeeze-probe.ts`
on main: `knockback3 z -30 to 84.38 THROUGH` (all three z). `tools/qa/r36/gate-escape-probe.ts` (walk in, press the gate, fire
at the gorilla for 200 s) logged every courier jump > 0.3 m: all came from thrown props (the gorilla's grab-throw crate,
`blocker:1429244757`) landing on her and the 30-tick prop navigation update projecting her out; in that run they all went
away from the gate. Which shove moved her in the r35 run cannot be recovered (no tick trace), but every path that can
cross the gate is now closed.

**Fix (general, all barriers and all shove sources, no coordinates):**
- `SimWorld.knockback` (courier): the displacement is also swept against every static solid (`solids.sweep`, bodies off),
  which includes sim barriers, nav solids and hulls.
- `SolidRegistry.crossesBarrier(a, b)`: segment vs the drawn core of every active barrier (a body already inside a gate
  that shut on it may leave either way).
  - `commit`: the courier never crosses a barrier between two committed poses (input, shoves, carried motion; scripted
    moves use relocate/admit and are unaffected); a correction (projection, Rapier step) is rejected when it crosses one;
  - `find`: when the anchor is not clear (no connected sweep), candidates across a barrier are rejected;
  - swept pushes (charges, stampede side-shed) do not relocate a body across a barrier, the charger stops instead.
  - `barrierHolds` counts holds for diagnostics.
- Infected/NPC knockback already slides on the nav grid, which carries the barrier as a blocker (verified in the test).

**Test** (inside the existing courier case of tests/engine/collision.test.ts, the suite is at the 150-case cap): a 0.5 m
sim gate, courier at the face; one-tick 3 m knockback, 6 m Alpha throw, a crate appearing on her, the nearest-spot
fallback, and an infected shoved 3.2 m. On main: knockback 14.36, alpha-throw 17.12, nearest-spot 12.85 (all past the
gate at x 12); with the fix all hold (< 11.75).

**Real play** (QA build, headless, real input, high WebGL2 zoom 1, god, the r35 route
`60,12;60,0;60,-8;60,-30;82,-32;96,-32;...`): the courier pressed against the closed gorilla exit at x 81.4 from tick 933
to ~8100 (~2 min) with the gorilla 1.2-2.8 m away and grab-throws landing; max x over the whole 300 s run 81.4, the fight
still open at the end (`Defeat Gorilla ... Phase 1`). Native probe after the fix: every case `held`.

## P2: "L8 gate panels are drawn through the courier"

**Measured:** the drawn panels are not misaligned. Rods are 0.18 m thick on the barrier's centre line (barrier 0.5 m +
0.021 m contact tolerance), the courier's centre stops 0.62 m from it, so the rods are ~0.18 m outside her capsule. What
the captures show is the 2.8 m lattice standing between the camera and her: drawn over her body.
**Fix:** `L8Gates.courierOccluded()` (ray from the camera to her chest and head against every shown panel) feeds the
existing "behind a vehicle hull" path in GameView: she draws in the foreground slice with the gold contour, as behind a
truck (vqa-3 P1 rule). No new material, no shader rebuild (uniform switch).
**Captures** (looked at): gorilla exit high WebGL2 z1 `$R/gorilla-high-z1-gl/s010-t3751.jpg`: courier in front of the
rods with the gold contour, gorilla behind the lattice; lion exit low WebGPU z1.5 `$R/lion-low-z15-gpu/s024-t7354.jpg`:
same, courier at (-59, -12.6) pressed against the gate, held for the whole 40 s.

## P2: "L8 breach: the courier and some civilians can run far out of the plaza during 'Protect the group'"

**Design call (recorded here, orchestrator to log in po-decisions):** the opening fight is held in the plaza, without new
walls.
- The 30 s "Protect the group!" hold counts only while the courier is within 4 m of the plaza cell; away from it the hold
  (and the two hatch bursts, and the 75 s straggler window of the seal) pauses and the objective reads
  "Back to the plaza! The group is under attack" (marker already rings the plaza).
- The group keeps following her (corgi, Reyes, civilians). Tried and reverted: civilians within 20 m of the plaza hold a
  ring there while she is away. The hatches are inside the cell, so a group held there alone faces both hatch cohorts
  without her (in the run below even the group standing beside a stuck, bat-only courier was killed by them). The pause
  makes the plaza the only place the hold progresses, so the group comes back with her.
- Seal: unchanged. Infected inside the sealed plaza come from the two service hatches inside the cell (r33 design: "The two
  service hatches make the breach a real fight"); the hold now ends with the courier at the plaza instead of 40-100 m
  away, so the kited tail no longer arrives with her at the seal.

Test: tests/helpers/l8Route.ts (in the existing interactions case): courier 40 m from the plaza for 32 s -> still
protecting, objective "Back to the plaza ..."; back at the plaza edge the hold runs out and the doors shut once the group
is inside.

Real input (level start, high WebGPU zoom 1.5, god, bat; build with the intermediate plaza-hold, the pause logic is the
shipped one): the driver pinned itself at (14.7, 12.8), 1.8 m outside the 4 m grace band, when the alarm went; the tracker read
"Back to the plaza! The group is under attack" from tick 7203 to 13361 (`$R/breach-high-z15-gpu/s022-t7993.jpg`,
`s027-t9819.jpg`); once the driver stepped into the plaza at tick 13388 it read "Protect the group!" and the fight ran in
the plaza ring (`s041-t14907.jpg`). No "Rest at the plaza" text during the tour (tracker "Follow Nadia ..." throughout).

## P3

- "Rest at the plaza with the group" flicker during Nadia's tour: `l8SanctuaryResting` now needs the tour to be over
  (`guideDone` != 0); her route crosses the plaza ring on the way to the lion. Test: tests/helpers/l8BossShoot.ts asserts no
  rest cue while she leads, then the cue once she has arrived.
- "They're inside!" bubble on screen for minutes: the bubble itself hides after 1.2 s; five rifle guards re-armed it every
  2.2 s (global callout gap). `allyCallout.sameLineS = 30`: the same line from anyone at most every 30 s (stamps from a
  previous level's tick range are ignored).

## Validation
- `npx tsc --noEmit` clean; eslint on all touched files clean.
- `npm test` on the remote runner: 27 files, 106 passed, 1 skipped, 169 s (budget 240 s), 150/150 cases.
- tests/engine/collision.test.ts courier case fails on main (3 of 5 shoves through the gate), passes with the fix.
- Real input: `$R` = `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r36/`
  (raw captures, not in git).

## Browser QA needed / open
- The gorilla/lion x-ray was checked at high WebGL2 z1 and low WebGPU z1.5; not at zoom 0.5.
- Monkey and zebra arena gates use the same code path but were not played (no fixtures).
- Thin nav-solid fences (picket fences) are not covered by the commit/find barrier guard, only by the courier knockback
  sweep; a projection out of a solid that lands on her next to such a fence could still cross it (not seen).
- perf pending: `courierOccluded` is 2 rays x ~20 boxes per frame on L8 only.
