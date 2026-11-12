# L9 rail hatch soft lock and courier pose

## PO findings

The rail checkpoint could render the courier in the roof hatch while treating her as on foot. This split left the objective saying to drive without a usable driver seat. At the last bay, the PO could neither leave the APC nor drive, and the hold gave no clear end. After L9 proceeded, the courier appeared folded and twisted beside the corgi.

## Authored design decision

E31's authored final phase is a stationary hatch defense: stop at the evacuation point, cover the survivors while they board the trucks, then continue to the bridge. Keeping the APC occupied and braked during that hold is intentional. The missing piece was clear feedback and a completion cue. The objective now names hatch defense, shows a 30-second countdown and survivor boarding count, and changes to the bridge objective when the defense completes.

## Fix

- Keep active APC ownership and the courier's passenger relationship coherent while the hatch is closed or open. Hatch posing only applies while the APC is still active.
- Release scripted clip, knockdown, and attack layers through the player's shared on-foot pose reset on restore, vehicle exit, and the L9 crash ending. Handover also clears those layers and resets animation to idle at the current tick.
- Extend existing unit cases (without increasing the registered case count) for player restore, vehicle exit, crossing handover, checkpoint retry, hatch toggles across the stall, knockback, stall restart, and final-bay defense feedback.

## Native reproduction

Read-only source archives of `main` (`86ad0a8`) and PROD `c0f98c70` both reproduce the rail split after closing the hatch: checkpoint `mid-crossing`, an active APC driver link, `hatchOpen: false`, and no `passengerOf` link. Both also retain `scriptedClip: crawl`, a knockdown layer, and `animation: knockdown` through a simulated crossing handover. The archives were created under `/private/tmp`; neither ref was checked out or changed.

## Validation

The 18-route L9 progress regression completed all primary/detour × road/countryside/dry-shortcut × seeds 1–3 cases with exit 0 and no position jumps. The full threat audit completed: L9 skilled and passive each have 0 flags; the full audit has two unrelated L4-06 flags (first breach and sustained horde). Typecheck and lint pass. Focused player/vehicle/handover unit cases pass: 3 files, 11 tests; the test budget remains 150/150.

The local E31 verify wrapper did not pass: its normal tsx command could not create a temporary IPC socket under the sandbox, and direct node/tsx execution passed typecheck and lint but the full local unit stage exceeded its 240-second budget. The requested remote unit suite was attempted twice; both attempts found no healthy remote runner and exited before running tests.

The PO screenshots were opened. The two pose images show the courier folded down and twisted beside the upright corgi, with the close view clearly isolating the bad courier pose. The final-bay image shows the stopped APC among the infected, with smoke and the burning pickup behind it; the courier is visible in the roof hatch. The new high-zoom exit-path capture harness is `tools/qa/s84-l9-pose-captures.ts`, but both headless runs were stopped by the browser pool failing to start. No post-fix screenshots were produced. The HIGH real-input rail death/retry run remains outstanding for the same browser-pool reason.

The requested first separate commit was attempted after the pose regression passed, but the sandbox denied creating the Git worktree index lock (operation not permitted). Source edits and tests remain in this worktree; no commit was created.

## Full-access continuation

The pose fix was committed separately as `11338ebb`. Browser-pool access now works. The three HIGH/zoom-1.5 captures in `test-results/s84-l9hatchstuck/pose-exits/` were opened: the L10 courier stands upright beside the corgi, but the checkpoint hatch capture still shows legs extended across the roof despite idle sim state. This is unresolved visual evidence, so completion is not claimed. The ordinary exit capture is taken during its dismount transition and needs a settled follow-up frame. The remote unit suite now runs on 46.225.66.90; its final result will be recorded after completion.

The full remote suite on 46.225.66.90 ended at its unchanged 240-second watchdog (246 s observed, exit 124). No individual assertion failure was reported before timeout. The required unchanged rerun remains next, together with settled visual captures, the remaining rendered hatch-pose investigation, and the HIGH real-input stall death/retry run.

Settled capture rerun: the harness now advances 90 ticks before photographing. Opened HIGH/zoom-1.5 frames show the courier upright beside the sedan after dismount and correctly inside the APC hatch ring after restore. The earlier extended-leg image was the transition blend rather than a persistent pose. The seat ownership and defense feedback fix is committed separately from the pose fix. The unchanged remote-suite rerun is in progress.

Unchanged remote unit rerun PASS: 27 files, 106 passed / 1 skipped, 204.2 seconds within the 240-second budget; runner 46.225.66.90, exit 0. The repository budget remains 150/150. No cases or timeout were trimmed.

HIGH real-input qualification PASS in resumed segment `campaign-2`: controlled rail death tick 847, respawn tick 967, `evac-point` tick 3599, `bridge` tick 5399, `outskirts-approach` tick 7374; L9 completed with no skipped objectives in 142 wall seconds. The preceding 240-second segment repeatedly died and is retained as an unsuccessful attempt. No god mode was enabled. The driver used physical WASD/mouse; only fixture setup and the controlled lethal hit used the test API. Opened `campaign-2-L9-t963.jpg` (dead courier at the rails), `t3683.jpg` (living courier, visible “Hatch defense 29 s · 0/4 at the trucks”), and `t5494.jpg` (living courier with “Drive onto the bridge”). The respawn event records activeVehicle null before vehicle reconstruction finishes; subsequent physical driving and checkpoint arrivals prove the control recovery. Two P2 enemy-frozen observations remain in the playtest receipts; no P0/P1 was reported. Receipts and captures are under `test-results/s84-l9hatchstuck/real-input/`.
