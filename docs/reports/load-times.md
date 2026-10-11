1. load-times checkpoint on `lane/load-times`, base main `57189968`; original L3 hitch fixed; final static-bake timing queued, so the full target is not yet met.
2. Fixes: indexed layout/nav/paving, actual cast/physics preparation, shared warmed graphs, bounded caches, lossless civilian bakes (72/46.37 MiB) and static bakes (185/33.25 MiB).
3. Latest measured high (paving), L1–L6/restart: 1.73 / 2.13 / 1.66 / 1.44 / 1.51 / 1.53 / 1.22 s; every row meets 3 s, zero frames above 50 ms; idle preflight load 2.02.
4. Same-source phone: L1 5.50 s/L3 6.08 s still fail 5 s; L1 has one 50.1 ms frame; static batches target the measured ~1 s CPU cost and await native timing.
5. Original L3 assertion reproduced 183.4 ms; latest L3 peaks 16.8 ms high/33.5 ms phone; native L1 text shaping identified the objective-arrow fallback and its loading preparation removed that large hitch.
6. Remote 789 tests/148 files pass, all 257 generated assets match runtime bytes, static material/index flags match; typecheck/lint/build pass; previous context/gun checks pass, latest context/memory remain to run.
7. Inspected [captures](load-times-captures/): L2 crew/truck/corgi/shadows intact, L5 cellar occlusion preserved, rifle/pistol align with hands/tracers; updated static-bake captures remain pending.
8. High/phone native timing and UI/context/memory checks remain queued behind other browser jobs; no deploy or merge; full frames, phases and limitations in [metrics](load-times-metrics.json).
