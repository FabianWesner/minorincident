# s100-l10late — L10 late-region QA

**Overall FAIL: HIGH seed 3 has a 46.48 s finale tail without an attack start, 1.48 s over the 45 s criterion.** Report only; gameplay remains PROD batch 94 / `0bb6a649`. All branch changes are evidence under this directory.

## Verdicts

| Item | Verdict | Measured result |
| --- | --- | --- |
| Frame intervals at 60–70 live infected | PASS for staged stress; native density differs | All 12 tier/region/zoom cases: mean 16.65–16.66 ms, p95 16.70–16.80 ms, max 16.80 ms. **No observed HIGH p95 >33 ms.** |
| Journey attack-start intervals ≥5 min | PASS, native simulation | Six complete routes, 1111.02–1195.23 simulated seconds; largest adjusted adjacent-start gap 43.28 s. |
| Sprinter births in camera view | PASS in observed corridor arrivals | HIGH 0/8; LOW 0/16; both zooms, actual camera projection at creation, captures opened. |
| Mega approach after installation | PASS in seed-3 native routes | Enters 25 m after 0.20 s HIGH / 0.67 s LOW; starts at 25.76 / 25.35 m. |
| Finale lulls, including head and tail | **FAIL HIGH; PASS LOW** | HIGH 46.48 s final tail; LOW maximum 18.60 s including ends. |

## Frame intervals

Headless pooled Chromium, ANGLE Metal, backend verified `webgpu`, 1280×720, DPR 1. HIGH ran before LOW. Actual render tier and camera zoom were recorded. Exactly one browser context was used at a time through `tools/e2e-lock.sh` / browser pool, reservations under ten minutes, private ports 4901/4902; port 3300 was not used. Source served by Vite dev; production build was also checked. RAF cadence is refresh capped at approximately 60 Hz: these are observed frame intervals, not uncapped GPU execution times or GPU headroom estimates. No CPU profiler ran during samples.

Native peak-state seed-3 mission resumes preserve actors, bodies, mission and Mega state. A **synthetic stress fixture** adds unchanged catalog runners around the courier to reach 65 live, retains all existing bodies, enables courier god mode, then runs simulation at normal speed for 15 seconds. Corridor/complex repeat the restored current InputFrame, which may include combat. Finale uses fresh empty InputFrames and a runtime-only director-cap override that includes recoverable downed reservations. The cap override prevents production chunk residency from sleeping the extra actors. This changes test population headroom, not production code or infected stats.

Native installed finale caps are **22 HIGH / 14 LOW**, so a sustained 60–70 finale is not a native encounter. These synthetic results establish this explicitly staged load envelope, not natural encounter population, navigation fairness or mortal playability. Native actual-load results are retained in [browser-matrix.json](browser-matrix.json): HIGH corridor 55–67, complex 35–52, finale 10–45; LOW corridor 37–41, complex 2–24, finale 0–22. LOW actual-load finale includes cure release/epilogue. Its worst whole-window frame is 50.00 ms.

| Actual tier | Region | Zoom | Live range | Frames at 60–70 | Mean ms | p95 ms | Max ms | ≤33 ms p95 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| HIGH | destroyed-corridor | 1 | 64–70 | 900 | 16.66 | 16.70 | 16.80 | PASS |
| HIGH | destroyed-corridor | 1.5 | 64–70 | 900 | 16.66 | 16.70 | 16.80 | PASS |
| HIGH | dispersal-complex | 1 | 65–66 | 900 | 16.66 | 16.70 | 16.80 | PASS |
| HIGH | dispersal-complex | 1.5 | 65–66 | 901 | 16.66 | 16.70 | 16.80 | PASS |
| HIGH | finale | 1 | 65–67 | 901 | 16.66 | 16.70 | 16.80 | PASS |
| HIGH | finale | 1.5 | 65–67 | 901 | 16.66 | 16.70 | 16.80 | PASS |
| LOW | destroyed-corridor | 1 | 65–67 | 901 | 16.66 | 16.80 | 16.80 | PASS |
| LOW | destroyed-corridor | 1.5 | 65–67 | 901 | 16.66 | 16.70 | 16.80 | PASS |
| LOW | dispersal-complex | 1 | 65–70 | 900 | 16.66 | 16.70 | 16.80 | PASS |
| LOW | dispersal-complex | 1.5 | 65–70 | 900 | 16.66 | 16.70 | 16.80 | PASS |
| LOW | finale | 1 | 65–65 | 900 | 16.66 | 16.70 | 16.80 | PASS |
| LOW | finale | 1.5 | 65–65 | 901 | 16.65 | 16.70 | 16.80 | PASS |

