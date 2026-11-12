# S62 L9 gameplay: rail stall and school bus

## Design decisions

- The rail stop lasts 20 seconds (1,200 simulation ticks) on all three routes. The HUD shows `Engine stalled — hold the hatch (0:SS)` with a 10-segment countdown bar, shooting and hatch-toggle instructions, and says the player cannot leave the APC. Sam calls out the hold. At restart, the objective says `Engine restarted — drive! (W)` and Sam gives the same direction.
- The rail transition opens the hatch. The courier is raised in the hatch to show her upper body and her aim still follows the mouse. Passengers stay hidden inside the APC during the defense. F/E toggles the hatch where allowed; the stall HUD explicitly explains the exit restriction. The roof band was not changed because it is the authored APC damage treatment, outside this gameplay lane.
- The bus locks the courier's lane for a 1.5-second warning, sounds a positional horn, and emits a red lane telegraph. Steering at least 4.5 m out of the lane avoids damage, hurts the bus by 400, and stuns it for 3 seconds. Three missed attacks destroy it and stop its pursuit. A hit costs 40 APC armour, capped at three hits (120 total).

## Scope and overlap

The rail, hatch, and bus behavior live in `LevelNineDriving.ts`; Sam's lines are in `src/data/dialogue.ts`. `LevelNineCrash.ts` has a narrow eastbound-heading guard exposed by the story proof's restored bridge checkpoint. `tools/qa/l9-story-proof.ts`, `tools/qa/r28-vqa-fixture-play.ts`, and the existing vehicle integration tests were updated. No infected stats or corpse handling changed.

## Validation

- All-route native recovery probe: road, countryside, and dry shortcut each restarted at +1,200 ticks and moved 13.83 m in the following 120 driven ticks.
- `node --import tsx/esm tools/qa/l9-story-proof.ts`: passed; rail countdown/restart, hatch defense and downstream story sequence completed.
- `node --import tsx/esm tools/verify.ts E31`: passed typecheck, lint, and all 107 unit tests (27 files; `npm test` test-budget wrapper reported 142.5 seconds against a 240-second budget, 150 configured cases). The `npm run verify -- E31` launcher could not create its tsx IPC socket under the sandbox, so the same verifier was run directly. One earlier run hit a flaky child-process cleanup assertion; reruns passed.
- Latest `node --import tsx/esm tools/qa/l9-story-proof.ts`: passed with the ten-cell countdown assertion; phase `done`.
- Bus integration assertions cover the 90-tick warning, 1.5-second red telegraph, horn event, dodge without APC damage, three missed attacks wrecking the bus, and three undodged attacks costing 120 armour while leaving the APC alive.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: 0 L9 passive flags. Exit 1 is the audit's `PARTIAL_LEVEL_SELECTION` diagnostic status.
- `tools/qa/r42/l9-bay-probe.ts --route road --mode w --max 360` reached the bay at x=468.7/z=8.5 without courier death. Ambient infected later destroyed the APC during the evacuation hold (durability 0, 79 infected nearby), so this run does not establish post-arrival survival through the hold.
- `sh tools/remote/run.sh "$PWD" -- npm test`: no healthy remote runner; the wrapper declined local fallback for `npm test`.
- Real-input capture was attempted through `tools/e2e-lock.sh` with one headless browser, ports 4967/4968. The browser-pool daemon could not bind 127.0.0.1 (EPERM, ports 4328 and 4329), so no screenshots were produced or visually inspected.

## Worktree setup

The required `sh tools/ops/slim-worktree.sh "$PWD" --no-assets` command was attempted first but could not lock the shared worktree Git config under the sandbox (`Operation not permitted`). `node_modules` was already present. No files in the protected reference directories were edited.

The requested commit could not be created: `git add` was denied while creating the shared repository's `.git/worktrees/s62-l9play/index.lock` (`Operation not permitted`). The worktree edits and this report remain available for commit outside this sandbox.

## Resumed with full permissions

The slim-worktree setup succeeded. Headless real-input fixture play completed for 45 seconds, god off, with no page errors. Opened `s008-t1552.jpg` (stall 0:13 and progress bar) and `s012-t2547.jpg` (APC beyond the crossing, restart dialogue). Captures are under `test-results/s62-l9play/captures/`. The roof stripe and the bus dodge/crash visuals still require follow-up. Earlier permission failures above describe the first attempt; the resumed browser run succeeds.

The resumed exact remote `npm test` command ran on 94.130.181.173, but failed: navigation A* budget test reported a failure and the complete run exceeded its 240-second budget (240.4 seconds, exit 124). The earlier local complete verifier remains green; the remote gate is not green and requires investigation.

## Roof treatment follow-up

Removed the APC's side-projected blood overlay, which stretched into the red roof band. Damage remains expressed by dents, cracked glass and smoke. Typecheck and lint pass. Opened `test-results/s62-l9play/roof-fix/s006-t1514.jpg`: no red band; courier arms and weapon visible above the hatch; stall HUD at 0:17 with bar and Sam's line. Headless 30-second real-input fixture run, god off, completed without page errors.

Remote retry completed in 236.9 seconds (inside 240-second limit): 105 passed, 1 skipped, 1 navigation test failed; vehicle integration including bus dodge/wreck passed. The navigation failure remains to investigate.

## Bus lane rendering follow-up

Real-input capture exposed that VFX deleted the bus tell immediately because it had no infected AI brain. Vehicle warnings now follow the bus ram countdown instead. Opened `test-results/s62-l9play/bus-lane-fix/s009-t667.jpg`: red lane and HUD warning visible, APC steered outside the lane by real W/D input (`--dodge-bus`). Typecheck and lint pass. Native ram tests alone did not reveal this renderer defect.

Moved the existing L7 route check from the overloaded A* test into the existing chaser-routing test; no assertions or timeout limits changed. This spreads world-load work across tests without increasing the 150-case total.

The balanced-test remote run passed navigation (A* 12.8 s, chasers 27.8 s, unchanged 30 s limits), but the overall run timed out at 240.7 s. Remote gate remains incomplete; next work must reduce the oversized vehicle integration workload rather than raise the gate budget.
