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

The prescribed remote command `sh tools/remote/run.sh "$PWD" -- npm test` could not run because no healthy remote runner is provisioned. The local-slot fallback also rejects the `npm test` wrapper; the full Vitest command was run directly instead.

## Still open

Required post-fix real-input acceptance is not verified: three HIGH WebGPU road runs and one LOW run reaching L10 with no skips or stalls remain outstanding. The headless playtest could not start because the sandbox rejects the preview listener on port 5009 (`listen EPERM`). The worktree is not committed because `.git/worktrees/s136-l9bridge/index.lock` is denied by the read-only Git metadata boundary. No deployment, push or main movement was performed.
