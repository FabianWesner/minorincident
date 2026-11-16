# s136-l9bridge — L9 bridge approach

## Finding

The batch-110 bridge stall is a playtest-driver route error, not evidence that the APC was physically trapped. The recorded APC continued moving at its 0-HP speed cap while its position and heading looped around x≈545–561, z≈−10–10; the bridge marker remained about 51–66 m away. The captures show the APC outside the road beside a large mixed crowd, but the run did not record keyboard steering, so it cannot establish that crowd contact caused the loop.

The driver bug is directly visible in `tools/playtest/session.ts`: its authored road route ends at `[550, 0]`, beyond the bridge marker near `[470, 0]`. After evacuation it continued following that endpoint, even after the HUD changed to “Drive onto the bridge”. It therefore kept steering away from the live objective and could circle at the route endpoint. The driver now follows the live marker for that objective. The underlying vehicle/corpse rules and zombie stats are unchanged.

Reviewed visual evidence: [bridge-stall-sheet.jpg](bridge-stall-sheet.jpg). It juxtaposes the ticks 17230 and 28486 screenshots. The APC is moving and visibly off-road beside the pile; the sheet alone cannot resolve exact steering input or collision forces.

## Boarding census

With `PLAYTEST_L9_EVAC_AUDIT=1`, the existing read-only observer now emits an identity census on each one-second observation. Each roster member (excluding Sam, who is not part of the 4-person boarding count) includes identity key, alive status, infection status, evacuated/aboard status, HP and civilian state. Samples explicitly identify the defense-complete tick and whether the sample is at or beyond it. The observer reads state only; it does not steer or mutate actors.

## Changes

- Route the real-input playtest driver to the current bridge marker once the bridge objective appears.
- Add the 139 KB native campaign fixture `l9-bridge-approach-census.json.br` at the seed-1 bridge checkpoint (tick 10810) and include it in the existing L9 vehicle checkpoint regression.
- Extend the existing read-only L9 evacuation audit with an explicit survivor identity/alive census.

## Verification

- `npx vitest run tests/engine/vehicles.test.ts` — PASS, 2 tests.
- `node --import tsx tools/qa/check-fixtures.ts` — PASS, including the new fixture and all existing QA save fixtures.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- Full unit suite via direct Vitest command, capped at 4 workers — PASS, 27 files / 106 tests.
- `npm run build:qa` — PASS.
- `git diff --check` — PASS.

The prescribed remote suite passed on the unchanged rerun documented below.

## Real-input road runs

Headless WebGPU through the browser pool, ports 5009/5010, ordinary mortal input and no skips: HIGH runs reached L10 in 256, 270 and 191 seconds; LOW reached L10 in 244 seconds. The first two HIGH runs logged 3 and 4 stationary-infected P2 flags; the third HIGH and LOW runs logged none. Raw receipts are under `test-results/playtest/s136-*`, with compact results in `qa.json`.

The implementation is committed as `ea5b652a`. The former sandbox restrictions are lifted. The threat and vehicle motion results and recovered original save are documented below. Seven stationary-infected observations remain unexplained by the saved logs; they occurred during evacuation and are retained as observations, not dismissed as false positives.

## Additional gates

`npm run qa:vehicle-motion` passed all sixteen HIGH/LOW scenarios. L9 threat audit completed skilled and passive routes with zero level-specific flags; its sole aggregate flag is `PARTIAL_LEVEL_SELECTION` because only L9 was selected. Raw receipts: `test-results/s136-threat/audit.json` and `test-results/s83-vehicleslide/native-contact/*.json`.

## Archived reproduction input

Recovered the original batch-110 `campaign-completion.json` campaign save, which is actually tick 13042 (before the bridge loop, near the requested 13140 boundary). Preserved unchanged as `tests/fixtures/saves/qa/s136-b110-l9-road-loop.json.br` (151384 bytes). The native fixture loader passes. This records the original boarding state; the archive does not contain an exact tick-17230 physical snapshot. Later steering evidence remains the recorded observation trace.

## Remote suite rerun

The prescribed unchanged remote rerun passed: 27 files, 105 passed / 1 skipped, 127.2 seconds against 240 seconds, with the complete 150-case collection budget. The earlier attempt timed out at 246 seconds; no tests were removed or changed between attempts.

## Census evidence review

Reviewed all 180 defense-complete observer samples across the four road runs (66/50/16/48). Every sample contains all four survivor identities; none reports a dead or infected survivor. Pending-evacuation samples number 27/15/0/10 respectively. These records now distinguish living stragglers from deaths. The original batch-110 save is already evacuation-complete when loaded; its regression therefore checks preserved completion, rather than claiming the earlier boarding deadline passed.

## Archived save driving replay and disposition

The unchanged recovered batch-110 save completes L9 in 1072 native ticks (17.87 seconds) with the existing road input policy (`LevelNineBot`), no actor/objective/health writes. Evacuation remains complete and the native crash/crawl reaches `done`. This complements the four real-input runs: the preserved crowd does not prevent bridge completion when the input policy follows the bridge. The seven stationary-infected observations concern evacuation actors and are retained separately; they did not stall the APC crossing and the independent L9 threat audit has zero level-specific flags.

The requested bridge driver correction, archived fixture/native regression, read-only boarding census, three HIGH plus one LOW WebGPU road completions, L9 threat diagnostic, vehicle motion gate, remote suite rerun, typecheck/lint and reviewed small sheet are delivered. No zombie statistics or corpse persistence rules changed. The archive save is tick 13042, near the requested 13140 start; no exact later physics snapshot is claimed.
