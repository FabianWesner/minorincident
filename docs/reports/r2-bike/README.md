# r2-bike: L1 cargo-bike auto-mount and loop, keyboard corner slip

Lane r2-bike (Opus 5.5), 2026-11-07. It follows up the two player-feel bugs that r2-way found (docs/reports/r2-way/README.md, "Causes" 3).

## Causes
1. **Standing still mounts the bike (Bicycle.ts).** At the depot counter the courier stands 0.87 m from the parked bike's park spot. That is inside the 1.5 m mount range, and `armed` is already true because she walked more than 2 m from the bike to reach the counter. The stand-to-mount timer counted any stillness in range. Story beats reset it, but the hand-over scene ends with her still standing there, so the timer reached 0.4 s about 0.35 s after the story lock cleared.
   - Sim reproduction (complete-bot prefix to deliver active, then idle): mounted at tick 1172, three ticks after `storyLock` went null at 1169.
2. **Holding `sd` rides out and back.** Mounted, the keyboard is the PO's bike scheme (E19-AC16): W throttles, S brakes then reverses, A/D steer relative to the bike. Screen-relative `sd` is therefore S+D: full reverse with full right lock. Reverse targeted the full 7.5 m/s, so the bike ran a reverse circle about 6 m in radius, swinging some 10 m east and back on each 4 s hold. This is the HUD's 95/105 m alternation. The code worked as written; full-speed reverse was the defect.
3. **On foot, head-on blocks (KinematicController).** Rapier's character controller only slides along the tangential part of the motion. Straight into a face there is none, so she stopped dead.
   - The "lot corner" is the house-a lot's west fence panel: a 0.25 × 2.8 m box at x −25.5, z −38.49…−35.67. Her line from the depot (z −36.71) meets it 1.04 m south of its north end.
   - The lamp post is a 0.56 m box at (−23, −34) on the 2 m sidewalk.

## Fixes (commits)
- `8565673` fix(L1 bike):
  - Stand-to-mount needs an approach. A new optional `BicycleState.approached` is set when she moves while within mount range. It is cleared when she leaves range, during story beats, and on mount. The 0.4 s timer counts only stillness after such an approach.
  - Walking up to the bike and stopping still mounts it (spec E19 5.10: "stand-to-interact 0.4 s or E"). E is unchanged, and so is the bot (it presses E).
  - Keyboard reverse is capped at `bicycleHandling.reverseMs` = 1.8 m/s (backing a bike up at walking pace). Forward 7.5 m/s, braking and steering are unchanged. Mouse and touch never reverse.
- `bc0ff4a` fix(player): keyboard/joystick corner slip.
  - When a non-navigation move is blocked head-on by a fixed collider (progress below 35 % of intent, contact normal within 53° of the intent), she sidesteps perpendicular to her intent.
  - The sidestep needs capsule shape casts to show that the offset is reachable and that the 0.5 m ahead of it is clear. Offsets run 0.08 m to 1.44 m, nearer side first, ties to the side away from the contact.
  - The sidestep goes through a second character-controller pass, so solids still stop it.
  - Long walls never clear, so she still stops against them. A failed search is cached per pose, so a long push searches once.
  - Exclusions: off while riding (`SimWorld` sets `cornerSlip = !riding`); dynamic and kinematic bodies (crates, vehicles, bodies) never trigger it; navigation (click-to-move) is untouched. Crowd, companion and NPCs do not use this controller.
- Tests (folded into existing cases, 107 cases, under the cap):
  - `tests/engine/player.test.ts` "walls…; head-on corners slip": a post and a 2.8 m panel with her line 1.05 m inside are rounded, with no overlap (gap > −2 cm), and run speed on open ground is 4.5 m/s. A 12 m wall still stops her.
  - `tests/engine/vehicles.test.ts` "enter, drive and exit…; bike stand-to-mount needs an approach": idle beside the bike for 2 s does not mount; walking away, back and stopping mounts; E dismounts.
  - Both tests fail with the fixes reverted (checked).

