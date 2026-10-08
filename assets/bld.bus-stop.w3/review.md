# bld.bus-stop.w3 review

Verdict: PASS
Comparison: test-results/l3-police-and-street-frontages/bld.bus-stop.w3/comparison.png

- [must] Silhouette: PASS — reviewed all sides in comparison.png and LOD contact sheet.
- [must] Distance tiers: PASS — authored LOD0/1/2 have intact solid roof/wall/bench/window borders where applicable.
- [must] Game camera: PASS — reviewed at approximately 150 px, FOV25°, azimuth45°, polar0.30π; visible primary color/silhouette cues retained.
- [must] Contracts: PASS — +X marker, semantic nodes, fixed physics and bounds validate; GLB primitives include animated owner draws.
- [should] Reference: PASS — chunky palette silhouette matches the inspected reference/fallback language.
- [should] Damage/read: PASS — standing civic/shelter/facade profile stays recognizable; damage is authored through missing panes, boards or char.

Concrete limitations: Scorch is represented by broad clean palette patches; source reference mottling is omitted. Smashed panes are clearest from the rear/side.

Orchestrator acceptance is independent. Measured tiers and loading/console evidence are in measurements.json and bld.bus-stop.w3/loading.json. Renderer info includes one presentation triangle/draw beyond the model; the GLB draw totals in measurements.json are the asset totals.
