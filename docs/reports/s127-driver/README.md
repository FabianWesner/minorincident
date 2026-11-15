# s127 playtest driver

## Changes

- L9 hatch attacks are allowed while the courier is riding when the visible objective says “Hold the hatch”; rendered infected remain required targets.
- Rendered APC passengers inside the viewport count as visible boarders for driver observation.
- Acceptance capture zooms are 1 and 1.5.
- Requested quality is reapplied at the first playing tick for every level, then the actual render tier is asserted and logged.
- `--scream-captures` listens on each mission world's event bus and captures screamer scream noise and Alpha roar telegraphs with level/tick metadata. Screamer state observations are also logged per level. This covers event emission when present in L6/L9/L10 and Alpha roars in L6/L7.
- `--route-only` and `--immortal` are explicit options. Both label acceptance output; immortal mode enables god mode and is also route-only.

## Checks

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx vitest run tests/tools/qa-drivers.test.ts` — passed, 3 tests.
- `npm test` — passed locally, 106 tests in 27 files; the budget guard confirmed the complete 150-case, 45-file suite was selected.
- `sh tools/remote/run.sh "$PWD" -- npm test` — unavailable: no healthy Hetzner runner, and the runner rejected the local slot. `MI_LOCAL_FALLBACK=1` did not enable that wrapper path.
- `npm run build:qa` — passed.

## Runtime proof still open

Attempted a 60-second headless L9 LOW run with zoom 1 and scream capture:

```sh
E2E_PORT=4991 SCENE_PORT=4992 npm run playtest -- --levels L9 --entry debug --session-seconds 60 --quality low --zoom 1 --scream-captures --out docs/reports/s127-driver/l9-proof
```

The QA build completed. Playtest did not reach browser launch: tsx first failed to bind its IPC socket (`EPERM`); invoking the entrypoint through `node --import tsx` bypassed that, but browser-pool startup then failed to bind its local control ports 4321/4329 (`EPERM`). The headless proof run, captures, and runtime verification of hatch fire, APC boarders, loaded quality, scream/roar events, and immortal labeling therefore remain unverified in this sandbox.

## Resumed validation

Permissions restored: remote `sh tools/remote/run.sh "$PWD" -- npm test` passed (105 passed, 1 platform skip, 128.3 s). Typecheck and lint passed. A headless pooled WebGL2 LOW L9 sample ran 60 seconds with zero issues, reaching tick 3411 at crossing-start. It did not reach hatch combat; event capture, boarder targeting and immortal runtime proof remain open. Raw evidence is in ignored `test-results/s127-proof/`.
