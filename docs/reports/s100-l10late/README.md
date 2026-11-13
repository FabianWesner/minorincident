# s100-l10late — L10 corridor, complex and finale

**Status: incomplete; original sandbox blocker resolved on continuation.** The production build passed. The requested WebGPU frame-time and visual review could not be run: the browser-pool daemon failed to bind `127.0.0.1:4329` (`EPERM`); the documented legacy GPU guard could not inspect processes (`ps` permission denied); a single headless Metal Chromium launch then failed at macOS Mach rendezvous (`Permission denied (1100)`). No browser screenshot or contact sheet was produced, and no gameplay source was changed.

## Verdicts

| Requirement | Verdict | Evidence / missing evidence |
| --- | --- | --- |
| Frame interval at 60–70 live infected, corridor / complex / finale, HIGH and LOW at zoom 1 and 1.5 | **FAIL — unmeasured** | No GPU browser samples. The report cannot determine whether HIGH p95 exceeds 33 ms. WebGPU backend and actual render quality were therefore not verified. |
| Attack-start gaps over at least five minutes of journey | **PASS (native simulation evidence)** | The current main ancestry contains [s93 native validation](../s93-l10finale/native-validation.json): six seed/tier complete routes, each with attack-start gaps ≤43.28 s (HIGH 26.52–33.65 s; LOW 42.12–43.28 s), against the 45 s threshold. Infected peaks were 62–70. This is native simulation evidence, not a browser observation. |
| Sprinter spawn pop-in / camera visibility | **FAIL — unreviewed** | No captures could be opened because browser startup failed. |
| Mega approach after cure installation and finale lulls | **FAIL — unmeasured** | No browser route or approach-time measurement. |

## Findings and priority

- **P1:** Obtain the required HIGH WebGPU frame samples at 60–70 live infected. The >33 ms p95 condition is unknown; no performance pass is claimed.
- **P1:** Measure Mega arrival after cure installation and inspect finale activity for lulls.
- **P2:** Capture and open corridor / complex sprinter-arrival frames at both tiers and zooms to assess in-view spawning.
- Existing arrival cadence evidence passes: longest gap is 43.28 s (seed 2 LOW), 1.72 s below the threshold. The source receipt records a 56 s protected dialogue interval separately.

## Run record

- `npm run build`: PASS, production build complete.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `sh tools/remote/run.sh "$PWD" -- npm test`: NOT RUN; runner reported no healthy provisioned Hetzner worker and refused local Mac fallback (exit 69).
- Browser policy: headless, one intended GPU browser; browser pool attempted first. Pool bind, process inspection and Chromium bootstrap failures are environment restrictions, not game results.
- No source or spec files changed. No contact sheet was fabricated from unrelated captures.

**Next required action:** rerun this lane in an environment where the local browser pool / headless Metal Chromium can start, then replace the unmeasured verdicts and add the opened-capture contact sheet.

## Full-access continuation

The pooled headless Metal browser now starts and reports `webgpu`, with requested HIGH and LOW quality and zoom 1 / 1.5. The initial checkpoint probe completed, but all twelve samples held only seven live infected and paused simulation; these samples are excluded from acceptance. Raw diagnostics are under `test-results/s100-l10late/probe.json`. Source inspection identified `Mission.restore()` retaining `cureFront` for an already loaded L10 world, so repeated checkpoint requests do not establish independent late-region fixtures. Next: restore authoritative mission-resume fixtures in fresh worlds and record normal-speed gameplay with per-frame live counts. No performance or visual pass is inferred from the diagnostic probe.

## Native fixture-generation probe

A fresh seed-3 native route completed at each tier. HIGH: Mega distance at cure installation 25.76 m, time to enter 25 m radius 0.20 s. LOW: 25.35 m and 0.67 s. These are simulation approach measurements. The live population probe found no 60–70-live interval in its provisional later coordinate bands: HIGH peaks 59 / 48 / 19; LOW 37 / 24 / 14 (corridor band / complex band / installed finale). These bands still require alignment with authored region envelopes; see [raw summary](native-probe.json). Finale mission-resume fixtures were saved under test-results for subsequent browser restoration. This does not satisfy GPU timing, lulls or visual review.

Authored-envelope rerun confirms seed-3 live peaks: destroyed-corridor HIGH 59 / LOW 37; dispersal-complex HIGH 52 / LOW 24; installed finale HIGH 19 / LOW 14. Peak-state mission-resume fixtures now exist for all six tier/region combinations under test-results/s100-l10late. The earlier provisional complex HIGH value 48 is superseded by 52. Browser normal-speed fixture runner is prepared in /private/tmp/s100-browser.mts; GPU acceptance sampling remains pending.

## Browser resume diagnostic

Direct `mission.loadResume()` restores the native infected population: HIGH corridor reached 67 live at both zooms (800 / 761 RAF samples at 60–70 live). However, the opened `live-high-destroyed-corridor-z1.5.jpg` shows the courier and corgi over largely blank ground, without the authored corridor environment. Therefore **all six HIGH resume measurements are excluded from performance acceptance** until region rendering is restored and visually verified. The diagnostic frame summaries are in [high-browser.json](high-browser.json); their ~16.7 ms cadence is not a valid populated-scene performance result. Complex live range was 35–52; finale 10–45. Next: repair fixture setup/streamed presentation, then rerun HIGH before LOW. No game source changed.

The pre-view-load campaign-resume experiment also restored 55–67 live infected but the opened corridor capture still lacked authored scenery. Moving restoration earlier alone does not repair this fixture. Acceptance timings remain excluded; next inspect chunk/district residency and view visibility at the restored player position. The temporary runner now uses `loadLevel` setup to install the native campaign resume before view preparation.
