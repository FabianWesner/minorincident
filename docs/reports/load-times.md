1. load-times progress checkpoint on `lane/load-times`, base main `57189968`; all seven high transitions pass, phone work continues.
2. Fixes include indexed placement, one nav bake, actual cast preparation, shared shaders, lossless civilian bakes (72 assets/46.37 MiB gzip) and bounded CPU caching.
3. Strict native high (inflated), L1–L6/restart: 1.98 / 2.31 / 1.92 / 1.43 / 1.49 / 1.67 / 1.43 s; all seven meet 3 s; preflight load 2.00/no other browsers.
4. Strict phone: 6.18 / 4.40 / 6.48 / 3.67 / 3.57 / 3.93 / 3.56 s; L1/L3 exceed 5 s; L1 retains two post-card hitches (116.6 ms peak).
5. Original L3 assertion reproduced 183.4 ms; latest L3 peaks at 16.8 ms high/33.4 ms phone; every high row has zero frames above 50 ms.
6. Remote 607 tests/147 files pass; all 72 bakes match runtime bytes; focused loader/environment checks pass; context recovery/gun poses pass; phone memory ratio remains red.
7. Inspected captures retained in [captures](load-times-captures/): L2 crew/truck/corgi/shadows intact, L5 cellar occlusion preserved, rifle/pistol align with hands/tracers.
8. Latest shared environment/full-size fire warm-up is awaiting native validation; targets remain unfulfilled; no deploy/merge; [methods and metrics](load-times-metrics.json).
