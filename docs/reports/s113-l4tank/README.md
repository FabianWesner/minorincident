# s113-l4tank — completed

Implementation: `3970ba8e` (preceded by `2662c556`, `a80b1fb5`; simulation experiments are reverted). Full vehicle campaign motion gate passes, L4-06 HIGH passes, and the full threat audit has only the allowed L6 breach2 flag. LOW census is informational under the binding orchestrator decision.

## Root cause and retained fix

Dense crowd movement exposed a detailed foot-contact discontinuity. When a planted foot released late in its gait cycle, `releaseP = min(p, 0.9)` started the swing partway through its arc. In the restored-LOW repro, actor 210's root moved only millimetres while its shoe target jumped about 16 cm, producing 18 cm measured slide. Late releases now start a timed step from the locked target, giving the foot time to lift before travelling. Shared humanoid get-up presentation also settles its final pose onto the floor before returning to locomotion.

Original simulation separation and depenetration code is restored. No zombie/weapon stats, recovery timers, corpse persistence, actor inclusion, motion thresholds or classification changed. LOW caps are restored to 80 infected / 120 characters; HIGH remains 160 / 230 and alarm cohort remains 36. s111 spearhead admission remains intact.

## Before and after vehicle gate

Task baseline LOW actor 163: FAIL, slide max 17.1 cm, p95 1.9 cm, yaw drift 21.5 degrees, lift max 17.9 cm, worst frame 313; `separationM/163` failed. After restoring LOW caps, the original simulation contact repro exposed actor 210 with 18 cm slide / 16.1 cm lift; this led to the measured late-release target jump.

Final command: `E2E_PORT=4931 SCENE_PORT=4932 npm run qa:vehicle-campaign-motion` — PASS, exit 0. L9, L7 bus, L4 parked and L4 tank all pass HIGH and LOW with stable runtime hashes. Tank grounded slide max/p95: HIGH 2.6/2.1 cm; LOW 5.6/1.5 cm. No failed actor or correction tracks remain.

Tank observation now lasts 1320 instead of 1200 frames. Correction slices include an active heavy reaction through its end plus the existing 30-frame margin. This adds evidence without changing verdicts: actor 196 previously had only a single shamble sample and an unfinished get-up window, whose landing was outside the observation. Every original sample remains measured.

## L4 census and full audit

| Tier | First breach alive | Minimum plaza alive after +45 s | Peak living |
|---|---:|---:|---:|
| HIGH | 72 | 42 | 91 |
| LOW (informational) | 47 | 16 | 57 |

LOW stationary peak living: **57**. L4-06 is judged on HIGH, with LOW printed in criterion details as requested. All three LOW breach cohorts satisfy the audit; no fewer-than-three cohort flag remains.

Full command `npm run qa:threat` completed in 438.1 s. Exit 1 is expected from its one retained acceptance flag. Complete flag list:

- `L6/early-close/wave/l6.breach2:WAVE_FIRST_ATTACK_OVER_20_SECONDS`

Full generated receipts: `test-results/qa-threat/audit.json` and `README.md`; compact committed evidence: [evidence.json](evidence.json).

## Validation

- Typecheck and lint: PASS on final runtime source.
- Remote unchanged `sh tools/remote/run.sh "$PWD" -- npm test`: PASS, exit 0, 150/150 manifest cases, 27 files, 106 tests passed / 1 skipped, 222.1 s against 240 s. Job `/srv/mi/jobs/s113-l4tank-40c15d-82123-1794678351`. No trimmed suite or timeout retry.
- Full vehicle campaign gate: PASS through the serial e2e lock, unique ports 4931/4932, headless.
- Full threat audit: exactly the one allowed flag above.

No frame-time measurement, push, deployment, or main movement was performed. Orchestrator owns post-merge LOW performance measurement.
