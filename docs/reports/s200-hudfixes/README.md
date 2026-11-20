# s200 — HUD fixes

The hint is anchored below the health and companion panels, wraps within the viewport, and on narrow screens sits below the navigation panel. The pipe bomb has a dedicated flat SVG, using the molotov's dark tile, gold stroke and olive fill. No external artwork was used.

## Visual review

[Hint captures](hint-captures.jpg) show 1280×720, 1600×900, 1920×1080 and 390×844 (in that order). I inspected the originals: the hunting-rifle role is fully visible on one line at each desktop size; on the phone it wraps to two lines below the tracker, clear of the health panel, weather and rack. These captures show the weapon-selection hint, which uses the same element and styling as the pickup hint; they do not show the pickup's trailing key.

[Rack captures](rack-captures.jpg) show molotov above pipe bomb at 1280×720. The bottle is vertical and the pipe bomb horizontal with end caps and fuse. Both share slot 0, so the rack shows one representative at a time; the two captures use separate loadouts.

## Validation

- `npm run typecheck` and `npm run lint` — passed after the final placement change.
- Focused headless gameplay capture run — passed for four viewports and both throwable loadouts. The temporary capture fixture selected the hunting rifle and verified the role text; it was removed afterwards.
- Focused asset contract — passed; weapon icons have distinct registered IDs.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test` — passed, 27 files, 105 tests passed and one skipped, 196.2 s.
- QA build — passed.

The real pickup message with its trailing key was not captured; attempts to trigger a pickup via the test fixture did not surface it. The existing full smoke test also expects both shared-slot throwables as separate simultaneous tiles and times out on that expectation. Those are open verification gaps.
