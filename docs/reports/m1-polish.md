# M1 polish — QA gate 1

Scope: VQA-08, VQA-09/M1-21, VQA-12/M1-20, VQA-13 and VQA-14 from `visual-qa-2026-10-06-1731.md`.

The branch merged main once, then integrated outbreak `8807f51`, render corrections `eb450e8`, and navigation `6b5b0ef`. Animation conflict resolution keeps main's proportional stride/planting and outbreak's infection clips. Render conflict resolution keeps main's live look settings and the render lane's smooth blood, stable shadows and depth-safe corpse fade.

- VQA-08: preserve cleanup-phase body separation and Rapier's authoritative survivor. Add combat silhouette clearance, capped so broad enemies can still enter melee/grab range. Give the corgi and civilian pets footprints matching their larger visuals. Armored-fighter and follower regressions cover the gameplay consequences.
- VQA-09 / M1-21: compact translucent objective panels; transition toast moves into the header, above touch controls. Portrait minimap has its own top-right space. Real-input captures assert no toast/ACTION overlap at diner and hardware transitions.
- VQA-12 / M1-20: both faces of the delivered diner board carry readable “Joe's Diner” lettering and outlined OPEN neon. A shared sRGB canvas texture drives diffuse/emissive material with intensity 2, retaining readable lettering across district LODs and engaging bloom.
- VQA-13: nearby fallen actors retain detailed geometry; use stable back/side death poses, normalize settled contact against each rig's visible geometry, and lower forward-reaching worker arms/legs. Bodies ease toward separate clear ground footprints; coherent opaque screen-door fade runs from six to nine seconds. The depth regression samples solid, fade-start, half-fade and fade-end poses at the new ages.
- VQA-14: both objective HUDs use a nonbreaking space between distance and unit. V4/V5 captures check the suffix and visually show 28 m / 16 m together.

The E19 gate also exposed stale browser fixture assumptions: the render test now checks kills against its actual independent-AI encounter while retaining the blood/surface assertions; the world route approaches the hedge from clear road waypoints instead of aiming at a blocked (-19,-4.5) point. Collision and companion assertions are retained. Desktop weapon fixtures allow a bounded real-input approach to offscreen population spawns before sampling strike frames, matching the touch fixture; hit, trail, particle and grip assertions are retained. The portrait connection scene exceeded the existing 500,000-triangle budget at 512,458; low-quality scenery now transitions to LOD2 beyond 18 m instead of 30 m, without moving scenery or changing the camera.

The two full-district matrices run as 20 independent seed cases each, retaining the normal per-case timeout and isolating world cleanup. The ground-edge sweep allows 60 seconds on the shared Mac. All seeds, movement checks, death assertions and gameplay/performance budgets remain in place.

## Verification

`tests/e2e/m1-polish.spec.ts` walks L1 using browser mouse/keyboard input or CDP touch gestures, begins/picks up through real controls, and attacks through real LEFT/RIGHT controls. Setup loads the level and pauses; it does not teleport, inject logical input, enable god mode or force objectives. Simulation and presentation clocks are stepped through the existing test API. Captures cover start (-14,-4), diner (42,-6.5), V5 (56,0), hardware transition (70,-7), and the shop observer near (75,-4). Desktop is 1600×900/high; portrait is 390×844/low, matching the QA report. Real headless Chromium reports ANGLE/Metal on Apple M1 Max. Captures were inspected and deleted after review.

Typecheck, lint, 174 unit tests, the smoke suite (3 simulation and 22 browser cases), and `verify -- E19` (79 unit/simulation and 49 browser cases) pass. Final low-quality portrait scenery peaks at 408,015 triangles, under the 500,000 budget. Compact capture measurements are recorded in `m1-polish.json`. Browser runs use `tools/e2e-lock.sh` and port 3349; build, typecheck, lint and Vitest do not occupy browser slots. The orchestrator's two-slot lock update is preserved.

Composition/geometry placement findings VQA-05/10/11 remain assigned to r2-compose. This change does not move static scenery or change the camera composition.
