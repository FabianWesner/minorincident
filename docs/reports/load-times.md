1. load-times: work in progress on `lane/load-times`, based on main `57189968`; final native runs are queued behind other lanes.
2. Fixes: exact placement indexing, worker crowd preparation, shared matrix/pose shaders, one daylight/fire graph, cast preparation, physics-copy warm-up and overlapping L1 compilation.
3. Last measured high (packed), L1–L6/restart: 3.46 / 2.56 / 2.38 / 1.38 / 2.01 / 2.34 / 1.64 s; six of seven meet 3 s.
4. Provisional phone (packed; late machine load 4.10): 7.82 / 6.82 / 8.88 / 4.62 / 4.70 / 6.17 / 4.70 s; repeat pending against 5 s.
5. Original L3 assertion reproduced a 183.4 ms hitch; packed L3 and every high transition peak at 16.8 ms with zero post-card frames above 50 ms.
6. Typecheck/lint/build and remote 529 tests in 145 files pass; memory, context recovery and GPU gun poses are queued; five of 13 broader sim failures reproduce on untouched base.
7. Inspected packed captures: L2 crew, seated civilians, firetruck, props and shadows render coherently; L5 retains its cellar-wall occlusion; 88 unselected captures/profiles/traces deleted.
8. Targets remain unfulfilled and the latest candidate is unmeasured; no deployment or merge; methods, experimental timings and limits: [metrics](load-times-metrics.json).
