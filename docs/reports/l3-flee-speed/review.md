# L3 fleeing — seed 1

The real keyboard/mouse Boulevard escape meets the requested five-death limit. Regular L3 infected have a 4.0 m/s ceiling during chase, bite approach and lunges. One in twenty successful L3 human emergences uses the sprinter archetype; rejected requests and recycled pool entries cannot increase that share. Turned civilians and police retain their appearance. These rules are selected by the L3 scenario.

Segment 2 moves 100 authored residents from Boulevard to Commerce. The population planner keeps 600 residents on high and 315 on low, with replenishment through the existing queues and the 200/100 concurrent caps. Boulevard retains 50% of its former high population and 52.4% on low. The station streams, police gun damage and finale encounter counts retain the PO tuning.

| Measurement | Before (`5214d309`) | After |
| --- | ---: | ---: |
| Real-input Boulevard deaths | 23 | **5** |
| Real-input Boulevard completion time | 966.1 s | 404.1 s |
| Real-input Boulevard damage received | 2885.5 HP | 942.2 HP |
| Living officers rescued in Boulevard run | 9 | 9 |
| Newbie deaths | 2 | **1** |
| Newbie completion time (unchanged limit: 270 s) | 366.4 s — fails | 452.2 s — fails |
| Complete-bot completion time (unchanged limit: 405 s) | 524.9 s — fails | 433.7 s — fails |
| Idle police standing after 75 s, T-E21-07d | 0 / 10 — passes | 0 / 10 — passes |
| First station wave emergence span | 17.35 s | 17.35 s |
| Police zombies recorded by idle test | 38 | 38 |
| Real-input alarm visibility / engagement (limit: 10 s) | 4.82 s — passes | 5.92 s — passes |
| Last visible pursuit before boom closure | 0.15 s | 0.20 s |
| Group inside compound at closure | 11 / 11 | 11 / 11 |
| Authored S2 Boulevard residents, high / low | 200 / 105 | 100 / 55 |
| Authored S2 total residents, high / low | 600 / 315 | 600 / 315 |
| T-E21-13 forward-pressure emergences in observer window | 0 — fails | 0 — fails |
| Immediate-arrival fixture failures | 4 | 4 |

Both real-input runs reach progression. The updated route passes the existing pursuit, boom closure, compound safety, group rescue and photo assertions, plus a new Boulevard death limit of five. The baseline fails that new death assertion with 23 deaths; its saved closure/group telemetry satisfies the existing finale conditions. The group contains the courier, corgi and nine living officers.

The [before capture](before-boulevard.png) and [after capture](after-boulevard.png) use the same Boulevard photo framing. The turn has fewer blocking bodies in the after capture, and the courier has 63 HP rather than 15 HP at that moment. These are playthrough captures, with the existing death-loop relief active; the exact density comparison above refers to authored population, rather than counting pixels in screenshots.

Typecheck, lint and production build pass. All 971 unit tests pass on Hetzner after the final population redistribution. The focused simulation run passes speed/rate invariants, high/low population preservation, idle police collapse and rescue-boom behavior (4 passed); the newbie timing assertion fails (1 failed). Its death and completion assertions pass. The unchanged newbie time limit already fails on the baseline, and the final redistribution increases its completion time by 85.8 s. Complete-bot time improves by 91.3 s, from 524.93 to 433.65 s, but still exceeds its unchanged 405 s limit.

Full E21 verification completes its simulation/smoke stage with **78 passed and 7 failed**, then exits 1 before the broad browser stage. Every failed case reproduces against the untouched `5214d309` production files: T-E21-02 and T-E21-03 exceed their bot time limits; T-E21-13 records no pressure emergence during its observer window; four L3-follow immediate-arrival fixtures report `crossedAt = 0`. Those fixtures simulate only 90 ticks after teleporting to the rendezvous, despite the current group/boom/minimum-fight behavior. The existing real-input finale, army-checkpoint simulation T-E21-17, rescue-boom, checkpoint-restore, escalation/cap and smoke checks pass. The two required browser cases run separately and both pass. [Full selected results](verify.json) and [baseline comparisons](baseline-regressions.json) retain the failures without changing their assertions.

Browser runs use seed 1, headless Chromium with ANGLE/Metal, one worker and `tools/e2e-lock.sh`, against fresh production builds on private preview ports 3463 and 3465. The baseline build uses the two production files from `5214d309`; the modified files are restored before building the after version. The temporary baseline build and Playwright config are removed. All heavy simulations and units run on Hetzner, at one or two workers.

Reproduce the required functional checks:

```sh
sh tools/remote/run.sh "$PWD" --pull test-results/epics/E21 -- npx vitest run tests/sim/missions/l3-flee-speed.test.ts tests/sim/missions/l3-rescue.test.ts tests/levels/L3.test.ts -t 'T-E21-flee|T-E21-rescue|T-E21-03|T-E21-07d' --maxWorkers=2
npm run build
E2E_PORT=3465 E2E_SLOTS=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L3.spec.ts --project=chromium --workers=1 --grep 'T-E21-07c|fallback, blvd'
MI_VERIFY_REMOTE_SIM=1 E2E_PORT=3464 E2E_SLOTS=1 npm run verify -- E21
```

The requested measurements use one seed; five deaths is exactly the limit. The broader existing E21 gate also runs its authored additional-seed cases. Evidence includes the before/after bot, police, alarm and Boulevard JSON, the browser logs/results, the focused simulation result, unit summary, verification checks and baseline comparisons beside this review. Temporary baseline source copies used only in private remote jobs are removed. No test tolerances or time budgets were increased, and no specifications or reference assets were edited. Nothing was merged or deployed.
