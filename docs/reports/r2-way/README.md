# r2-way: route readability (L1-16, L3-12)

Lane r2-way (Opus 5.5), 2026-11-07, time box 2.5 h. The rows are not closed. The lane found the causes, fixed the harness errors, closed one L1 decoy and identified the next blocker in L1 (a cargo-bike loop).

## How it was played
- `tools/playtest/route-probe.ts` (new): one headless session played by real WASD input in step mode, after a native prefix (L1: depot pickup; L3: the actual fallback). After each action it saves a frame and returns the HUD objective, the edge-arrow direction and, for the analyst only, the courier position. All frames are low tier, WebGL2, 1280×720 (`test-results/r2-way/`, not committed).
- Luna's final-a input sequences (from the committed ledgers) were replayed through the probe to locate her loops. I also played both stretches myself, following the edge arrow.
- Fresh Luna screenshot-only trials used `tools/qa/r2-way-screen-run.mjs`. This is the final-a protocol (sweep-a3) with the legend fix below and an L1 depot-pickup prefix.

## Causes
1. **Harness: key-mapping errors (both rows).** The screen-edge arrow and the camera are correct. Luna pressed the wrong keys:
   - L3-12: turns 4–12 are `wd` (up-right = map north) every time, each described as "diagonally down-right". The final-a fix65 prompt even shows `"move":"wd"` as its example.
   - L1-16: she pressed `d` (minimap upper-right) for a target to the minimap's right, which should be `sd`.
   - `tools/playtest/luna-player-prompt.md` says "east/right = D", which is wrong for a camera that looks north-west.
   - A replay of her L3 inputs ends where the review says she was stuck: at the station block's north-east corner, on the fenced lawn strip across the cross street from the HARDWARE block. Pushing east there is blocked by the infected crowd in the cross street, and god mode keeps her alive among them.
   - Played with the correct key (`sd` from the fallback), Commerce Street leads east. I reached x −87, where the next horde body-blocks an immortal courier. That is encounter density, not a level dead end.
2. **L1: decoy back lane (level).** The north side street beside the depot (x −30) runs to the map-edge excavator. On its west kerb it opened into the back lane behind Main Row and the depot, a cul-de-sac. Luna's final-a "bakery/ambulance/depot facade/fence/excavator" loop is that pocket. Her fresh trial with the old geometry ended in the same pocket (turns 14–16, 123 m, frame `screen-L1-low-harness/.frames/turn-000016-action.jpg`): she was on the bike between the bins and the courier van's tail, pressing `sd`.
3. **L1: cargo-bike loop (game, still open).** After the native pickup the first turn is a wait for the story panel. Standing still beside the parked bike mounts it (stand-to-mount, "Stand here or press E to ride").
   - With the correct key (`sd`), the bike rides east from the depot to the corner of the house-a lot across the side street (x −25.5). It then comes back to the depot's east side on the next 4 s hold. The HUD alternates 95 m / 105 m for 6 turns in both fresh trials, before and after the fence.
   - On foot, the same arrow line stops dead at that lot corner (fence 561 plus the house-a wall at z −36.5), then at the lamp post at x −23 on the 2 m sidewalk. Keyboard movement does not slide off an axis-aligned box hit head-on.
   - This is now the first thing that eats L1 time. I did not get to its cause in the bicycle steering (`Bicycle.ts`: heading steers toward input; something sends the bike back about 10 m per hold).

## Changes (commits)
- `a53ce02` fix(playtest):
  - `tools/qa/r2-way-screen-run.mjs` (copy of sweep-a3, which stays unchanged for older receipts) names the key for every screen and minimap direction ("an arrow pointing down-right means sd, never wd"). These are control facts, not route hints.
  - `--l1-pickup-prefix` in `tools/playtest/live.ts` (native complete InputFrames through the depot pickup) lets the 10-minute lease cover depot → Annex → garage.
  - `luna-player-prompt.md`: wrong east = D mapping fixed.
  - New `tools/playtest/route-probe.ts`.
- `fd91693` fix(L1): three `prop.privacy-fence` panels on the side street's west kerb (x −34.6, z −50.3…−43.05, up to the depot's rear corner) close the back lane's east mouth, so the public street is the only way on from the depot. Edge entry `edge-in-2` (in the side street) and the street itself are untouched. L2 builds its own D-GROVE twin, so it is unaffected.

## Before / after
- Sheet: `docs/reports/r2-way/before-after-l1-backlane.jpg`. Low tier, zoom 1, same spot on the depot's east side, from the two Luna trials: the side street is open into the back lane (before) and the new fence panels close the mouth (after). The panels stand on the kerb with no float or gap visible at this framing.
- Not done: high tier, zoom 1.5, WebGPU. The time box ran out.
- Luna trial before the fence (legend fixed): turns 2–12 all `sd` (the correct key). Bike loop 95↔105 m, then she drifted west into the back lane (turn 14, 124 m) and stayed there.
- Luna trial after the fence: the same bike loop 95↔105 m for turns 3–6. I stopped it at that point to run the checks, so this round has no lost-time number for the after state.

## Checks
- `npx tsc --noEmit`: pass. `npm run lint`: pass. `npm test`: 27 files / 107 tests pass (49 s).
- `npm run qa:accept -- --level L1 --tier both --skip-browser`: 0 fresh failing rows, 12 incomplete; fixtures 16 clauses with 0 errors on both tiers; checkpoints PASS.
- `npm run qa:accept -- --level L3 --tier both --skip-browser`: 1 fresh failing row, L3-08 (median live infected within 30 m). It was already FAIL in the base status, and this lane changed no L3 code.
- I restored the regenerated `docs/qa/acceptance-status.md` and `docs/reports/fix51-verify/*` so the diff stays focused.
- `qa:threat`, full suite on the remote runner: hit the 600 s budget during L3, after reporting 1 L4 flag. This lane changes no L4 code.
- `npm run qa:threat -- --levels L1,L3` (local, load < 6): both levels have 0 flags.
  - L1: skilled complete, passive complete. L3: skilled complete, passive tick-budget.
  - The receipt's single "fail flag" is L8-04 "not measured", which comes from filtering to two levels.
  - The full 10-level qa:threat still needs a run in the orchestrator's post-merge gate.
- `npm run scene:gate`: 50/50 rows pass, 0 known, 0 not run (WebGL2 and WebGPU, low and high, 8.2 min).

## Next (follow-up lane)
1. Bicycle: find why `sd` held against the lot corner sends the bike back to the depot. Then either let the rider slide off a head-on box hit or keep the bike from looping. Re-run `tools/qa/r2-way-screen-run.mjs L1 low` and time the lost windows.
2. Optional level fix for walkers: give the depot apron line (z −36.7) a clear run east. One option is a kerb nudge at the house-a corner. Another is a small corner-slip for the keyboard courier: on a head-on block by a box narrower than about 0.6 m, sidestep along the face.
3. L3: re-run `r2-way-screen-run.mjs L3 low`. With `sd` she should take Commerce Street. If she is then body-blocked by the horde at x ≈ −87 under god mode, that is a harness/encounter question, not route readability.
