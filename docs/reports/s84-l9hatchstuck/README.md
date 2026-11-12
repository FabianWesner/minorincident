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

The PO screenshots were opened: the courier was folded beside an upright corgi, and the evacuation image showed her in the APC roof hatch amid the crowd and smoke.

## Rendered evidence

The HIGH/zoom-1.5 captures in `test-results/s84-l9hatchstuck/pose-exits/` were opened after 90 settling ticks. `01-vehicle-exit-high-z1.5.png` shows the courier upright beside the sedan; `02-checkpoint-restore-high-z1.5.png` shows her correctly inside the APC hatch ring with the active vehicle and passenger links both 667; `03-l9-to-l10-handover-high-z1.5.png` shows her upright beside the corgi on the L10 road. The L10 image uses the committed-handover preset; the actual handover and crawl-ending state resets are separately asserted by unit tests. Initial screenshots taken during transition blending were superseded by the settled frames.

## Commits and gates

- `11338ebb`: courier pose reset, committed first and separately.
- `d6cf80da`: hatch ownership and defense objective progress.
- `480ed155`: validation harness and report.

Earlier sandbox-only commit/browser attempts and one remote timeout were resolved after full access became available. E31 verification PASS on remote runner 46.225.66.90: typecheck, lint, and full unit stage all exited 0; unit stage 210.7 s, 27 files, 106 passed / 1 skipped.

Unchanged remote unit rerun PASS: 27 files, 106 passed / 1 skipped, 204.2 seconds within the 240-second budget; runner 46.225.66.90, exit 0. The repository budget remains 150/150. No cases or timeout were trimmed.

HIGH real-input qualification PASS in resumed segment `campaign-2`: controlled rail death tick 847, respawn tick 967, `evac-point` tick 3599, `bridge` tick 5399, `outskirts-approach` tick 7374; L9 completed with no skipped objectives in 142 wall seconds. The preceding 240-second segment repeatedly died and is retained as an unsuccessful attempt. No god mode was enabled. The driver used physical WASD/mouse; only fixture setup and the controlled lethal hit used the test API. Opened `campaign-2-L9-t963.jpg` (dead courier at the rails), `t3683.jpg` (living courier, visible “Hatch defense 29 s · 0/4 at the trucks”), and `t5494.jpg` (living courier with “Drive onto the bridge”). The respawn event records activeVehicle null before vehicle reconstruction finishes; subsequent physical driving and checkpoint arrivals prove the control recovery. Two P2 enemy-frozen observations remain in the playtest receipts; no P0/P1 was reported. Receipts and captures are under `test-results/s84-l9hatchstuck/real-input/`.

Final capture audit: attempts to jump the live L9 world directly to the crawl ending were rejected by the production campaign-save validator. Those attempted harness edits were reverted. The existing settled L10 preset capture and actual handover unit test remain valid, but a rendered capture through the actual transition is still outstanding; completion is not claimed on that evidence.
