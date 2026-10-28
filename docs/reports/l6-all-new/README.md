# L6 all-new rollout — runtime gates in progress

- [Census](census.json): four converted IDs; fourteen already v2, including both couriers and the companion; none deferred. Reused the durable man-a Trellis high; inference spend **€0**.
- [Rebuild proof](rebuild-proof.json): all **66 delivery/bake/registry files reproduce identically**, zero manual asset steps; run `tools/assets/skin-crowd-build.sh <wave2/npc.civilian-man-a> <asset-id>` for each converted ID.
- [LOD0/1/2 budget](delivery-budget.json): **5433/2284/1965 triangles** ≤6000/2500/4000; maximum **351884/174280/123972 bytes** ≤600000/250000/150000.
- Reviewed native 120/400 px front/back, low/high, WebGL2/WebGPU and two skin tones: [man-a](01-npc.civilian-man-a.aftermath.jpg), [bandaged](02-npc.shelter-survivor.bandaged.jpg), [lying](03-npc.shelter-survivor.lying.jpg), [sitting](04-npc.shelter-survivor.sitting.jpg); [verdict and fixes](visual-review.json).
- Reviewed [30-figure L6 crowd](05-crowd-old-new.jpg), [healthy/turned/frozen states](06-body-states.jpg) and [close turned/corpse views](11-turned-corpses-close.jpg); four real bodies per state asserted on both capture configurations.
- Reviewed [scripted scenes](07-scripted-scenes.jpg), [shelter/power failure](08-scripted-scenes.jpg), [retreat/hatch](09-retreat-and-hatch.jpg), and [Marcus pistol front/back](10-marcus-pistol.jpg); **28 scene checks pass**, both live pistols retain muzzles on the unified weapon path. [Coverage](coverage.json).
- Gates: full asset validator **1262 records, zero errors** plus [current 12 LODs](validation.json); typecheck/lint and `npm test` **104/104 pass**; **144/150 cases, no new cases**. Smoke, scene:gate and the L6 real-input run are still running/pending.
- [Performance](performance.json): low/high fixture draws **62→62 / 81→81**, triangles **131279→119138 / 211659→190083**, decoded textures **369.10→372.26 / 418.41→429.49 MiB**. Final full-population low p95 (+1 ms) and five cold loads (+10%) **pending PO quiet window**; shared host load was ~5.
- [Gameplay paths unchanged](gameplay-frozen.json). No deploy; all browser jobs shared, headless and serial, with private ports.
- [Showcase source](showcase.json): `l6-crowd-old-new.jpg` **1600×850** written to the requested scratchpad. Best captures: **05 crowd**, **02 neutral-light detail**, **08 rested shelter**; eleven report captures.
