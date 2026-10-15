# L6 PO round — 2026-10-15

Bugs #31, #33, #34 and #35. Worktree `l6-po`; no deployment or merge into main. At the orchestrator’s request, `lane/assets-layout` was merged as `6f79e02f0`. Its station/track alignment and survivor/door shifts are retained; the headlamp pickup moved to `(1.5, -2)`.

Core bug commits: `e3e512b79` (#33), `fca1d851a` (#31), `1d66cfd5d` (#34), `eb77e1e2d` (#35); subsequent commits finish the asset, profiling fixes, layout merge and QA.

## Changes

- **#31:** Lower L6 ambient/fill and fog brightness. Material shading keeps unlit geometry dark grey, restores colour inside the existing facing/aim cone, and preserves emissive eyes and practical light pools. The existing warm courier glow and flashlight footprint are retained. Collect the visible headlamp beside the start lantern with E / middle-click; its inventory state survives checkpoint restore. The authored cap attaches to either courier's head. Blender source, optimization helper, MIT license and all three GLBs are included: **144 / 80 / 80 triangles**, four materials. Equipment stays outside the twelve-piece civilian wardrobe pool. One existing spotlight; its shadow is high only; no additional gameplay render pass.
- **#33:** Compile both L6 light lists behind the loading card, include the outbreak assets in budgeted warm-up, spread the eight second-breach arrivals across frames, and reuse/debug-render collider buffers at 10 Hz. CPU profiling of the separate tunnel stress hitch found first-corpse body posing. Reuse body poses baked during loading, including covered hair, and pose only the small accessory. Padded attributes and nonindexed geometry remain supported. A parity regression compares the resulting geometry against the full bake. The new native scream test is included in `verify E24`.
- **#34:** One “Block the tunnel” objective and progress bar, contextual closing/bracing instructions, visible crate outlines and rings, a ground target line, an arrow over the next crate, and a first-push hint. Service gate panels participate in courier see-through.
- **#35:** Six alternating side-passage/maintenance-hatch entries, with positional banging, a shaking/falling grate and a small signal pool. Each telegraphs for at least two seconds and releases two infected, six seconds apart. The recurring pursuit stream is reduced to one arrival per ten seconds; reserved pool slots keep the new entries working on low. Escape lanes stay open. Track/layout/collision changes come from the requested `lane/assets-layout` merge; this lane authors no additional track placement changes.

The E24 spec changes implement the PO's explicit lighting request: collection controls the beam, the no-weapon rule allows the headlamp, and AC19 specifies spotlight shadows on high only. Frame, rescue, time and death thresholds were not relaxed. The checkpoint fixture now waits for staged arrivals to settle before taking its manual abandonment snapshot, matching natural abandonment.

## Gameplay measurement

Same seed and complete bot. The control uses the pre-entry controller/data from `1d66cfd5d`, with the same incoming eight-metre station, door, survivor and pickup offsets as the final layout; other files use the merged branch. It is compared with the final encounter balance. An engagement is a distinct living, visible infected entering 12 m of the courier while the courier is between tunnel x=30 and x=246. Counts are divided by time spent in that section; they measure nearby pressure, not kills.

| Tier | Before engagements/min | After engagements/min | Before unique | After unique | Final rescue | Final time | Deaths |
|---|---:|---:|---:|---:|---:|---:|---:|
| High | 4.19 | 6.95 | 11 | 18 | 26/29 | 259.2 s | 0 |
| Low | 0.39 | 5.00 | 1 | 13 | 14/20 | 259.95 s | 0 |

Novice seed 1: **12/29 rescued, 261.8 s, zero deaths**. The complete and novice simulation criteria for time, rescue and deaths pass. Six entry sources, their two-second warning, offscreen appearance and staggered pairs have a dedicated sim regression.

## Visual review

Four Scene Lab fixtures: `qa-l6-po-pickup`, `qa-l6-po-headlamp`, `qa-l6-po-gate`, `qa-l6-po-entry`. The catalog matrix passed **48/48** combinations: WebGL2/WebGPU × high/low × zoom 0.5/1/1.5. Separate actual-game captures cover those tiers, backends and zooms; pickup and both courier fits are captured too. The gate regression passes all four backend/tier cases.

I opened and reviewed the game-camera sheets. The before images show the brighter coloured tunnel and an opaque gate hiding the courier. Afterward the surrounding geometry remains visible in grey, the original warm beam colours the route, and sparse warm/red accents remain. The cap and illuminated lens are visible on both couriers. The gate now reveals the courier, the cyan target line and outlined crates are visible, and the closed-gate UI has one bar and a direct push/brace instruction. HUD text remains readable in both tiers.

- [Before/after, WebGPU high/low, zoom 0.5/1](l6-po/before-after.jpg)
- [Pickup and closed-gate captures, both backends and tiers](l6-po/pickup-gate.jpg)

The final [high](l6-po/tunnel-high.png) and [low stress captures](l6-po/tunnel-low.png) also show a rectangular dark patch in the elevated rails directly under the courier. This appears to come from the incoming per-fragment reveal cutting track geometry; it was surfaced to the orchestrator for the see-through/track lane. This lane does not alter track placement.

## Validation

Typecheck, lint and the fresh production build pass. The final full unit run on Hetzner has **1,514 passed, seven skipped, one unrelated failure**. All 20 focused corpse/appearance/headlamp asset checks pass, including geometry parity. The final remote `verify E24` simulation/campaign selection passes **33/33**.

The final quiet native batch passes **12/12**: high/low tunnel stress, two power transitions and eight backend/tier/debug scream cases (24 beats). Scream maxima are **18.2 ms high / 16.6 ms low**, below the 50/100 ms gates.

| Native tunnel stress | p50 | p95 | Max | Survivors / infected | Draws | Triangles |
|---|---:|---:|---:|---:|---:|---:|
| High | 4.8 ms | 6.5 ms | 41.3 ms | 28 / 40 | 126 | 419,033 |
| Low, phone viewport, DPR 1.5, 4× CPU throttle | 10.2 ms | 13.6 ms | 67.9 ms | 25 / 30 | 73 | 90,605 |

These are native Metal WebGL stress runs; spotlight shadows are high only. Both final stress camera captures were opened and reviewed. The separate scream cases check both actual backends, both tiers, and debug on/off.

The broad browser run has **39 passed / one failed**. The real keyboard/mouse escort does not reach the result screen within its 3,500 iterations. A focused rerun still fails after shifting its shelter defence point with the survivors. Its final periodic sample shows repeated deaths and the group still near the tunnel entrance. This is an **open gameplay/input gate**, and baseline attribution has not been established. The test still requires zero deaths, at least 60% rescued, a closed gate, a rejoined straggler and all seven photographs. The final `verify E24` therefore exits red.

The unrelated unit failure is the unchanged L4 `l4-sandbag-66` / `prop.privacy-fence:147/geometry-0` overlap in `placement-solids.test.ts`. This lane does not edit that layout. The older occluder-fixture failure disappeared with the requested upstream see-through merge.

The accompanying [evidence summary](l6-po/evidence.json) records the measurements. Raw captures, Scene Lab metrics, per-frame scream arrays, quiet-run conditions, pressure logs and final suite outputs remain under `test-results/l6-po/` in this worktree.

### Memory cross-check

The existing five-load E18 retention test was run on the lane and on an isolated, freshly built `lane/assets-layout` control (`666479d02`). Absolute L6 heaps are below the 400/250 MB budgets (lane high 67.4/75.8 MB, low 60.7/69.0 MB). The separate relative-retention gate is red: the control grows 8.8% high / 12.3% low, and the lane grows 21.0% high / 26.0% low across L1→L6→L1→L6→L1. GPU geometry/texture counts remain within their 10% thresholds. The additional retained JS heap is an open limitation; no threshold was changed. A follow-up renderer-cache diagnostic could not obtain a slot within the bounded queue wait, so no unmeasured global-cache change was made.
