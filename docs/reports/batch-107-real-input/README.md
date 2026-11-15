# Batch 107 real-input QA — incomplete, candidate not approved

Candidate `d1101b68`. **P1: HIGH evacuation exceeds the requested ~20-second window on both routes.** All three L9 runs eventually reached L10 loading without skipped objectives. Remaining uncertainty is explicitly listed below; this report is not full candidate acceptance.

## Method and checks

Headless GPU browser pool, one browser at a time, private ports 4993/4994, WebGPU confirmed in logs. L9 used normal combat and physical keyboard/mouse input, debug level-menu entry and one logged navigation assist per run. HIGH road ran first, HIGH shortcut second, LOW road third. Zero courier deaths in all three runs. Tools and source were not patched.

Typecheck and lint passed. Required remote `sh tools/remote/run.sh "$PWD" -- npm test` passed: 150-case collection, 105 passed/1 skipped, 130.0 s within 240 s. Initial sandbox startup failures were resolved. No deployment, push, source fix or main-branch move occurred. Raw captures/logs remain locally under `test-results/b107/`; only this README, summarized JSON and one derived [reviewed contact sheet](contact-sheet.jpg) are committed.

## L9 evacuation

| Run | Play zoom | Finished | Boarding evidence after first “Defense complete” |
| --- | --- | --- | --- |
| HIGH road | 1 | 322 s; no skips | 2/4 at tick 12306; still 3/4 at 17447: ≥85.7 s incomplete |
| HIGH shortcut | 1.5 | 236 s; no skips | 2/4 at tick 9835; still 3/4 at 12487: ≥44.2 s incomplete |
| LOW road | 1.5 | 215 s; no skips | 4/4 at tick 9754, with 15 s defense remaining: PASS |

**P1:** evacuation timing/progression delay. Capture: `test-results/b107/l9-high-road/captures/campaign-L9-t16237.jpg`, tick 16237. Eventual handover disproves a permanent softlock in these samples. The driver labeled its pause P2; this report prioritizes the reproduced progression-target failure P1. LOW's log establishes 4/4 before defense ended; it passes boarding timing.

The runs recorded 25/36/35 shotgun attacks respectively, including the seated hatch route, but aggregate counts do not prove every hatch/boarder shot was effective. Courier HP was 100 in the reviewed late HIGH-road defense frame despite dense nearby infected. The prolonged stationary wait after defense reads as babysitting: the crowd supplies visual pressure while the player waits on the final survivor. This sampled phase does not feel consistently dangerous. No general “stunning” or smooth-motion verdict is justified from sparse captures; APC tilt feel remains unverified.

## Placement and fence routing

HIGH shortcut zoom 1.5 frame `test-results/b107/l9-high-shortcut/captures/campaign-L9-t10821.jpg` (tick 10821) shows staging trucks outside buildings. The crowd and framing prevent clearing all survivor paths at the gate fence.

Camera-only fresh-L9 diagnostics confirm the red pickup is clear of its former barricade (`test-results/b107/prompt-fixture/l9-pickup-side.jpg`). Wheel grounding remains visually uncertain; authored y=0 does not establish rendered contact. **P2 placement concern:** a staging truck cab appears over a low road barrier (`test-results/b107/prompt-fixture/l9-staging.jpg`, tick 6). This is a custom cinematic camera view, not follow zoom 1.5 or late evacuation-state proof. No building intersection is visible.

## Interaction prompts

L1 HIGH completed normally on WebGPU in 155 s, but its route did not exercise the optional car alarm. Two targeted real-input alarm approaches failed to reach a usable prompt: one visible-only route stalled before pickup, another standard route reached the outbreak/bat and encountered fences during manual detour. They supply no alarm verdict.

A labeled L1 **layout fixture** supplies the HIGH/LOW × zoom 1/1.5 matrix. Setup loaded/began L1, armed/reset alarm cycles and positioned the courier outside interaction range; final approach used physical WASD. This is not an uninterrupted post-outbreak playthrough. All four reviewed views clear the vitals card. **P3:** the yellow objective arrow overlaps the alarm panel upper-right at zoom 1 HIGH/LOW (`test-results/b107/prompt-fixture/alarm-high-z1.jpg`, tick 69). Zoom 1.5 separates them. Matrix paths and ticks are in `qa.json`.

Three additional HIGH WebGPU L1 fixtures—Gate, Push dumpster and Start car wash—clear vitals/minimap/objective in their sampled views. Six sequential frames each used physical KeyA then KeyD with 100 ms movement intervals plus screenshot overhead. No erratic relocation was observed while panels remained visible. Gate/dumpster panels disappeared and returned across interaction range; carwash disappeared on activation. Raw frames: `test-results/b107/prompt-fixture/motion-{gate,dumpster,carwash}-{0..5}.jpg`. This is a short boundary sample, not comprehensive motion qualification. L2 was sampled partially; L3 was not reached.

