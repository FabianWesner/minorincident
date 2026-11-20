# s200 — HUD fixes

## Changes

- The active weapon hint now sits below the health panel, uses a viewport-safe width, and wraps long pickup text. Its top position follows the health panel after layout.
- Pipe bombs resolve to the dedicated `icon.pipe-bomb` asset. The flat SVG uses the same dark tile, gold outline, and olive fill palette as the molotov while showing a capped pipe body and fuse.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused asset contract test (`tests/shared/asset-contract.test.ts`, asset-validator case) — passed.
- `npm run build:qa` — passed.
- Browser smoke retried after permissions changed. Four provisional viewport captures were generated, but the injected text can be overwritten by the game update, so they do not establish the long-hint requirement. The run failed when it expected both throwables simultaneously in the rack: they share key 0 and the rack displays one representative. The experimental assertion was removed. Visual capture and rack verification remain open.
- `sh tools/remote/run.sh "$PWD" -- npm test` — unavailable: no healthy Hetzner runner is running or provisioned. Direct local `npm test` reached its 240 s budget and exited 124 without a test failure report; this is not remote-suite evidence.

## Open

Run the browser smoke and visually inspect its four hint captures plus the molotov/pipe-bomb rack capture when the browser pool can start. Obtain a green remote `npm test` result when a runner is available. Until then the capture and remote-suite Done items remain unverified.

