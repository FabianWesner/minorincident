# Playtest harness: Q-151 / Q-128

Campaign proof and final validation are still in progress. Changes are restricted to tooling, debug bots/API wiring and the `Game.driver` TypeScript union.

## Driver changes

- Closed/crashed pages and unresponsive observations stop with explicit errors; observation and browser-close waits have time limits. The finale credits transition is recognized only after the actual ending and saved campaign completion.
- `bot.start` supports L7–L10. L7/L10 reuse the sim-runner policies; L9 reports completion only after its real crawl. The real-input campaign driver does not invoke these bots.
- The campaign driver selects earned weapons through number keys. The finale prioritizes the drawn Mega Alpha, leads rockets from observed velocity, retreats with WASD while firing, and changes bearing when visible movement stalls. It activates the console with E and waits through the epilogue and credits.
- `mega` and the L9 crash/crawl cannot be debug-skipped. `--no-skip` stops on missing progress without completing an objective. Earlier-level map/navigation recovery remains logged and uses physical movement keys; L10 movement/combat decisions use visible markers, drawn enemies and the carried arsenal.
- The driver pins Low through the title settings UI and verifies the actual renderer/quality. It preserves zoom across handovers instead of repeating wheel input into the launcher's wider limit, and asserts the requested 1.5 target at every level start. Vehicle stalls use reverse/steering recovery through real keys.

## Controls triage candidate: Space retargets a ground movement command

Observed in **L10**, dispersal-console defence, **rocket launcher**, WebGPU, 1280 × 720, zoom target 1.5. The probe requested Low, but its older driver did not pin the menu's quality setting; its exact effective tier was not recorded. This is a game-controls observation discovered during driver development; this lane does not change the game rule or input system.

Reproduction setup: use the normal campaign finale with the launcher selected (number **7**), or prepare the diagnostic fixture with `tools/playtest/seed.ts <origin> <profile> female L10-default weapons cure-complex cure-install`, then resume L10 and activate the console. The fixture prepares the save; the following actions are real mouse/keyboard input.

1. Release WASD and any held mouse button.
2. Hold **Space** to attack with the selected launcher.
3. While keeping Space held, move the pointer to clear ground away from the approaching infected, press LMB for approximately 40 ms, then release LMB.
4. Still holding Space, move the pointer back toward an approaching infected to aim. Keep LMB released and do not press WASD.

**Expected:** the click keeps its chosen retreat destination while the pointer changes the attack aim, or the game cancels movement consistently and leaves the courier in place. Moving the pointer alone should not silently replace the already clicked destination with the enemy's position.

**Actual:** the courier changes its movement destination toward the current mouse aim point, following the pointer back toward the horde despite LMB being released. During the diagnostic this defeated the retreat and led to repeated deaths. Do not conflate the tested order with “ground click, then first press Space”: the driver deliberately held Space *before* the click because pressing it afterwards cancels navigation through the existing input-token path.

Evidence: `test-results/playtest/harness-finale-04/log-finale.jsonl`, notably the `visibleFinaleDodge` and `observation` entries around ticks 3000–3041. The attempted input sequence is preserved as `dodgeFireInput` in commit `a7870af62`; that strategy was removed from the driver after the observed failure. The relevant existing input paths are `src/input/InputSystem.ts` (`token` cancels movement on an attack-key press; `pointerGround === 'move' && frame.left.held` refreshes the destination from `frame.aimPoint`). Space contributes to `frame.left.held` even when LMB is released.

The driver uses WASD while firing for the replacement policy, with alternate movement bearings when observed courier movement stalls. No controls fix is included here.

## Validation so far

The uninterrupted `harness-campaign-04` run completed all ten levels through credits, every required step, zero deaths and no skips. It is archived in [evidence/campaign-04.json](evidence/campaign-04.json), including the boss health sequence and final flags. Its repeated wheel input widened L9 to zoom 2; it is not counted as the requested-settings proof. The zoom fix was confirmed through L6 in `harness-campaign-05`, which stopped after 90.5 seconds without progress at the final L6 retreat ring. The screenshot shows a follower crowded against the stationary courier; the driver now clears a stalled escort ring along its observed travel direction and retains that position so followers can pass. [Evidence for this failed attempt](evidence/campaign-05.json). A new full campaign proof is pending the shared browser window.

- Remote unit suite at runtime commit `6dc758170`: success, **2,050 passed, 0 failed, 7 skipped**. Compact results and all driver test assertions: [evidence/remote-unit.json](evidence/remote-unit.json).
- Typecheck and lint passed; focused driver tests: 9 files, 57 tests passed.
- Real-input checkpoint diagnostic `harness-finale-08`: all 16 L10 steps completed through credits in 248 seconds, zero deaths, no skips; WebGPU and actual Low quality. This uses a seeded checkpoint and is not the campaign proof.
- Shared L7 sim bot, seed 1: completed in 540.38 simulation seconds; zero deaths, zero collision invariant failures.
- Shared L10 sim bot, seed 1: completed through credits in 1,190.08 simulation seconds; zero deaths, zero collision invariant failures.
- These sim runs and checkpoint-seeded diagnostics are not the requested uninterrupted real-input campaign proof.
