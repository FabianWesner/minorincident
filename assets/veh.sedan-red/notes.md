# Red sedan

Reference measurements: compact 1980s-style four-door silhouette, 2.66 m axle spacing, 0.74 m tyres, 1.61 m roof height. Coachwork is 4.30 m long and 1.80 m wide; overall bumper/plate length is 4.63 m, width over mirrors 2.29 m. Front is +X, left is -Y, tyre ground contact is z=0.

Purposeful parts: wheel arch openings/lips, four complete hinged doors with seals and handles, rear quarter windows, roof rails and pillars, smoked windows, front seats/headrests, rear bench, dashboard, steering wheel, rear-view mirror, wipers, cowl vents, hood ridges, grille recess/slats, rectangular headlamps/indicators, segmented tail lamps, mouldings, fuel flap, bumper trim, blank registration plates and screws, exhaust, vented hubcaps and tread.

No real brand or added lettering. Registration plates are blank, matching the reference. Raised parts use at least 3 mm separation. Geometry is joined per material within each static or moving assembly; door roots are on their forward hinges, wheel roots at axle centres. Lamps remain on separate assemblies. Headlight/brake anchors, vehicle physics, collider and driver/exit sockets are exported as extras. Deterministic 32-sample Cycles AO is baked into `ao` vertex colour on export (the primary glTF `COLOR_0`, with gentle 10% contact modulation; transparent panes remain unoccluded). LOD1 and LOD2 are separate GLBs with identical joint/node contracts.

Build with the prescribed `experiment/tools/blender_run.py` wrapper. No shared tooling, source specifications or reference images are modified.

A final `--render renders/hero.png` request also renders `renders/game.png` under the same shared GPU lease.


## Wrecked P1 variant (2026-10-07)

`npm run assets:build -- veh.sedan-red --decay wrecked` rebuilds closed native sedan distance forms with missing glazing, a continuous front-impact/roof-sag transform, a closed accordion-fold hood and close-range impact scars. All wheel/light/door/seat node contracts remain intact. No generic decimation. Detailed intact source is preserved. LOD0 uses the native LOD1 foundation to stay within the lane 15k cap; LOD1/2 preserve the existing authored distance sources. The three native GLBs are inputs and are committed beside the script.

Reviewed five-angle LOD0/1/2 contact sheet at `test-results/art-l2l3/veh.sedan-red.wrecked/lod-contact.png`; variant passes geometry/metadata budgets. Independent QA pending.
