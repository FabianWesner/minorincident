# L7 all-new figures — review in progress

- [Production census](census.json): **24 reachable identities already v2**, including five civilian infected appearances, five Alpha looks, carried survivors, both couriers and the corgi; **zero conversions/deferred**. Temporary native runner variants are replaced before render. Inference spend **€0**.
- Production assets, renderer and gameplay match main `93d73c529`; this lane supplies missing L7 coverage and review evidence.
- [Delivery audit](delivery-budget.json) checks skins/weights and high/low files; inherited L1 civilian LOD0/1/2 caps **60000/9000/4000**, aftermath **6000/2500/2500**, Alpha **8000/3000/1000** triangles; file caps **600000/250000/150000 bytes**.
- Twelve figure sheets cover retained rigid baselines versus current v2, front/back, native **120/400 px**, both renderers and tiers, plus pale/dark NPC tones in L7 lighting.
- Runtime portrait, crowd/state/weapon and scripted-scene captures are running; the final report will contain **14 captures**.
- Typecheck passes. Asset validator, npm test, smoke, scene gate and the real-input L7 playthrough are being finalized; no final gate claim yet.
- Full-population low p95 (+1 ms) and worst of five cold loads (+10%) remain **perf pending** for the permitted quiet window.
