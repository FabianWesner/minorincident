# s249 L10 finale assault

## Status

Not accepted. The focused infected AI test passes, but the required high story
run still fails the idle-entry check. No code-done commit was made.

## Evidence

- Baseline from the brief: high 49/51 (idle-entry and roadblock 3390), 3 deaths.
- Initial pressure-target change: high 49/51, 115 idle entries, 7 deaths.
- Broad L10 immediate chase: high 41/51, tick-budget at 2400 s, 3 deaths.
  It never reached the finale, so its zero idle entries do not establish a pass.
- Scoped finale chase: high 49/51, complete in 1514 s, 3 deaths, 50 idle entries. The idle-entry
  check still fails; sampled assault entrants are first seen at the service
  mouth moving about 0.013 m/s. Roadblock 3390 remains the other failure.
- `npx vitest run tests/engine/infected-ai.test.ts`: 1 file, 5 tests passed.

The high run used seed 0. Low tier, low seed 1, and `npm run qa:threat` were not
run because the high acceptance check remains failing.

Receipts: `/private/tmp/s249-l10-high.json`, `/private/tmp/s249-l10-high-v2.json`,
and `/private/tmp/s249-l10-high-v3.json`, respectively. The uncommitted scoped
change is experimental and does not satisfy acceptance.
