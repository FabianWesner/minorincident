# Playtest harness: Q-151 / Q-128

**Complete:** one unattended real-input L1 → credits campaign passed on `lane/playtest-harness`. Changes are restricted to tooling, debug bots/API wiring and the `Game.driver` TypeScript union.

## Campaign proof

`harness-campaign-06`, runtime commit `6dc758170`, production build from `ef2c4598a` (documentation-only child), female courier, fresh campaign. One headless browser session under the shared lock, 20:04:56–20:52:26 CEST on 2026-10-23: **47 minutes 30 seconds**.

```sh
E2E_PORT=4371 SCENE_PORT=4372 npm run build
E2E_PORT=4371 SCENE_PORT=4372 PLAYTEST_BACKEND=webgpu npm run playtest -- --levels L1-L10 --quality low --zoom 1.5 --no-skip --out test-results/playtest/harness-campaign-06
```

**10/10 levels, all 50 mission steps completed, zero deaths, zero skipped steps, no harness hang.** WebGPU was verified; actual Low quality and target zoom 1.5 were asserted at every level's first playable frame. The final camera also remained at 1.5. No seeded save, god mode, objective cheat, bot control or manual intervention was used. Earlier-level map/navigation reads are logged; L10 has no hidden-state navigation assists.

| Level | Wall seconds | Completed steps | Deaths / skips |
| --- | ---: | ---: | ---: |
| L1 | 147 | 5/5 | 0 / 0 |
| L2 | 100 | 6/6 | 0 / 0 |
| L3 | 176 | 3/3 | 0 / 0 |
| L4 | 262 | 6/6 | 0 / 0 |
| L5 | 162 | 3/3 | 0 / 0 |
| L6 | 258 | 4/4 | 0 / 0 |
| L7 | 329 | 3/3 | 0 / 0 |
| L8 | 138 | 2/2 | 0 / 0 |
| L9 | 118 | 2/2 | 0 / 0 |
| L10 | 1145 | 16/16 | 0 / 0 |

The saved campaign has `completedLevels: 10` and `crossingHandover.applied: true`; L9's approach and crawl both completed. L10 has all 16 steps completed, `mega-dead`, `cure-released`, `epilogue-finished` and `credits-finished` true, and epilogue phase `done`. The drawn Mega's observed health fell from 3,000 through 2,700, 2,400, 2,100, 1,800, 900, 600 and 300 before the kill advanced the objective. L10 recorded 53 launcher attacks and 14 pistol attacks.

There were **10 P2 observations, zero P0/P1**: survivor navigation/boarding waits, a recovered L10 route obstruction, and an alert during the timed epilogue. L7's longest visible-progress wait was 88.7 seconds; L8 advanced after ordinary interaction recovery for its last passenger. The L6 clearance fallback did not trigger in this successful run; its blocked-ring behavior is covered by unit tests.

[Committed campaign evidence](evidence/campaign-06.json) includes all step statuses, actual settings, boss-health observations, issues, final flags and SHA-256 hashes of the raw artifacts in `test-results/playtest/harness-campaign-06/`.

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

## Validation and earlier attempts

The earlier uninterrupted `harness-campaign-04` completed through credits, but widened L9 to zoom 2; it is not the requested-settings proof. [Archived evidence](evidence/campaign-04.json). `harness-campaign-05` confirmed the zoom fix through L6, then stopped cleanly at its 90.5-second no-progress watchdog near the final retreat ring. A follower was crowded against the stationary courier; the driver now clears a stalled escort ring along its observed travel direction and retains that position so followers can pass. [Failed-attempt evidence](evidence/campaign-05.json). The final successful campaign-06 ran after the requested 20-minute browser-free window.

- Remote unit suite at runtime commit `6dc758170`: success, **2,050 passed, 0 failed, 7 skipped**. Compact results and all driver test assertions: [evidence/remote-unit.json](evidence/remote-unit.json).
- Production build, typecheck and lint passed; focused driver tests: 9 files, 57 tests passed.
- Real-input checkpoint diagnostic `harness-finale-08`: all 16 L10 steps completed through credits in 248 seconds, zero deaths, no skips; WebGPU and actual Low quality. This uses a seeded checkpoint and is not the campaign proof.
- Shared L7 sim bot, seed 1: completed in 540.38 simulation seconds; zero deaths, zero collision invariant failures.
- Shared L10 sim bot, seed 1: completed through credits in 1,190.08 simulation seconds; zero deaths, zero collision invariant failures.
- These sim runs and checkpoint-seeded diagnostics are not the requested uninterrupted real-input campaign proof.
