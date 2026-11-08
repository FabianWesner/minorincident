# R13 — L7/L8 follower waiting

**Status: targeted threat gate passes; full campaign verification BLOCKED by the serial runtime budget.** Base: `4640125c`; final game source: `c45f847b`.

## Causes and changes

- L7's dog used the ordinary civilian movement response at its catch-up speed. It overshot turns and repeatedly lost ground. Use the existing follower response for its L7 movement. The bus queue also reused nine positions for the full roster (`floor(slot / 3) % 3`); give each group of three its own row so later arrivals no longer converge on occupied positions.
- L8's follower controller supplied changing formation/boarding targets through the ordinary civilian response. Use the existing follower response during catch-up and boarding, with a bounded 5.2 m/s catch-up cap. Normal formation travel retains its ordinary response. Passenger order and the requirement for the courier to cover the complete living group remain in force.
- Both level arrivals heal their carried survivors and reset local timers, but retained combat statuses with expiry ticks from the previous level. Clear those effects at the same recovery boundary so an old slow/stun cannot persist on the new level clock.

The original diagnostic measured L7 skilled waiting at 13.20% and L8 at 42.16%; L8 follower 364's breached-phase median speed was about 4.068 m/s against a 4.353 m/s group median. These are diagnosis notes; final retained receipts below must establish the finished result.

## Verification

All heavy verification runs on Hetzner through `tools/remote/run.sh`, serially with one worker. [Targeted receipt](targeted.json), game source `c45f847b`, is the exact L7/L8 audit: **zero gameplay gate flags**. Its only top-level flag is `PARTIAL_LEVEL_SELECTION`, because selecting two levels is a diagnostic rather than the full campaign gate.

| Level | Skilled outcome | Skilled wait upper bound | Passive wait upper bound | Aggregate pace flags | Gate flags |
| --- | --- | ---: | ---: | ---: | ---: |
| L7 | complete, 111.52 s, zero deaths | 7.54% | 9.54% | 0 skilled / 0 passive, seeds 1–3 | 0 |
| L8 | complete, 105.27 s, zero deaths | 4.57% | 17.42% | 0 | 0 |

L8 follower 364 now measures 4.500 m/s against the breached-phase group median of 4.676 m/s, within the unchanged 5% pace bound. The passive initial breach wave starts an attack after 8.62 s.

The wait gate measures the skilled policy; the passive numbers above remain visible. The passive L8 run intentionally reaches its 150 s observation budget. No audit thresholds, seed voting or observation rules were changed. Raw nested diagnostics are retained: L7 seed 1 marks followers 65/69 slow during departure, but neither wins the existing two-of-three-seed verdict; L8's skilled initial breach wave has no windup before escape, while its passive wave pressure passes the audit. These are not a claim of zero diagnostics in every nested field.

Typecheck and lint passed. The initial full unit run finished with 105 passes, one Linux skip and one tooling failure because the runner's manifest repository has no `HEAD` ([command summary](checks.json)). In a fresh private runner snapshot, `git add -A` and a disposable manifest commit supplied that test's required Git context; the unchanged tooling test file then passed 7/7 runnable cases, including the formerly failing case ([rerun receipt](gate-tools.json)). No browser was launched by these unit tests.

The final serial batch runs:

```sh
node --import tsx/esm tools/qa/threat-audit.ts --levels L7,L8 --maxWorkers 1
npm run qa:threat -- --maxWorkers 1
```

Full campaign result: **incomplete, no full campaign verdict**. The unchanged `qa:threat` wrapper stopped the one-worker run at 600.28 s with child exit 124 ([timeout receipt](full-timeout.json)). It completed L5 passive seeds 1/2/3 in 209.34/197.66/184.05 s before the watchdog terminated the batch. Those three stages alone consumed 591.05 s; the remaining campaign stages could not fit. The generic watchdog mentions a browser reservation, but this command ran native Node simulation and launched no browser.

The lane stops at the brief's two-hour timebox. Completing full campaign verification requires an orchestrator decision permitting a longer serial run/runtime allowance while retaining one worker and all gameplay thresholds. The targeted receipt proves the requested follower gate flags are cleared; it does not prove the unfinished full gate. No full-gate success is claimed.

## Commits

- `1a47bab0`: distinct L7 bus queue slots.
- `1b1c4c13`: L7 companion follower response.
- `b3810085`: expire combat effects at carried-group recovery.
- `c45f847b`: responsive L8 catch-up and boarding movement.

Rocket cadence, 5 m firing safety, L7 Alpha health, multi-direction horde mouths, the 60 s L8 calm period and gate-before-APC story order are preserved. No thresholds or observer rules are changed. No browsers, deployment or push are used in this lane.