[Per-frame intervals, ticks and live counts](frame-samples.json), [HIGH staged summaries](stress-high.json), [LOW staged summaries](stress-low.json), [sustained finale summaries](finale-envelope.json). Only 60–70-live frames enter the table. First-frame RAF intervals may be partial. The earlier 10–11-frame native-cap finale stress attempts are excluded.

## Arrival cadence and finale

[Fresh native cadence receipt](current-cadence.json), source revision `1c05fbd5` (documentation-only descendant of PROD). Existing native complete policy supplies ordinary InputFrames; no actor/stat/timer modifications. The observer counts attacks starting against player 1, including interrupted windups. Exactly 56 s of protected hangar conversation are excluded from adjusted gaps and retained separately in the receipt. All six routes complete, with zero cap violations. This is simulation evidence, not a five-minute browser playthrough.

| Seed | Tier | Route seconds | Largest adjusted adjacent-start gap s | Peak infected |
| --- | --- | ---: | ---: | ---: |
| 1 | low | 1111.02 | 42.12 | 69 |
| 1 | high | 1195.23 | 33.65 | 62 |
| 2 | low | 1114.55 | 43.28 | 69 |
| 2 | high | 1184.63 | 28.63 | 62 |
| 3 | low | 1160.55 | 42.23 | 70 |
| 3 | high | 1194.25 | 26.52 | 65 |

[Finale head/tail receipt](finale-lulls.json) adds installation-to-first-start and last-start-to-cure-release intervals; the adjacent-only journey metric does not cover those tails.

| Seed 3 | HIGH | LOW |
| --- | ---: | ---: |
| Installation to release s | 65.70 | 113.28 |
| Attack starts during finale | 3 | 108 |
| Installation to first attack s | 15.68 | 16.88 |
| Largest adjacent gap s | 2.35 | 18.60 |
| Last attack to release s | **46.48** | 0.60 |
| Mega distance at installation m | 25.76 | 25.35 |
| Mega time to ≤25 m s | 0.20 | 0.67 |

Mega approach therefore has no long travel wait in these seed-3 routes; HIGH still has a finale pressure lull. No all-seed approach claim is made.

## Visible spawning and captures

The spawn observer wraps ordinary infected creation without changing its arguments or behavior, then projects the spawn point at body height into the actual gameplay camera. In-view means NDC x/y/z within −1…1. A restored corridor checkpoint plus continuous ordinary westward movement triggers arrival creation; god mode preserves the observer. HIGH produces four births per zoom; LOW produces eight per zoom. LOW uses the matched HIGH-origin checkpoint with actual director tier and renderer quality verified LOW. [HIGH events](spawn-high.json), [LOW matched events](spawn-low-matched.json): **0/24 births in view**. This limited observed-event pass does not prove every authored spawn across the full map is invisible. Earlier LOW-origin windows with zero births are retained in spawn-low.json and do not count toward the verdict.

The immediate birth captures at both tiers/zooms were opened: pre-existing nearby enemies remain visible; the new sprinters are outside the frame, consistent with projection. All six stress-region endpoint captures at zoom 1.5 were also opened: dense crowds surround the courier over authored crops, complex paving and the finale platform. The initial apparently blank corridor frame is authored open ground, not a demonstrated renderer defect. [Contact sheet](contact-sheet.jpg) shows the six stress views plus one birth-event view per tier; captions identify the fixture. Synthetic crowded placement is not assessed as native spawn pop-in.

## P1 / P2 findings

- **P1: none established.** No measured HIGH stress p95 exceeds 33 ms; native worst observed whole-window frame is 50 ms, below the checklist's 200 ms hitch threshold. This is bounded by the sampled windows.
- **P2: HIGH finale pressure lull.** Seed 3: 46.48 s without an attack start immediately before cure release, exceeding 45 s by 1.48 s. The adjacent-start cadence gate alone misses this tail. Reproducer: unchanged native complete-policy seed 3 HIGH, observe installation through cure release including interval endpoints.
- **Coverage limitation:** native finale cannot hold 60–70 living infected under its 22/14 caps. The 65-live finale measurement requires the declared synthetic runtime-cap override; do not present it as native density.

## Checks and provenance

Read `docs/qa/po-checklist.md`. `npm run build`, `npm run typecheck`, and `npm run lint` PASS. Required remote `sh tools/remote/run.sh "$PWD" -- npm test` PASS on 46.225.66.90: 27 files, 106 tests passed, one skipped, 223.17 s Vitest / 225.7 s budgeted command (240 s budget). No check is still running. Source has not changed since these checks.

No deployment, push, main movement, zombie stat tuning or corpse removal. Initial sandbox startup failures were superseded by successful pooled full-access runs. Earlier diagnostic artifacts (high-browser.json, native-probe.json, road-high-proof.json) retain the investigation history; the final verdict uses the receipts linked above. Raw local screenshots and fixture resumes remain in `test-results/s100-l10late/`.
