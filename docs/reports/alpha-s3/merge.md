# Alpha S3 merge into lane/alpha-s3

Merged `main` at `27756737` into `lane/alpha-s3` (previous head `c8c867d3`). Main's Alpha charge, ground slam, resistance, ordinary soldier knockdown and E26 damage/nav/debris behavior survive alongside S3's retained corpse/medium-prop grab and throw and regular-infected roar convergence. Engine wreck doors, the L5 shelf shotgun and metro shutter are included. The duplicate Alpha audio registration remains removed; Alpha ordinary telegraphs reuse the brute cue and support moves retain their own cues/captions.

## Conflict resolution

- Chase attempts valid support moves, then charge (up to 12 m) or slam (up to 4 m). One shared scheduler enforces per-move activation cooldowns of 8/10/12/15 seconds, locked telegraphs, one-hit tracking and recovery. Added four autonomous chase-selection tests and a browser test proving one Alpha activates all four moves.
- Support move selection checks cooldown readiness before line-of-sight/object/crowd scans, avoiding repeated unavailable-move work without changing activation timing.
- Charge/slam resolution runs only for those move ids. A cancelled no-object grab cannot fall through into the physical resolver with a deleted attack record.
- Damage and courier animation use one serialized `knockdown` record and `knockdownTicks`; throw uses 48 ticks, charge/slam use 72. Courier pose sampling uses those same timers. Throw's existing stagger assertions remain and now also check the actual courier knockdown record.
- Retained both lanes' crowd poses and telegraph rendering. Special audio cue lookup precedes the generic archetype fallback; charge/slam captions remain.
- Removed the duplicate automatically merged Scene Lab command branch; one handler supports every move and the retained-corpse fixture.
- Existing support repeat fixtures now put unrelated physical moves on cooldown, so a charge cannot interrupt a fixture intended to test repeat throws. No tests or assertions were deleted, skipped or weakened. The new selection test covers each move in the combined production chase path.

## Validation

- `npx tsc --noEmit`, `npm run typecheck`, `npm run lint`: pass.
- Full remote unit suite: **815/815 passed**, 160 files, both initially and after final source changes.
- Remote Alpha behavior sims: **48/48 passed** (`alpha.test.ts`: 30, physical: 10, support: 8), including all four chase selections, exact damage/knockdown, independent cooldowns, wall/target boundaries and checkpoint restoration.
- Broader `npm run verify -- E07` with remote sims: **220 passed, 2 failed**. Both failures are 200-infected timing budgets: scheduler 4.324 ms and actual physical moves 4.329 ms against 4 ms. All functional assertions pass. The gate stops before Playwright when a sim fails; browser checks were therefore run separately.
- Separate full E07 + smoke browser selection: **47 passed, 6 failed**, zero skipped. Every physical/support/combined move and health-bar test passed. Failures: three Alpha asset LOD probes expect an `inf.alpha` GLB batch but find no matching batch, two mixed Alpha asset probes expect six such instances but see zero, and L5 save/continue restores the mission's axe/bat left rack rather than the saved bat/kick/fists rack. All six failures reproduce unchanged on `main` at `27756737`, using the same temporary baseline worktree, a separate build/private port 3396 and one headless worker.
- Extra remote Alpha performance run (one worker): 52 passed / 2 failed; only the 200-infected physical/support p95 limits failed (4.200 / 4.602 ms against 4 ms). 100-infected budgets pass. Thresholds remain unchanged.
- Five Mac Scene Lab scenes: pass, including one scene with one Alpha using all four moves. Dedicated support/combined browser suite: **3/3 passed**.

Initial remote attempts on mi-runner-3 failed during workspace copying with `No space left on device`, before any tests ran. Retried on mi-runner-1 (`MI_RUNNER_IP=94.130.181.173`). No other lane’s runner jobs were removed. A stale inherited Git index lock was removed only from this job’s baseline sync cache after its manifest update failed. A single temporary baseline worktree at `/tmp/mi-alpha-s3-merge-baseline` was used. Its optional remote support timing comparison at `c8c867d3` remained queued for over ten minutes and was cancelled before tests started during cleanup; this report therefore does not claim the timing failures are pre-existing. The same worktree was then used to reproduce all six browser failures at `main` (`27756737`); it was removed after collecting that evidence.

## Scene Lab visual review

All scenes ran on the Mac through `tools/e2e-lock.sh`, one headless Chromium browser, WebGL2 via ANGLE Metal, private port 3393. All gates passed: zero console errors and zero undrawn frames; the support/combined scenes also have zero actor clipping hits. [Recorded gates](merge-captures/checks.json). Full-size individual PNGs and metrics remain under `test-results/alpha-s3-merge/`.

- [Charge sheet](merge-captures/qa-alpha-charge.jpg): yellow arrows form the locked swept path. The Alpha advances along it, the standing barricade becomes dashed debris at impact, and struck humans lie down. Its health bar remains above the head; the Alpha leaves the fixed camera crop near the end of the 12 m run.
- [Slam sheet](merge-captures/qa-alpha-ground-slam.jpg): a bright yellow circle surrounds the Alpha during windup, disappears on activation, then the courier and nearby human show knockdown/recovery poses. The outside human remains standing. Cyan generic direction cues can coexist with the authored yellow marker.
- [Grab/throw sheet](merge-captures/qa-alpha-grab-throw.jpg): the cyan throw corridor is visible during windup; the retained human corpse rises, travels toward the courier, and remains on the ground after impact. The long post-impact timeline also shows the newly merged charge and slam becoming available between support cooldowns.
- [Roar sheet](merge-captures/qa-alpha-roar.jpg): the wide camera keeps the nearby regular, outside regular and lion control visible. The nearby regular moves toward the fixed roar origin while the other actors retain separate paths. Wide framing makes body details small; the captures are evidence of convergence, while exact buff/radius/expiry boundaries are asserted in sims.
- [One Alpha, all four moves](merge-captures/all-specials.jpg): the same Alpha first charges along yellow arrows, then marks a slam circle, performs the retained-body throw, and emits the much larger cyan roar ring. The courier remains identifiable throughout; the body persists and a spawned regular converges. Reviewed the sheet plus full-size frames 378, 410 and 547. Normal AI is active between scripted requests, so cooldowns may make a requested attempt yield to an already running move; the browser test separately requires activation events for all four moves from this same entity, a throw event and an active roar buff.

The full E07/Definition-of-Done gate is **not green**: the remote timing limits and the six browser assertions above remain failures. The requested merge checks pass; timing performance needs further investigation, while the six browser failures are confirmed on main.

The fixtures establish merged gameplay and cue visibility; they do not claim completion of every reopened E07 zoo criterion or manual WebGPU verification. Specs and forbidden reference directories were not edited by the conflict-resolution work. Nothing was deployed or merged into main.