## Screamer readability

Actual ordinary events were captured in both levels:

- L9 HIGH, zoom 1, tick 12347: `test-results/b107/l9-high-road/captures/scream-L9-12347-8.jpg`. Thin pale purple arc is visible on road but partly concealed by HUD/APC/crowd; weak static contrast.
- L10 HIGH, zoom 1, telegraph 7529 and noise/ring 7577: `test-results/b107/l10-warning-route/captures/scream-L10-7577-8.jpg`. Thin purple circumference is visible centered on dark ground; competing red melee rings and dense bodies attract more attention. This route used documented **IMMORTAL / ROUTE ONLY**, so it is not combat acceptance.

A separate living L10 farm sample captured `alpha.roar` at tick 4711; its broad red ring is conspicuous. It cannot substitute for the ordinary warning. WebGPU is confirmed for L1, L9 and L10 checked here. Sparse event/route screenshots do not prove that a moving player reliably notices the purple ring. Readability verdict: visible when inspected, insufficient evidence to approve moving noticeability.

## Driver gaps and remaining work

No tools/playtest edits were made. Dedicated alarm approach/capture and continuous warning-motion recording were not available in the documented options. Capture zooms do not automatically produce a complete scene matrix. Late L9 checkpoint setup rejected `evac-point` with “No active objective,” so placement diagnostics used a fresh level and camera-only viewpoints.

Still unverified: complete living-survivor fence routing; pickup wheel grounding at follow zoom 1.5; attached-boarder identity beyond nearby seated hits; uninterrupted post-outbreak alarm matrix; continuous warning noticeability in L9/L10. The committed sheet includes evacuation, ordinary L9 scream, two L10 loading handovers and the alarm fixture matrix. The report remains incomplete until these evidence gaps are resolved or the authorized time-box closeout is reached.

A bounded 180-second HIGH WebGPU immortal route-only repeat requested Playwright context video via an ignored wrapper around unchanged `runSession`. It captured ordinary scream tick 7644, but delivered no local video artifact. The run exited normally; it does not establish continuous-motion readability. Raw diagnostic: `test-results/b107/video-l10/`.

## L10 moving-warning follow-up

Recording was recovered by applying Playwright `recordVideo` to the admitted persistent-context path in an ignored wrapper; original driver/source files remain unchanged. Fresh-profile HIGH WebGPU zoom 1 **IMMORTAL / ROUTE ONLY** video: `test-results/b107/video-l10/video/page@18681991b6cdfdd36e5e9ec439629a75.webm`. The 111–117 s interval was reviewed as 24 sequential frames at 4 fps (`review/scream-sequence.jpg`). Actual ordinary scream tick 6453 aligns with this interval. **P2 readability:** the purple pulse appears briefly as a large screen-edge arc while the courier runs; persistent red attack rings dominate. It is easy to miss during this movement sample. This is a bounded visual verdict, not performance qualification or combat acceptance. L9 continuous warning review remains open.

## Recorded L9 follow-up

An extra fresh HIGH road WebGPU normal-combat repeat was recorded at `test-results/b107/video-l9/video/page@a38926bd456affad4e87b49fea43bb9f.webm`. Reviewed sequential frames: 30–42 s at 1 fps show modest chassis lean through turns, without abrupt flip/severe wobble; 114–120 s at 4 fps show a hatch stall during an ordinary scream (tick 6946), whose source is off-camera, with no conspicuous purple ring visible; 170–190 s at 1 fps show survivors moving through the bay but not every fence contact. These are bounded samples, not a universal animation/performance pass.

This extra repeat progressed from defense-complete 0/4 at tick 10414 to 3/4 at 11217 (~13.4 s), then crash/crawl and eventual handover. Exact 4/4 was not logged. It did not reproduce the first HIGH-road 85.7-second delay and does not cancel that observed intermittent failure. Continuous video exists, but this interval does not establish moving-camera noticeability of an onscreen L9 purple ring.

## Hatch combat audit

An additional normal-combat HIGH shortcut WebGPU run used existing `PLAYTEST_COMBAT_AUDIT=1` and finished without skips in 339 s. All 23 recorded courier shotgun hits correlate with a nearest observation (within 70 ticks) showing APC #667 active. At ticks 5810/5840, shots dealt 192/107 damage to Alpha #877, whose HP fell from 107 to 0; the nearest tick-5821 tracker says “Engine stalled — hold the hatch … shoot boarders … cannot leave APC.” Seated hatch fire therefore damages/downs nearby infected in this sample. The audit does not separately establish attached-boarder identity. Summary: `test-results/b107/hatch-audit/hit-summary.json`; raw logs remain outside git. This repeat also showed a later 3/4 post-defense delay, reinforcing the intermittent evacuation finding.
