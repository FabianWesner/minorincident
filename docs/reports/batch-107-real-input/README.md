# Batch 107 real-input QA — progress checkpoint

Candidate `d1101b68`. **P1: evacuation exceeds the ~20-second target on both HIGH routes.** All three real-input L9 runs eventually finished without skipped objectives, showing L10 loading. Candidate approval remains withheld; prompt and temporal warning coverage remain incomplete.

Headless GPU browser pool, WebGPU, physical keyboard/mouse driver, debug menu level entry, normal combat, no immortal/route-only mode. Navigation assists are logged. HIGH road ran first, HIGH shortcut second, LOW road third. Raw evidence stays under `test-results/b107/` and is not committed.

| L9 run | Zoom | Finished | Incomplete boarding after first Defense complete |
| --- | --- | --- | --- |
| HIGH road | 1 | 322 s; no skips | 2/4 at tick 12306; still 3/4 at 17447: at least 85.7 s |
| HIGH shortcut | 1.5 | 236 s; no skips | 2/4 at tick 9835; still 3/4 at 12487: at least 44.2 s |
| LOW road | 1.5 | 215 s; no skips | No Defense complete stall observation; precise boarding interval not established |

P1 capture: `test-results/b107/l9-high-road/captures/campaign-L9-t16237.jpg` (tick 16237). Eventual completion means a permanent softlock is not established. The driver classified its road pause P2; this report classifies the measured evacuation-target failure P1 because it reproduces the prior progression regression.

L9 ordinary scream at tick 12347: `test-results/b107/l9-high-road/captures/scream-L9-12347-8.jpg`. Reviewed: thin pale purple arc visible on road, partly concealed by HUD/APC/crowd; weak static contrast. Noticeability while moving and L10 remain unverified. The crowd and damaged APC create visual pressure, but no general “stunning”, smooth-motion, or boredom verdict is justified from these stills.

[Reviewed contact sheet](contact-sheet.jpg): delay frame, actual L9 scream, and HIGH-shortcut/LOW-road L10 loading handovers. It is a small derived artifact; no raw captures were copied into git.

## Open coverage and Driver gaps

L1 HIGH completed normally in 155 s on WebGPU. Reviewed its frequent-capture overview: depot/Medical Annex interactions appear, but the standard route did not visibly exercise the optional alarm prompt. HIGH L2 diagnostic was stopped during navigation; L3 was not reached. L1 LOW and the full alarm HIGH/LOW × zoom 1/1.5 matrix remain open. Prompt jumping requires temporal review. No dedicated alarm capture option exists; tools/playtest was not changed.

North truck staging, gate fence clearance, red pickup grounding at zoom 1.5, APC tilt feel, hatch-shot effectiveness, L9 moving warning noticeability and L10 warning/WebGPU coverage need further review. Requested capture zooms and scream capture options were used; ordinary captures do not automatically create a full scene/zoom matrix. No new P2/P3 gameplay finding is established. Batch 106's P2 truck and P3 alarm issues are not cleared by this checkpoint.

Typecheck and lint passed. Required remote `sh tools/remote/run.sh "$PWD" -- npm test` passed: full 150-case collection, 105 passed/1 skipped, 130.0 s within 240 s. Initial sandbox socket/cache failures were resolved when host access became available. No source fixes or deployments are included.

## L10 follow-up

A roughly four-minute standard-combat HIGH/zoom 1 WebGPU sample reached the farms. Actual Alpha roar at tick 4711 (`test-results/b107/l10-high/captures/scream-L10-4711-1.jpg`) was reviewed: broad red ring conspicuous against dark ground. Metadata identifies `alpha.roar`; it is not the requested ordinary purple scream. Subsequent captures also showed Alpha roars. Sample was manually stopped in the farm fight; ordinary L10 warning and temporal readability remain open. Renderer WebGPU is explicitly recorded in the L9, L1 HIGH, and L10 HIGH logs. Earlier JSON environment failures are now recorded as resolved historical setup issues.
