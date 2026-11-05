# fix56-c — zoom, pursuit scope, road threats, follower pace

The four requested defect checks now pass. **L9-03 is a complete row PASS.** L7-09 and L10-07/08 retain separate unreviewed visual/audio clauses; their passing numeric checks do not qualify those whole compound rows.

Final gameplay commit: `5a878a81b871639cb2cb22d55bc2e6c32c90bd31`. Final source hash: `ae51f8e0ff255eebf4f57908c3a60bbb97d6e53dfa5badcc244596a20992e5ba`.

## Requested fixes

| Defect | Implementation and verified result | Evidence |
| --- | --- | --- |
| L10-08 zoom product cap | `View` clamps the effective user maximum and the interpolated zoom against the current road base. Road base 1.3 × rocket maximum 1.5384615 = **2.0**. Pistol maximum is 1.95 combined; corridor/finale retain base 1 and rocket maximum 2. Tested with the actual production camera rig under both quality labels. | [Camera receipt](L10-camera.json), [L10 clauses](../fix51-verify/L10.json) |
| L10-07 cruise scope | Production movement and the observer share `MegaPursuit.inCruiseBand`: on camera or within 200 m. Hidden far pursuit retains its permitted boost. Both canonical routes measure **0.7×** ordinary cruise inside that scope (213 low / 204 high samples). Persistent identity, no relocation, bounded displacement, no-LOS movement, and paired cue intervals pass. Both observed final state hashes match the current canonical native controls. | [Pursuit receipt](L10-pursuit.json), [L10 clauses](../fix51-verify/L10.json) |
| L9-03 low road threat gap | The map-assisted driver advances after passing a waypoint, preventing repeated turns back toward the point behind it. A roadside wanderer at (125, -346) covers the gap between the existing road encounters. All three prescribed routes complete at both tiers, with every conservative visibility gap below 60 s and zero console/page errors. | Six reviewed routes below; [complete L9-03 row](../fix51-verify/L9.json) |
| L7-09 / G-13 human pace | L7 uses the L5-derived calm pace limiter. The final collision pass now exposes its blocking body; a follower stopped against a solid corpse resets rejected locomotion momentum to its resolved velocity so the existing detour can proceed. Human pace minima are **97.997% low / 97.568% high**, above 95%. Both native routes complete with zero collision failures. Corridor contact counts and timing retain the preceding behavior, and the full L7 rerun has zero fresh failing rows. | [Individual pace receipt](L7-pace.json), [L7 clauses](../fix51-verify/L7.json) |

## L9 physical route qualification

Shared headless Metal WebGL2, zoom 1.5, physical WASD with the existing authored-map assist, protected courier, and no objective skips. Every route reaches the ordinary L10 handover. The visibility observer counts living, submitted on-camera bodies; the conservative gap adds the maximum observation interval.

| Route | Low gap | High gap | Reviewed capture sheets |
| --- | ---: | ---: | --- |
| Road | 33.03 s | 33.53 s | [Low](L9-low-road.jpg), [high](L9-high-road.jpg) |
| Countryside | 37.28 s | 38.33 s | [Low](L9-low-countryside.jpg), [high](L9-high-countryside.jpg) |
| Dry shortcut | 24.35 s | 24.05 s | [Low](L9-low-dry-shortcut.jpg), [high](L9-high-dry-shortcut.jpg) |

All 36 capture panels were reviewed. Wide first-contact photos show infected bodies and red bars beside or ahead of the APC on all routes; the tighter 0.5 photo can crop those bodies out. Opening, intermediate, crash, and handover photos establish the sampled presentation and route progression. Temporal presence comes from the complete driving ledgers, not an inference from stills. The six `L9-<tier>-<route>-reviewed.json` manifests in [fix51-r10c](../fix51-r10c/) retain per-capture SHA-256 and observations, sheet hashes, and compressed-log hashes. Owned raw screenshots and browser profiles were deleted; reviewed sheets and compressed ledgers remain.

## Gates and remaining scope

- `npx tsc --noEmit`, `npm run lint`: pass, including the final pursuit-exporter control comparison.
- `npm test`: **107 tests / 27 files pass** on the final gameplay implementation.
- `npm run build:qa`: pass; physical captures use the final source hash above.
- `npm run qa:accept -- --level <L7|L8|L9|L10> --skip-browser`: all four levels refreshed at both tiers, including complete/stationary policies, fixtures and checkpoint controls. **Zero fresh failing rows** in each level. Acceptance still exits 1 because inherited failures and unqualified compound rows remain.
- `npm run qa:threat`: run alone, **exit 0 / zero audit fail flags**, 419.6 s within the 600 s budget. [Summary](threat-summary.json) preserves non-gating skilled diagnostics separately.

Whole-row visual/audio work remains open: L7-09 bars and pressing-crowd orientation; L10-07 rendered minimap and actual distance-dependent sound gain; L10-08 night suit readability and the finale slam ground effect. The camera capability check does not claim a physical rocket backtrack or a GPU visual qualification. No specification or acceptance threshold was changed.

## Commits

- `e61d59dfa`, `869105e7a` — L10 camera clamp, shared cruise predicate and scoped measurement.
- `36e530a5e` — final L10 camera/pursuit receipts and asserted current native-control equality.
- `1976587bc` — L9 passed-waypoint driving and roadside threat placement.
- `0e1ccbeb6` — six source-matched physical route receipts, reviewed sheets and visibility qualification.
- `a9de27b1f`, `5a878a81b` — L7 calm limiter and targeted corpse-contact momentum correction.
- `24e66d917` — final individual L7 pace and corridor regression qualification.
