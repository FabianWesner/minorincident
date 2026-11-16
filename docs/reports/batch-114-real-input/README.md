# Batch 114 real-input QA — incomplete acceptance

Candidate `09f9396b5633d1978e292bbdb0a0be619ba52152`. Report only. **LOW WebGPU L4 and HIGH WebGPU L9 complete. HIGH L4 does not complete its nine-minute sample; full WebGPU L10 completion remains pending at the time limit.** This is not batch approval.

## Method and validation

Ordinary mortal keyboard/mouse driver, no objective skips, assists or immortality. Debug level entry except L1 new game. Headless pool / `tools/e2e-lock.sh`, one context for this job at a time, ten-minute reservations, ports5035/5036. L4 uses `PLAYTEST_VISIBLE_ONLY=1`. Explicit WebGPU runs set `PLAYTEST_BACKEND=webgpu`; each renderer receipt is retained. HIGH L4 precedes LOW. Sweeps use HIGH zoom1; full-route runs zoom1.5.

QA build (`MI_BUILD_CACHE=off`), typecheck and lint passed. Prescribed unchanged remote `sh tools/remote/run.sh "$PWD" -- npm test` ran twice on94.130.181.173: both failed the L4 contact-test timeout. Second:26 files passed/one failed,104 tests passed/one failed/one existing skip,207.75 seconds, within240-second suite budget. Tests were not trimmed. Logs `/tmp/s149-remote.log` and `/tmp/s149-remote-retry.log`. No checks remain running.

Initial sandbox cache/socket denials resolved after permissions changed. A later backend audit found the first matrix had used the driver's default WebGL: the canvas's three.js label was insufficient evidence. Those runs are retained as supplemental WebGL history, never substituted for WebGPU acceptance. Full retained-profile WebGL L10 completed1405 seconds, five result deaths, no skips, seven recovered warnings. Its earlier journey expired at the595-second wrapper limit and lost its default temporary profile. Explicit WebGPU reruns below correct the coverage record.

## WebGPU coverage

| Check | Result and reviewed observations |
| --- | --- |
| L4 HIGH visible-only |541 seconds, no skips;11 defense deaths,15 escape deaths. Cap tick32246 at(-44,-37), western Harbor,20 m from marker. No stationary-enemy warning. Dense intense defense; infected remain on escape. Full completion not reproduced. |
| L4 LOW visible-only |Complete463 seconds, no skips;5 defense deaths,4 escape deaths. Zero-metre ring warning tick15328 recovered. Reviewed tick27342 shows cellar wait with21 HP. |
| L9 HIGH |Complete233 seconds, zero deaths/skips/issues. Evacuation, bridge and handover progress without a reported stall. Tick10823 shows Defense complete,1/4 at trucks and clearly authored zebras in the crowd; animals read as striped bodies. Dense occlusion limits individual movement judgment. |
| L10 HIGH |480-second sample clears farms into restricted zone, no skips. Full WebGPU ending remains pending. Reviewed ticks2713/5429/8149/10857/13562/16285: dark corn corridors, close pursuers, low health and a death frame; dangerous rather than harmless, repeated corn/shed travel feels repetitive. Driver route/deaths confound a universal fairness judgment. No enemy-unhittable warning; universal melee-cone alignment unproven. |
| L1 HIGH zoom1 |Complete146 seconds, zero issues/skips. Reviewed2718/5426/8132: bright readable delivery route escalates into pursuit. Pleasant opening, dangerous ending; no obvious geometry glitch in these frames. |
| L2 HIGH zoom1 |240 seconds, no skips. Reviewed2718/8130/13540: striking fire-engine staging, lethal crowd. Opening axe warning recovered; four-minute cap intentional. |
| L3 HIGH zoom1 |240 seconds, no skips; cap only. Reviewed2717/8126/13538: smoke/fire, readable red threats, repeated dangerous street combat; no obvious geometry glitch in frames. |
| L5 HIGH zoom1 |240 seconds, no skips; cap only. Reviewed2717/8129/13545: atmospheric dark close combat followed by quiet repeated search. Not harmless overall; survivor rescue/babysitting not reached. |

## Findings

- **P2 provisional — HIGH L4 visible-only escape completion not reproduced.** Fifteen escape deaths in the capped WebGPU run, versus four in completed LOW. Capture `test-results/playtest/b114-gpu-l4-high/captures/campaign-L4-t29895.jpg`, tick29895; cap receipt tick32246. Street markers and text are readable in sampled frames, but repeated deaths keep overall guidance usability open. Difficulty versus driver steering remains unresolved; this does not prove a permanent product softlock.
- **P2 provisional, supplemental WebGL — stationary perimeter crowd.** `test-results/playtest/b114-l4-high/captures/campaign-L4-10695-enemy-frozen.jpg`, tick10695. Opened full-size: infected bunched against rail, dense combat behind trucks. Named actor/frozen-AI attribution unproven. Explicit WebGPU HIGH emits no matching stationary warning; LOW emits none.

No confirmed P1 or P3 product finding. Automatic navigation warnings and sample caps are not accepted as product severities. Authored L9 zebras are not rendering-corruption findings.

## Driver gaps and open qualification

L2 empty-marker axe pickup warning recovers. LOW L4 street-ring delay recovers; exact driver versus marker cause unresolved. L10 navigation/hangar warnings recovered in full WebGL history; WebGPU farm warning also advances to restricted zone. L4 bounded continuation cannot preserve the live cellar run. L10 long sessions need retained profiles and shorter segments to survive reservation expiry; no tool edits made.

Remaining acceptance: complete HIGH WebGPU L4; full WebGPU L10 ending and readable attack-to-hit sequences. LOW street guidance works through completion but took four escape deaths; no universal wire-routing or no-stationary-crowd claim follows from sparse frames. All sweep judgments are bounded to inspected images; L5 babysitting remains unexercised. At the job time limit, these remain open rather than becoming inferred passes.

## Artifacts

[qa.json](qa.json) is under200KB. One small [contact sheet](contact-sheet.jpg) was created and opened: WebGPU HIGH L4 ticks8128/29895, LOW L4 tick27342, L9 tick10823. Additional local review sheets `test-results/b114-gpu-sweep-review.jpg` and `test-results/b114-gpu-l10-review.jpg` were opened and stay ignored. Raw captures/logs stay under `test-results/playtest/b114-*`; exact paths and receipts are in JSON.

Only this README, JSON and one small sheet are committed. Candidate source and playtest tools are unchanged. No deployment, push, main movement, zombie tuning, corpse removal or protected-reference edits occurred.
