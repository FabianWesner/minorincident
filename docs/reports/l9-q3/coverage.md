# L9-Q3 browser input coverage

`tests/e2e/levels/l9-browser-input.spec.ts` uses production input sampling and physics. The L8 campaign preset and initial HP are fixture setup; route movement, outskirts entry and crash completion use no teleports, mission cheats or injected input frames. Keyboard follows the authored road detour using LevelNineBot's pursuit rule translated into key pulses; phone uses a real floating-stick drag through the countryside detour. Both leave/rejoin roads. The shared recorder writes every sampled input frame under `test-results/epics/E31/Q3/`.

| Criteria | Evidence |
| --- | --- |
| AC08/09 | Healthy/floor HUD, continued floor route driving, capped speed, no early explosion/exit, Home clear of HUD |
| AC12 | Residency sampled throughout actual driving, 25/9 unchanged caps |
| AC15/17 | Real mouse + keyboard / real CDP touch route → forced impact → crawl → production campaign callback → L10 axe-only racks/inventory, full health and on foot; error guard |
| AC16/22 | Production engine/crash cues, voice caps, visible captions and cumulative rendered dents/glass/smoke for 76/75/51/50/26/25/1/0%; no repeated threshold event |
| QA quality/zoom/backend | Chromium high, Pixel 7 low; zoom 1/.5; explicit WebGL/WebGPU backend assertions; narrow mouse and real touch HUD captures |
| Scene Lab | New `tests/scenes/catalog/qa-l9-q3-mobile-home.json` extends the existing axe/corgi opening composition with the Scene Lab HUD switch and joins the catalog matrix |

Q2 retains the all-three-route, early/late-floor and full campaign simulation evidence. Q4 owns full-route native hitch and five-round-trip measurements; Q3 reruns the existing E18 native gates without changing limits. Real iOS/Android measurements remain manual. Browser recorder artifacts include full input traces, not a substitute for Q2 sim replay tests.