## Before / after
- Sheet `after-depot-corner.jpg` (after only; r2-way's README has the before):
  - left: low tier, zoom 1, after 8 s idle at the counter beside the bike once the story beat ended. Not mounted; the "Stand here or press E to ride" prompt shows.
  - middle and right: high tier, zoom 1.5, holding `sd` at the house-a lot corner. She steps 1.3 m north onto the sidewalk past the corner and the lamp post, with no clipping into the fence or post.
  - The zoom-1 high frame (test-results only) shows her walking the sidewalk alongside the picket fence.
- Real-input route probe (`tools/playtest/route-probe.ts`, low, WebGL2): after the pickup, two 4 s waits (no mount), then `sd` holds: 107 → 90 → 73 → 56 → 41 m. r2-way's run stayed in the 95↔105 m bike loop for 6 turns.
- Sim, same `sd` line on foot: before, she stopped dead at x −25.98. After, she rounds to z −35.27 at x −25 and keeps walking east past the lamp post.
- Not covered: WebGPU frames, and frames with infected nearby.

## Luna screenshot-only trials (`tools/qa/r2-way-screen-run.mjs`, low)
- **L1-16 (after the depot pickup):**
  - 107 → 23 m in 6 turns (24 s game time), all `sd`, no mount. The bike loop (r2-way: 6+ turns at 95↔105 m) is gone.
  - New first loss: she overshoots the Annex. From turn 6 the edge arrow points down-left and then left, but she keeps pressing `sd` ("arrow points down-left … continue down-right"). She crosses the park east of the Annex and spends turns 17–29 (about 50 s) pushing `sd` into the map-edge rail at x 83, with the arrow on the left edge pointing left.
  - She then works back to 7–17 m around the Annex forecourt gate (turns 30–61, about 30 s of short steps) and does not deliver before the 10-minute lease ends.
  - Lost time after the depot: about 128 s of 152 s game time. That is Luna not following an arrow that changed direction (harness or prompt), plus the forecourt gate approach. It is not the bike or a solid.
- **L3-12 (from the fallback):**
  - 343 → 312 m in 3 turns, then about 50 turns at 312–351 m.
  - Replay through the route probe puts her at x −87.4, z 1–2. A static 4.1 × 10 m block (x −87…−83, z −5…5: the bus/barricade across the avenue) plus a parked car and the infected crowd stand head-on in front of her. The slip cannot clear a 10 m block, by design.
  - She never chose the sidewalk around it. This is the encounter/route question r2-way reported, unchanged by this lane.
- Both trials ended at "Input rejected 500" when the browser lease closed (10 min).

## Checks
- `npx tsc --noEmit`: pass. `npm run lint`: pass. `npm test`: 27 files / 107 tests pass.
  - `gate-tools` "FRESH" fails while L1 source is uncommitted; it passes after commit.
- `npm run qa:accept -- --level L1 --tier both --skip-browser`: 0 fresh failing rows, 12 incomplete (same as the r2-way baseline). Fixtures 16 clauses with 0 errors on both tiers; checkpoints PASS. The regenerated status and receipts were restored.
- `qa:threat --levels L1,L3` (remote runner, local load was about 8):
  - L1: skilled complete, passive complete, 0 passive flags.
  - L3: army line pass (2 of 3 seeds within), skilled complete, passive tick-budget, 0 passive flags.
  - The one "fail flag" is the not-measured row from filtering to two levels, as in r2-way.
- `npm run scene:gate`: 50/50 rows pass, 0 known, 0 not run (WebGL2 and WebGPU, low and high, 13.1 min).

## Next
1. L1-16: Luna ignores an edge arrow that turns from down-right to down-left or left near the Annex. Check `tools/qa/r2-way-screen-run.mjs` and the prompt (she writes the arrow's direction correctly and then presses the old key). Then check the forecourt gate approach (turns 30–61).
2. L3-12: the avenue block at x −85 (bus/barricade) with the horde in front of it. Decide whether the sidewalk bypass needs a cue or the block needs a gap.
3. The bike HUD could name the W/S/A/D bike controls on mount. Keyboard players who expect screen-relative keys still get tank steering by design (E19-AC16).
