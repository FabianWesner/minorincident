# E19 — M1 level lane

The Level 1 slice now stages the diner outbreak as one infected entering from outside the camera, biting three existing customers, and growing into a group that notices and chases the survivor. Wheel/pinch zoom, rack selection, truthful short-lived messaging, a subtle current-target ring and small fading building tags address M1-05, M1-09 and M1-10.

Worktree `lane/m1-level` started from main `960c215`; main was merged once (already up to date). Restart recovery saved WIP commit `45079a0`. No later segments, features or assets were added.

## Behavior and ownership

`LevelOneOutbreak` uses E08's grabbed → bitten → down/convulse → rising/red-eyes → infected lifecycle. Victim IDs and release state live in mission checkpoints; transformations preserve position and clothing. Incident actors remain in migration/attack presentation during staging, target their victim while held, then spend one second alerted before chasing. The incident's existing 0.2 damage multiplier remains. Leaving early ends unfinished staging cleanly.

One fresh diner entrant starts strictly outside the expanded frustum. Store enemies start in the store/back-door region at clear, separated positions outside the expanded frustum or fully hidden by building walls. Spawn tests cover all eight corners of a human silhouette; systemic director spawns use the same offscreen test. The slice cap stays at 15. Visible customer transformations are explicitly distinguished from fresh population spawns.

The mission supplies animation hooks through existing civilian state/eyes/turned events and infected attack state, victim target and combat flag. This lane does not change animation clips, rigs, NPC movement algorithms or assets; the animation and world lanes own those. Existing clips make collapse and rise visible in this isolated worktree, but bite model overlap/crowding and the baseline white/cyan combat hit flash still need integrated review with their fixes.

Wheel and two-finger world pinch smoothly change camera distance within 0.85–1.35× default, retaining the isometric angle and follow. Reset restores the unchanged E02-AC02 default. 1/2/3 select LEFT slots; Shift+1/2/3 select RIGHT; Q cycles the last-used side; HUD clicks cycle their side. Touch upward swipes remain. Shift and number keys are reserved for selection, including old saved Shift bindings. Controls/help text reflects these bindings.

The escape objective directs players toward a better weapon without denying fists/kick. L1 subtitle/toast/prompt deadlines are at most 180 simulation ticks (3 seconds). Desktop prompts sit below the companion HUD. The red overhead damage disc is hidden in the slice; only the current attack target gets a thin 0.5 m ground ring. All building name tags use the same small camera-facing sprite (1.8×0.36 m), near entrances, with a two-second hold and one-second fade.

## Specification corrections

M1-05 explicitly authorizes changes to game concept §5.3 and E02/E03 criteria. The specs record the **orchestrator decision**, wheel/pinch zoom, rack bindings, unchanged default framing and portrait-width measurement at default zoom. Reserved keys are stated consistently with rebinding behavior.

M1-10 explicitly authorizes E19 segment 2 and spawn rules; segment 3 now identifies the store/back-door entrance. E19-AC04 was wrong on main: the earlier milestone fix already enabled fists/kick during the incident, while the criterion still prohibited damage before pickup. It now describes the empty morning, incident fists/kick, chosen hardware weapon and truthful ≤3-second hints, matching the requested M1-09 gameplay. Full campaign segments 4–6 remain deferred.

## Validation

- `npm run typecheck` and `npm run lint`: pass.
- `npm run test:unit -- --maxWorkers=2`: 138 tests in 53 files pass.
- Input regression browser suite: 30 tests pass, including wheel/pinch, number/Shift slots, Q/HUD cycling, target ring and persisted rebinding.
- Director/frustum regression: 2 targeted tests pass.
- `E2E_PORT=3345 npm run test:smoke`: 3 simulation and 22 browser tests pass.
- `E2E_PORT=3345 npm run verify -- E19`: 20 simulation and 30 browser tests pass, including 17 slice tests, 20/20 evade-only seeds, 20/20 completion seeds, checkpoint staging/weapon restore, and hidden store spawns at desktop/portrait near/far zoom.

Actual production-build L1 routes start through menus and finish with zero deaths using mouse input or emulated iPhone touch. They exercise movement, hardware selection/interact and fists/kick/bat combat; state APIs only pause/advance time, read/project and prepare captures on these routes. Stage assertions require grabbed, bitten, down and rising, three turn events and four infected. UI assertions cover truthful objective text and expiration of toast/subtitle/prompt (the full HUD suppresses the legacy objective toast, so its deadline is checked through the hidden property), fading house tags, tag dimensions and absence of the overhead damage disc.

All browsers were headless, serialized through `tools/e2e-lock.sh`, capped at two workers, with Metal WebGL2 flags on macOS. Tests used private port 3345. iPhone is emulated, not a physical-device measurement; WebGPU was not checked. Native M1 Max GPU results and final check exit codes are retained in the lane evidence. Desktop 1600×900 and iPhone portrait 390×844 captures were inspected at the game camera and deleted afterward as requested.
