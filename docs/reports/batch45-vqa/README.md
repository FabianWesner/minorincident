# Batch 45 pre-PROD visual QA (look-empty dressing), 2026-10-31

Build: main `af26ef6bb`, QA preview bundle (`BRANCH=qa npm run build`), headless WebGPU, one browser, port 4882.
Saves: `L6-default` / `L7-default` / `L10-default` campaign presets (carried gear, L6 survivors). HUD hidden for captures.
Captures: 13 L10 + 9 L7 + 4 L6 stations × zoom 1 and 1.5 × high and low (104 frames), 13 close-zoom 0.5 low frames on the clusters,
3-frame lantern flicker strips per level and tier. All frames were opened; the PNGs were deleted afterwards. One sheet per level is kept:
[L6](L6-sheet.jpg) · [L7](L7-sheet.jpg) · [L10](L10-sheet.jpg). Labels are `level-tier-x_z-zoom` (zoom 0.5 = closest, 1.5 = widest).

Real-input walk (WASD steering only, god mode, low): L6 exit apron loop, L7 x265→110 weaving past every Northgate cluster,
L10 R6+R7 route x2917→3935 (≈1.1 km). Zero stalls, zero browser errors. All new props are `decor` (no collider, `staticCollision` returns none), so they cannot block the route.

| Level | Verdict | Stunning |
|---|---|---|
| L6 exit | GO (one P2) | 6.5/10 |
| L7 Northgate | GO | 6.5/10 |
| L10 R6/R7 | GO | 6/10 |

Glitches:
- P2 L6 (281.9–284.7, 22–25): the third exit station (`decor-l6-exit-6` broken chair, `decor-l6-exit-7` pallet and the storm lantern at 283, 22) sits against/inside the `bld.backdrop-houses` footprint (280.4–287.6 × 23.4–30.6). From the street the roof hides the props and lantern, so only a light pool spills out of the wall; when the player hugs the wall, the cut-away shows the pallet inside the house and the chair straddling the wall line.
- P3 all three levels: new props are pass-through (decor without collider), the same as the older L6/L10 decor. The player and the infected walk through the crates, sandbags and chairs when they leave the road.
- P3 L7: `decay.broken-glass` reads at low/zoom 1 as dark-teal paper arrowheads rather than glass.
- P3 L6 (258.5, 22): the lantern sits right at the stairwell rim, so its base touches the salmon edge strip.

No floating or sunk props (all 112 added placements sit at sampled ground height ±0.00 m), no z-fighting, no LOD pops between tiers, and no lantern pops (gentle flicker only). The nearest L10 footprint is 4.5 m from the route centreline, on the dark verge beyond the curb in every frame. L10 is played on foot (E32: no driving), and nothing new is on the carriageway.
