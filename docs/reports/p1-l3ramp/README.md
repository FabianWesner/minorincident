# p1-l3ramp — L3 ascent investigation

Baseline: `cab3405c`. Branch: `lane/p1-l3ramp`. No changes to `src/`, `public/`, or specs.

The reported L3 failure has **not reproduced**. From a real seed 1 `segment-3b` snapshot, production keyboard WASD reaches the highway's upper landing on both low and high. The native skilled route also completes L3. These results establish a working route on the reported gameplay baseline; they do not establish the cause of the PO's stuck session or a production repair.

## Browser evidence

The capture command is `SCENE_PORT=4347 sh tools/e2e-lock.sh node --import tsx tools/qa/l3-ramp-courier.ts`. It uses the shared headless Metal/WebGL2 pool at zoom 1.5. The native skilled input policy first reaches a genuine calm-moment `segment-3b` snapshot. After restoring that snapshot and stopping the policy, production keyboard input follows the connected street approach and the full authored S-curve. Mission actors and static collision remain active; no god mode, teleport, or movement override is used. WebGPU remains a manual check under repository policy.

| Quality | Start tick / position (x, y, z) | Top tick / position | Console errors |
|---|---|---|---|
| low | 8280 / (111.62, 0.85, -22.84) | 9492 / (167.33, 6.42, -0.39) | 0 |
| high | 8280 / (101.26, 0.85, -22.89) | 9699 / (167.26, 6.42, -0.12) | 0 |

[Low capture](l3-ramp-top-low.png) · [High capture](l3-ramp-top-high.png) · [Raw receipt](browser-receipt.json)

## Native L3 completion

`npm run qa:threat:remote -- --levels L3` ran on `mi-runner-3` (`2.31.107.230`). Seed 1 completed in **193.4 simulation seconds**, with **zero deaths**, **36.3 damage**, no mission failures, and **zero collision failures**. The army-line aggregate passed (2/3 valid seeds within its band); passive acceptance flags were empty.

The command exits 1 because a partial level selection is deliberately diagnostic: the audit's only aggregate acceptance flag is `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate`. This is not a green all-level threat gate. The retained level diagnostics additionally include `wave/station-0:WAVE_FIRST_ATTACK_OVER_20_SECONDS` and `wave/station-2:WAVE_NO_ATTACK_WITHIN_20_SECONDS`; neither is a ramp/completion failure. [Receipt](threat-receipt.json).

`main` advanced during this lane. The audit's `sourceMatchesMain: false` compares against that newer main, while the lane's production sources remain byte-for-byte unchanged from `cab3405c` (`git diff cab3405c HEAD -- src public` is empty).

## Investigation and bisect limitation

- `cac84c2d` rasterizes heights for trap-rescue reachability. Courier grounding still calls `DistrictWorld.groundBelow` through the production controller, rather than the new rescue-height cache.
- The destruction rollout (`07036f6f`, merged by `52e0e349`) explicitly excludes L3's `D-CORRIDOR`.
- `374c7da3` clears contact history for inactive actors. It does not change the ramp support strips or courier movement controller.
- The r14 height merge (`32222f42`) changes attack/AI height handling, rather than the courier's slope controller. The successful browser traversals retain live mission crowds.
- `fd0ad256` rebuilt the ramp's distance models. Both requested qualities remain traversable in the current browser captures.

The supplied (159.34, 5.69, -1.32) pose is near the outside of the S-curve. A native straight-east diagnostic progressed to approximately (166.99, -2.81) before meeting the rail; following the authored bend reaches the landing. This does **not** prove which input, collision, or runtime condition caused the PO's failure. A failing baseline is required for an honest behavioral bisect, so no culprit commit or production fix is claimed. An input replay or saved failing session would resolve the remaining uncertainty.

Follow-up comparison exercised the actual rescue path as well as courier grounding: across all **154,560 L3 nav cells**, the rasterized height array matches the old point-sampled `Float32Array`, and the optimized flood matches the pre-`cac84c2d` eight-neighbor flood with **zero reachability differences**. The reported pose maps to cell 75422, which is closed in both versions; `TrapRescue.update` explicitly ignores closed cells. The three runtime on-ramp GLB blob hashes also match `cab3405c`, excluding accidental stale/modified worktree binaries from this reproduction.

## Regression coverage and remaining scope

The existing movement case now drives the production `SimWorld`/Rapier controller with ordinary movement frames on both quality settings. It covers both L3 on-ramps from the ground before their entry lips at both running and walking pace, recovery from the exact reported pose, L5 metro ingress, the separate L6 exit stairs and escalator, the L7 Northgate terraced road, and the L10 dispersal-platform stairs. It checks horizontal arrival and ascent height. Static level geometry and transforms are loaded through `loadComposition`; cinematics, encounter controllers, and soft actor obstacles are isolated, with the native audit and browser runs supplying the live-mission evidence.

This is coverage of the known gameplay elevation routes, **not an exhaustive certification of every stair depicted by an asset in L1–L10**. For example, the L4/L5 cellar has an authored solid `dressing:cellar-stair` block rather than a traversable tread route; sealed station arrivals and building entrance dressing also need classification before asserting every authored staircase is climbable. The brief's blanket all-authored-stairs requirement therefore remains open. No accepted level geometry was changed speculatively to satisfy that broader assertion.

[Candidate inventory](authored-slope-candidates.json) now enumerates all ten production layout transformations/world tiers. It includes 19 asset-note candidates, named layout stair/ramp colliders, and the two mission-built L9 vehicle jump ramps. A concrete additional probe found that L1 `bld.house-c:67` (scale 0.8) stops at the first porch tread: after 100 movement ticks it advances about 0.05 m and stands at y 0.92 rather than the y 1.408 landing. Its collision contains a single body-height box across the entire plot. That is distinct from the working L3 highway and needs a scope decision about decorative stair flights before changing accepted collision across levels. The cellar's deliberate solid stair block is explicitly authored in `layouts/D-FAIR/layout.py`; E22's art-direction addendum preserves that yard's navigation.

## Validation

- Focused movement/wall/health file, including both gaits from the ramp entry lips: 3/3 passed locally through the shared CPU admission adapter.
- Final **`npm run verify -- E21`: passed on `8247260f`**, including typecheck, lint, and the complete default unit suite. It was admitted locally through the shared FIFO/CPU slot after browser/quiet work cleared. [Checks](epic-checks.json) · [Budget receipt](test-budget.json).
- Remote full-suite attempts exposed the runner's commit-less checkout (`git rev-parse HEAD` in an existing tooling test) and a pre-existing navigation-test timeout under runner load. An additional fixture failure in the new Northgate test was corrected by isolating its mission controllers; the focused final file passes.
- Final complete local default suite, including walking/running entry-lip ascents: **107/107 tests, 27/27 files passed**, 37.56 seconds, at most four workers. The earlier two-worker full suite also passed in 60.37 seconds; [its raw result](unit.json) is retained separately from the [latest validation/provenance](validation.json).
- Earlier remote `npm run verify -- E21` attempts returned nonzero for the listed issues; they are not represented as green remote gates. The final exact E21 command passes locally.

No deploy or push. This lane is an investigation/regression handoff; the reported cause and exhaustive authored-stair requirement remain unproven.
