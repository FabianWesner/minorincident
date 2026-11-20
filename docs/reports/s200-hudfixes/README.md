# s200 — HUD fixes

## Changes

- The active weapon hint now sits below the health panel, uses a viewport-safe width, and wraps long pickup text. Its top position follows the lower edge of the health and companion panels after layout; a provisional phone capture showed the companion obscuring the earlier placement.
- Pipe bombs resolve to the dedicated `icon.pipe-bomb` asset. The flat SVG uses the same dark tile, gold outline, and olive fill palette as the molotov while showing a capped pipe body and fuse.

## Validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- Focused asset contract test (`tests/shared/asset-contract.test.ts`, asset-validator case) — passed.
- `npm run build:qa` — passed.
- Browser smoke retried after permissions changed. Four provisional viewport captures were generated, but the injected text can be overwritten by the game update, so they do not establish the long-hint requirement. The run failed when it expected both throwables simultaneously in the rack: they share key 0 and the rack displays one representative. The experimental assertion was removed. Visual capture and rack verification remain open.
- `sh tools/remote/run.sh "$PWD" -- npm test` — passed: 27 files, 105 tests passed, 1 skipped, 191.9 s.

## Open

Run the browser smoke and visually inspect its four hint captures plus the molotov/pipe-bomb rack capture when the browser pool can start. The capture Done item remains unverified. A subsequent attempt to trigger a pickup through the VFX test hook failed because that hook does not dispatch pickup events to the HUD.


A further headless smoke run reached L10 but timed out waiting for a separate pipe-bomb tile: fixed slot 0 displays a single throwable representative. A phone capture showed the pipe-bomb hint below the companion and clear of the rack and health, although it overlaps the weather label. Attempts to inject a long hint were overwritten by the running HUD, so the four long-hint captures still need a reliable fixture and review.

The phone hint width is now capped at 55vw (220px maximum) to leave the weather label room. QA build and lint passed. A follow-up long-hint capture attempt selected the fire axe instead of the gun; the retry timed out acquiring a browser. The revised mobile layout has not yet been visually verified.

A further capture retry timed out during browser pool setup. The legacy lock alternative waited for admission and was stopped without launching a browser. No additional visual evidence was produced.
